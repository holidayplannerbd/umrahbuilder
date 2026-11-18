/* ============================================================
   UMRAH BUILDER — MODULES / CALCULATOR (v9 — Manual Room Edit)
   ⭐ হোটেল রুম ম্যানুয়ালি এডিট করা যাবে (Auto Sync বন্ধ)
   ⭐ Flight এবং Transport ডাইনামিক থাকবে
   ============================================================ */

function getPackageNights() {
  return daysBetween($('pkgCheckIn')?.value, $('pkgCheckOut')?.value);
}

/* ==================== PAID HELPERS ==================== */
function getPackageAdvance(p) {
  return Math.max(0, Number(p?.advanceAmount || 0));
}

function getPackageLedgerPaid(p) {
  let paid = 0;
  STORE.customers.forEach(c => (c.payments || []).forEach(pm => {
    if (pm.packageId === p.id) paid += Math.max(0, Number(pm.amount || 0));
  }));
  return paid;
}

function getPackagePaid(p) {
  return getPackageAdvance(p) + getPackageLedgerPaid(p);
}

/* ==================== MARKUP TOGGLE ==================== */
function toggleMarkupInput() {
  const type = strVal('markupType', 'percent');
  const pctInput = $('markupPercent');
  const valInput = $('markupValue');
  const valLabel = $('markupFixedLabel');

  if (pctInput) pctInput.disabled = type !== 'percent';
  if (valInput) valInput.disabled = type === 'percent';

  if (valLabel) {
    const labels = {
      fixed: 'Fixed Markup (৳)',
      per_person: 'Markup Per Person (৳)',
      target: 'Target Selling Price (৳)'
    };
    valLabel.textContent = labels[type] || 'Fixed / Target (৳)';
  }
  recalc();
}

function updateTotalGuestsDisplay() {
  const pax = intVal('paxAdult', 0) + intVal('paxChild', 0) + intVal('paxInfant', 0);
  const el = $('totalGuestsDisplay');
  if (el) el.value = pax + ' guests';
}

/* ==================== CALCULATE PACKAGE TOTALS ==================== */
function calculatePackageTotals() {
  const paxAdult = Math.max(0, intVal('paxAdult', 0));
  const paxChild = Math.max(0, intVal('paxChild', 0));
  const paxInfant = Math.max(0, intVal('paxInfant', 0));
  const paxChargeable = paxAdult + paxChild;

  // ⭐ হোটেলের টোটাল সরাসরি ডাইনামিক ফাংশন থেকে নেওয়া
  const hotelCost = getMakkahTotal() + getMadinahTotal();
  const vendorHotelCost = getMakkahVendorCost() + getMadinahVendorCost();
  const ziyarahTransportCost = getZiyarahTransportCost();

  /* ==================== Flight (Net vs Sell) ==================== */
  let flightCost = 0;
  let vendorFlightCost = 0;
  let flightProfit = 0;

  (flightItems || []).forEach(f => {
    if (typeof recalcFlightTotals === 'function') recalcFlightTotals(f);
    flightCost += Number(f.totalSell || 0);
    vendorFlightCost += Number(f.totalNet || 0);
  });
  flightProfit = flightCost - vendorFlightCost;

  /* ==================== Transport (Sell vs Vendor) ==================== */
  let transportCost = 0;
  let vendorTransportCost = 0;

  (transportItems || []).forEach(t => {
    // ⭐ প্রতিবার ট্রান্সপোর্টের টোটাল ডাইনামিক্যালি রিফ্রেশ
    if (typeof recalcTransportTotals === 'function') recalcTransportTotals(t);
    
    const isBulletTrain = t.vehicle === 'Bullet Train';
    const isPerVehicle = t.priceType === 'per_vehicle' && !isBulletTrain;
    
    let multiplier = t.currentMultiplier || 1;
    if (multiplier <= 0) {
      if (isBulletTrain || !isPerVehicle) multiplier = Math.max(1, paxChargeable);
      else {
        const cap = Number(t.capacity || VEHICLE_CAPACITY[t.vehicle] || 0);
        multiplier = Math.max(1, Number(t.vehicleCount || 1), cap > 0 ? Math.ceil(paxChargeable / cap) : 1);
      }
    }

    const sellPer = Number(t.sellPrice !== undefined ? t.sellPrice : (t.price || 0));
    const vendorPer = Number(t.vendorCost !== undefined ? t.vendorCost : (t.price || 0));

    transportCost += sellPer * multiplier;
    vendorTransportCost += vendorPer * multiplier;
  });

  /* ==================== Visa ==================== */
  let visaCost = 0;
  let vendorVisaCost = 0;

  (visaItems || []).forEach(v => {
    const totalPax = paxAdult + paxChild + paxInfant;
    const feePerPax = Math.max(0, Number(v.priceAdult || v.price || 0));
    const costPerPax = Math.max(0, Number(v.costAdult || 0));
    visaCost += feePerPax * totalPax;
    vendorVisaCost += costPerPax * totalPax;
  });

  /* ==================== Service ==================== */
  const serviceCost = (serviceItems || []).reduce((sum, sv) => {
    const multiplier = sv.priceType === 'per_group' ? 1 : paxChargeable;
    return sum + (Math.max(0, Number(sv.price || 0)) * multiplier);
  }, 0);

  /* ==================== Subtotal ==================== */
  const subTotal = hotelCost + flightCost + transportCost + visaCost + serviceCost + ziyarahTransportCost;

  const vatPercent = Math.max(0, numVal('vatPercent', 0));
  const vatAmount = vatPercent > 0 ? Math.round(subTotal * vatPercent / 100) : 0;
  const serviceFeeAmount = Math.max(0, numVal('serviceFeeAmount', 0));
  const totalWithTaxes = subTotal + vatAmount + serviceFeeAmount;

  /* Markup */
  const markupType = strVal('markupType', 'percent') || 'percent';
  const markupPercent = Math.max(0, numVal('markupPercent', 0));
  const markupValue = Math.max(0, numVal('markupValue', 0));
  const discountAmount = Math.max(0, numVal('discountAmount', 0));
  const advanceAmount = Math.max(0, numVal('advanceAmount', 0));

  let markupAmount = 0;
  if (markupType === 'fixed') markupAmount = markupValue;
  else if (markupType === 'per_person') markupAmount = markupValue * paxChargeable;
  else if (markupType === 'target') markupAmount = Math.max(0, markupValue - totalWithTaxes);
  else markupAmount = totalWithTaxes * markupPercent / 100;
  markupAmount = Math.round(markupAmount);

  const grossTotal = totalWithTaxes + markupAmount;
  const grandTotal = Math.max(0, Math.round(grossTotal - discountAmount));
  const dueAmount = Math.max(0, grandTotal - advanceAmount);

  /* ==================== Vendor costs ==================== */
  const vendorServiceCost = serviceCost;
  const vendorZiyarahCost = getZiyarahVendorCost();

  const totalVendorCost = vendorHotelCost + vendorFlightCost + vendorTransportCost +
                          vendorServiceCost + vendorZiyarahCost + vendorVisaCost;

  const actualProfit = grandTotal - totalVendorCost - vatAmount - serviceFeeAmount;
  const profitMargin = grandTotal > 0 ? (actualProfit / grandTotal) * 100 : 0;
  const perPerson = paxChargeable > 0 ? Math.round(grandTotal / paxChargeable) : 0;

  return {
    paxAdult, paxChild, paxInfant, paxChargeable,
    hotelCost, flightCost, transportCost, visaCost, serviceCost, ziyarahTransportCost,
    subTotal, vatPercent, vatAmount, serviceFeeAmount, totalWithTaxes,
    markupType, markupPercent, markupValue, markupAmount,
    discountAmount, advanceAmount, dueAmount,
    grossTotal, grandTotal, perPerson,
    vendorHotelCost, vendorFlightCost, vendorTransportCost, vendorServiceCost, vendorZiyarahCost, vendorVisaCost,
    totalVendorCost, actualProfit, profitMargin,
    flightProfit
  };
}

/* ==================== ⭐ RECALC (Manual Hotel Edit) ==================== */
function recalc() {
  const paxChargeable = intVal('paxAdult', 0) + intVal('paxChild', 0);

  // ⭐ ১. Hotel Auto-Sync বন্ধ করা হলো (ম্যানুয়াল এডিটের জন্য)
  // (এখানে কোনো syncHotelRoomsWithPax কল নেই)

  // ⭐ ২. Flight টোটাল আপডেট
  if (typeof flightItems !== 'undefined' && flightItems.length > 0) {
    flightItems.forEach(f => {
      if (typeof recalcFlightTotals === 'function') recalcFlightTotals(f);
    });
  }

  // ⭐ ৩. Transport টোটাল আপডেট (Bullet Train সহ)
  if (typeof transportItems !== 'undefined' && transportItems.length > 0) {
    transportItems.forEach(t => {
      if (typeof recalcTransportTotals === 'function') recalcTransportTotals(t);
    });
    
    // ⭐ UI রিফ্রেশ (Pax চেঞ্জ হলে বুলেট ট্রেনের "Persons" ফিল্ড আপডেট হবে)
    if (typeof renderTransportsList === 'function') {
      renderTransportsList();
    }
  }

  if (typeof renderVisasList === 'function') {
    renderVisasList();
  }

  const t = calculatePackageTotals();

  if ($('sumHotel')) $('sumHotel').textContent = fmt(t.hotelCost);
  if ($('sumFlight')) $('sumFlight').textContent = fmt(t.flightCost);
  if ($('sumTransport')) $('sumTransport').textContent = fmt(t.transportCost);
  if ($('sumVisa')) $('sumVisa').textContent = fmt(t.visaCost);
  if ($('sumZiyarah')) $('sumZiyarah').textContent = fmt(t.ziyarahTransportCost);
  if ($('sumServices')) $('sumServices').textContent = fmt(t.serviceCost);
  if ($('grandSubTotal')) $('grandSubTotal').textContent = fmt(t.subTotal);
  if ($('vatAmount')) $('vatAmount').textContent = fmt(t.vatAmount);
  if ($('markupAmount')) $('markupAmount').textContent = fmt(t.markupAmount);
  if ($('grandTotal')) $('grandTotal').textContent = fmt(t.grandTotal);
  if ($('perPersonTotal')) $('perPersonTotal').textContent = fmt(t.perPerson);
  if ($('dueAmount')) $('dueAmount').textContent = fmt(t.dueAmount);
  if ($('profitAmount')) $('profitAmount').textContent = fmt(t.actualProfit);
  if ($('profitMargin')) $('profitMargin').textContent = t.profitMargin.toFixed(1) + '%';
  if ($('ssSubTotal')) $('ssSubTotal').textContent = fmt(t.totalVendorCost);
  if ($('ssGrandTotal')) $('ssGrandTotal').textContent = fmt(t.grandTotal);
  if ($('ssProfit')) $('ssProfit').textContent = fmt(t.actualProfit);
  if ($('ssPerPerson')) $('ssPerPerson').textContent = fmt(t.perPerson);

  updateTotalGuestsDisplay();
  return t;
}