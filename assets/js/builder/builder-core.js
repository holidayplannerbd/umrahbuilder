/* ============================================================
   UMRAH BUILDER — BUILDER / CORE (v7 — Fully Dynamic)
   ============================================================ */

function createPaymentItemId(category) {
  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${category}_${uniqueId}`;
}

function ensurePaymentItemIds(items, category) {
  (items || []).forEach(item => { if (!item.paymentItemId) item.paymentItemId = createPaymentItemId(category); });
}

function renderPackageItemVendorSelect(category, item) {
  ensurePaymentItemIds([item], category);
  const vendors = (STORE.vendors || []).filter(v => v.type === category || v.type === 'other');
  const options = vendors.map(v => `<option value="${v.id}" ${String(item.vendorId || '') === String(v.id) ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  return `<div class="field" style="margin-bottom:12px">
    <label>Assigned Vendor</label>
    <select data-payment-item="${escapeAttr(item.paymentItemId)}" onchange="setPackageItemVendor('${category}',this.dataset.paymentItem,this.value)">
      <option value="">-- Unassigned --</option>${options}
    </select>
  </div>`;
}

function setPackageItemVendor(category, paymentItemId, vendorId) {
  const itemsByCategory = { transport: transportItems, visa: visaItems, service: serviceItems, ziyarah: ziyarahTransportItems };
  const item = (itemsByCategory[category] || []).find(x => x.paymentItemId === paymentItemId);
  if (!item) return;
  item.vendorId = vendorId || '';

  const renderers = { transport: renderTransportsList, visa: renderVisasList, service: renderServicesList, ziyarah: renderZiyarahTransportList };
  renderers[category]?.();
}

/* ==================== OPEN BUILDER ==================== */
async function openBuilder() {
  if (!isAdmin()) {
    if (typeof toast === 'function') { toast('❌ আপনি Package create করতে পারবেন না', 'error'); }
    return;
  }

  editingPackageId = null;
  builderDefaultRoomSharing = 'double';
  hotelStayOrder = ['makkah', 'madinah'];
  itineraryRouteOrder = 'makkah-first';

  if ($('builderTitle')) $('builderTitle').textContent = '🕋 New Umrah Package';
  if ($('savePackageBtn')) $('savePackageBtn').textContent = '💾 Save Package';

  makkahItems = []; madinahItems = []; flightItems = []; transportItems = [];
  visaItems = []; serviceItems = []; itineraryItems = []; inclusionsItems = [];
  exclusionsItems = []; importantNotesItems = []; paymentTermsItems = [];
  cancellationPolicyItems = []; ziyarahTransportItems = [];

  mC = 0; mdC = 0; fC = 0; tC = 0; vC = 0; sC = 0; itC = 0;
  incC = 0; excC = 0; noteC = 0; ptC = 0; cpC = 0; ztC = 0;
  hotelRoomCounter = 0;

  ['pkgName', 'pkgCheckIn', 'pkgCheckOut', 'pkgValidUntil', 'pkgFollowupDate', 'pkgReference',
   'pkgCustomerName', 'pkgCustomerPhone', 'pkgCustomerPassport', 'pkgCustomerEmail',
   'pkgSpecialRequest', 'pkgTemplateKey', 'pkgCancellationPolicy', 'pkgNotes'].forEach(id => setVal(id, ''));

  const s = await dbGetSetting('settings') || {};
  if ($('pkgCancellationPolicy')) $('pkgCancellationPolicy').value = s.defaultPolicy || '';
  if ($('pkgNotes')) $('pkgNotes').value = s.defaultNotes || '';

  const ref = await generateQuotationRef();
  setVal('pkgRefNo', ref);
  setVal('pkgNights', '0 Nights / 0 Days');
  setVal('paxAdult', 2);
  setVal('paxChild', 0);
  setVal('paxInfant', 0);
  setVal('roomSharing', 'double');
  setVal('roomCount', 1);
  setVal('childWithBed', 0);
  setVal('childNoBed', 0);
  setVal('pkgStatus', 'Draft');
  setVal('pkgType', 'Standard');
  setVal('pkgCustomerNationality', 'Bangladeshi');
  setVal('markupType', 'percent');
  setVal('markupPercent', 10);
  setVal('markupValue', 0);
  setVal('discountAmount', 0);

  const vatDefault = s.vatPercent !== undefined ? s.vatPercent : 15;
  setVal('vatPercent', vatDefault);
  setVal('serviceFeeAmount', s.serviceFee || 0);
  setVal('advanceAmount', 0);

  updateTotalGuestsDisplay();

  addInclusionItem('Umrah Visa');
  addInclusionItem('Hotel Accommodation (Makkah & Madinah)');
  addInclusionItem('Airport Transfers');
  addInclusionItem('Makkah Ziyarah Tour');
  addInclusionItem('Madinah Ziyarah Tour');
  addInclusionItem('Private Transportation');
  addInclusionItem('Makkah to Madinah Transfer');
  addInclusionItem('Professional Guide Assistance (During Umrah)');

  addExclusionItem('International & Domestic Air Tickets');
  addExclusionItem('Daily Breakfast');
  addExclusionItem('Lunch & Dinner');
  addExclusionItem('Personal Expenses');
  addExclusionItem('Laundry Services');
  addExclusionItem('Porter Charges');
  addExclusionItem('Any sightseeing or excursions not mentioned in the itinerary');

  addImportantNoteItem('Passport must be valid for at least 6 months from the date of travel.');
  addImportantNoteItem('Visa approval is subject to the Saudi authorities.');
  addImportantNoteItem('Hotel rooms are subject to availability at the time of booking.');

  addPaymentTermItem('60% Advance Payment is required at the time of booking. The remaining balance must be paid at least 7 days before departure.');
  addCancellationPolicyItem('This package is Non-Refundable.');

  clearAllErrors();
  addMakkahHotel();
  addMadinahHotel();
  renderAll();
  applyHotelStayOrder();
  recalc();
  toggleMarkupInput();
  openModal('builderModal');
}

/* ==================== EDIT PACKAGE ==================== */
async function editPackage(id) {
  if (!isAdmin()) {
    if (typeof toast === 'function') { toast('❌ আপনি Package edit করতে পারবেন না', 'error'); }
    return;
  }

  const p = STORE.packages.find(x => x.id === id);
  if (!p) return;

  editingPackageId = id;
  hotelStayOrder = normalizeHotelStayOrder(p.hotelStayOrder);
  const firstRouteItem = (p.itinerary || []).find(it => it.type === 'arrival') ||
    (p.itinerary || []).find(it => ['Makkah', 'Madinah'].includes(it.city));
  itineraryRouteOrder = p.itineraryRouteOrder ||
    (String(firstRouteItem?.city || '').toLowerCase() === 'madinah' ? 'madinah-first' : 'makkah-first');
  if ($('builderTitle')) $('builderTitle').textContent = '✏️ Edit Umrah Package';
  if ($('savePackageBtn')) $('savePackageBtn').textContent = '💾 Update Package';

  setVal('pkgName', p.name || '');
  setVal('pkgRefNo', p.refNo || '');
  setVal('pkgType', p.type || 'Standard');
  setVal('pkgStatus', p.status || 'Draft');
  setVal('pkgCheckIn', p.checkIn || p.start || '');
  setVal('pkgCheckOut', p.checkOut || p.end || '');
  setVal('pkgNights', (p.nights || 0) + ' Nights / ' + (p.days || 0) + ' Days');
  setVal('pkgValidUntil', p.validUntil || '');
  setVal('pkgFollowupDate', p.followupDate || '');
  setVal('pkgReference', p.reference || '');
  setVal('paxAdult', p.paxAdult ?? 2);
  setVal('paxChild', p.paxChild ?? 0);
  setVal('paxInfant', p.paxInfant ?? 0);
  builderDefaultRoomSharing = p.roomSharing || 'double';
  setVal('roomSharing', builderDefaultRoomSharing);
  setVal('roomCount', p.roomCount ?? 1);
  setVal('childWithBed', p.childWithBed ?? 0);
  setVal('childNoBed', p.childNoBed ?? 0);
  setVal('pkgCustomerName', p.customerName || '');
  setVal('pkgCustomerPhone', p.customerPhone || '');
  setVal('pkgCustomerPassport', p.customerPassport || '');
  setVal('pkgCustomerEmail', p.customerEmail || '');
  setVal('pkgCustomerNationality', p.customerNationality || 'Bangladeshi');
  setVal('pkgSpecialRequest', p.specialRequest || '');
  setVal('pkgCancellationPolicy', p.cancellationPolicy || '');
  setVal('pkgNotes', p.notes || '');
  setVal('vatPercent', p.vatPercent !== undefined ? p.vatPercent : 15);
  setVal('serviceFeeAmount', p.serviceFeeAmount ?? 0);
  setVal('advanceAmount', p.advanceAmount ?? 0);
  setVal('markupType', p.markupType || 'percent');
  setVal('markupPercent', p.markupPercent ?? 10);
  setVal('markupValue', p.markupValue ?? 0);
  setVal('discountAmount', p.discountAmount ?? 0);
  setVal('pkgTemplateKey', p.templateKey || '');

  makkahItems = JSON.parse(JSON.stringify(p.makkahHotels || []));
  madinahItems = JSON.parse(JSON.stringify(p.madinahHotels || []));

  flightItems = JSON.parse(JSON.stringify(p.flights || [])).map(f => {
    const legacy = f.fareAdult || f.fare || 0;
    return { ...f, netPrice: f.netPrice !== undefined ? f.netPrice : legacy, sellPrice: f.sellPrice !== undefined ? f.sellPrice : legacy, totalNet: f.totalNet || 0, totalSell: f.totalSell || 0, profit: f.profit || 0 };
  });

  transportItems = JSON.parse(JSON.stringify(p.transports || []));
  visaItems = JSON.parse(JSON.stringify(p.visas || []));
  serviceItems = JSON.parse(JSON.stringify(p.services || []));
  ensurePaymentItemIds(transportItems, 'transport');
  ensurePaymentItemIds(visaItems, 'visa');
  ensurePaymentItemIds(serviceItems, 'service');
  inclusionsItems = dedupeTextItems(JSON.parse(JSON.stringify(p.inclusions || [])));
  exclusionsItems = dedupeTextItems(JSON.parse(JSON.stringify(p.exclusions || [])));
  importantNotesItems = dedupeTextItems(JSON.parse(JSON.stringify(p.importantNotes || [])));
  paymentTermsItems = dedupeTextItems(JSON.parse(JSON.stringify(p.paymentTerms || [])));
  cancellationPolicyItems = dedupeTextItems(JSON.parse(JSON.stringify(p.cancellationPolicyItems || [])));

  ziyarahTransportItems = (p.ziyarahTransport || []).map((it, idx) => ({
    ...it, id: idx + 1, ziyarahId: it.ziyarahId, city: it.city, name: it.name, pax: it.pax || 2, car: it.car || 'hiace', cars: it.cars || 1, price: it.price || 0, sellPrice: it.sellPrice ?? it.price ?? 0, auto: it.auto !== undefined ? it.auto : true
  }));
  ensurePaymentItemIds(ziyarahTransportItems, 'ziyarah');
  ztC = Math.max(0, ...ziyarahTransportItems.map(x => x.id || 0));

  const seen = new Set();
  const uniqueItinerary = [];
  (p.itinerary || []).forEach(it => {
    const key = `${it.day}-${it.title || ''}-${it.description || ''}`;
    if (!seen.has(key)) { seen.add(key); uniqueItinerary.push(it); }
  });
  const expectedDays = p.days || uniqueItinerary.length;
  const cappedItin = uniqueItinerary.slice(0, expectedDays);
  itineraryItems = cappedItin.map((it, i) => ({
    id: i + 1, day: i + 1, date: it.date || '', city: it.city || '', title: it.title || '', description: it.description || '', fixed: it.fixed || false, type: it.type || '', ziyarahZone: it.ziyarahZone || null, zone: it.zone || ''
  }));
  itC = itineraryItems.length;

  // ⭐ migrateHotel ফাংশনে vendorRate লোড নিশ্চিত করা
  const migrateHotel = (h, cityType) => {
    if (h.rooms && Array.isArray(h.rooms)) {
      h.rooms = h.rooms.map(r => ({ meal: 'room_only', mealRate: 0, ...r }));
      h.city = cityType === 'madinah' ? 'Madinah' : 'Makkah';
      if (!h.checkIn) h.checkIn = p.checkIn || '';
      if (!h.checkOut) h.checkOut = p.checkOut || '';
      
      if (!h.vendorId && h.hotelId) {
        const masterList = cityType === 'madinah' ? STORE.madinahHotels : STORE.makkahHotels;
        const master = masterList.find(m => String(m.id) === String(h.hotelId));
        if (master?.vendorId) {
          h.vendorId = master.vendorId;
          h.vendorName = STORE.vendors.find(v => String(v.id) === String(master.vendorId))?.name || '';
        }
      }
      if (!h.vendorHotelItemId && h.hotelId) {
        const masterList = cityType === 'madinah' ? STORE.madinahHotels : STORE.makkahHotels;
        const master = masterList.find(m => String(m.id) === String(h.hotelId));
        if (master?.vendorHotelItemId) h.vendorHotelItemId = master.vendorHotelItemId;
      }
      
      h.rooms.forEach(r => {
        r.vendorRate = getHotelRoomVendorRate(cityType, h, r);
      });

      return h;
    }
    return h;
  };
  makkahItems = makkahItems.map(h => migrateHotel(h, 'makkah'));
  madinahItems = madinahItems.map(h => migrateHotel(h, 'madinah'));

  let maxRoomId = 0;
  [...makkahItems, ...madinahItems].forEach(h => (h.rooms || []).forEach(r => { if (r.id > maxRoomId) maxRoomId = r.id; }));
  hotelRoomCounter = maxRoomId;

  mC = Math.max(0, ...makkahItems.map(x => x.id || 0));
  mdC = Math.max(0, ...madinahItems.map(x => x.id || 0));
  fC = Math.max(0, ...flightItems.map(x => x.id || 0));
  tC = Math.max(0, ...transportItems.map(x => x.id || 0));
  vC = Math.max(0, ...visaItems.map(x => x.id || 0));
  sC = Math.max(0, ...serviceItems.map(x => x.id || 0));
  incC = Math.max(0, ...inclusionsItems.map(x => x.id || 0));
  excC = Math.max(0, ...exclusionsItems.map(x => x.id || 0));
  noteC = Math.max(0, ...importantNotesItems.map(x => x.id || 0));
  ptC = Math.max(0, ...paymentTermsItems.map(x => x.id || 0));
  cpC = Math.max(0, ...cancellationPolicyItems.map(x => x.id || 0));

  syncHotelRoomNightsFromDates(p.nights || 0);
  renderAll();
  applyHotelStayOrder();
  toggleMarkupInput();
  recalc();
  openModal('builderModal');
  toast('✏️ Edit mode', 'info');
}

/* ==================== SAVE PACKAGE ==================== */
async function savePackage() {
  if (!isAdmin()) {
    if (typeof toast === 'function') { toast('❌ আপনি Package save করতে পারবেন না', 'error'); }
    return false;
  }

  clearAllErrors();
  const name = strVal('pkgName') || 'Untitled Umrah Package';
  const custName = strVal('pkgCustomerName');
  const custPhone = strVal('pkgCustomerPhone');
  const custPassport = strVal('pkgCustomerPassport');
  const custEmail = strVal('pkgCustomerEmail');
  const custNationality = strVal('pkgCustomerNationality', 'Bangladeshi');

  let hasError = false;
  if (!custName) { setError('pkgCustomerName', 'Customer name required'); hasError = true; }

  const ci = strVal('pkgCheckIn');
  const co = strVal('pkgCheckOut');
  if (ci && co && new Date(co) < new Date(ci)) { setError('pkgCheckOut', 'Invalid date'); hasError = true; }
  if (hasError) { toast('Fix red fields', 'error'); return false; }

  showLoading('Saving package...');
  try {
    const currentUid = window.firebaseAuth?.currentUser?.uid || null;

    let customerId = null;
    if (custName) {
      let existing = custPhone ? STORE.customers.find(c => String(c.phone || '') === String(custPhone)) : null;
      if (!existing) existing = STORE.customers.find(c => c.customerName === custName);

      if (existing) {
        customerId = existing.id;
        await dbSave(STORES.customers, { ...existing, customerName: custName, phone: custPhone, passport: custPassport, email: custEmail, nationality: custNationality, userId: existing.userId || currentUid, updatedAt: Date.now() });
      } else {
        customerId = Date.now();
        await dbSave(STORES.customers, { id: customerId, customerName: custName, phone: custPhone, passport: custPassport, email: custEmail, nationality: custNationality, userId: currentUid, payments: [], createdAt: Date.now() });
      }
      STORE.customers = await dbGetAll(STORES.customers);
    }

    const t = calculatePackageTotals();
    const previous = editingPackageId ? STORE.packages.find(p => p.id === editingPackageId) : null;

    const nightsStr = strVal('pkgNights', '0');
    const nightsMatch = nightsStr.match(/(\d+)/);
    const nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;
    const days = nights + 1;
    const refNo = strVal('pkgRefNo') || await generateQuotationRef();

    const seenKeys = new Set();
    const cleanItinerary = [];
    itineraryItems.forEach((it) => {
      const key = `${it.day}-${it.title || ''}-${it.description || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const newIdx = cleanItinerary.length + 1;
        cleanItinerary.push({ ...it, id: newIdx, day: newIdx });
      }
    });
    const cappedItin = cleanItinerary.slice(0, days);

    (flightItems || []).forEach(f => { if (typeof recalcFlightTotals === 'function') recalcFlightTotals(f); });
    ensurePaymentItemIds(transportItems, 'transport');
    ensurePaymentItemIds(visaItems, 'visa');
    ensurePaymentItemIds(serviceItems, 'service');
    ensurePaymentItemIds(ziyarahTransportItems, 'ziyarah');

    makkahItems.forEach(h => (h.rooms || []).forEach(r => { r.vendorRate = getHotelRoomVendorRate('makkah', h, r); }));
    madinahItems.forEach(h => (h.rooms || []).forEach(r => { r.vendorRate = getHotelRoomVendorRate('madinah', h, r); }));

    const data = {
      ...(previous || {}), id: editingPackageId || Date.now(), userId: previous?.userId || currentUid, refNo, name, type: strVal('pkgType', 'Standard'), status: strVal('pkgStatus', 'Draft'), checkIn: ci, checkOut: co, start: ci, end: co, nights, days, duration: nights + 'N / ' + days + 'D', validUntil: strVal('pkgValidUntil'), followupDate: strVal('pkgFollowupDate'), reference: strVal('pkgReference'), paxAdult: t.paxAdult, paxChild: t.paxChild, paxInfant: t.paxInfant, roomSharing: strVal('roomSharing', 'double'), roomCount: intVal('roomCount', 1), childWithBed: intVal('childWithBed', 0), childNoBed: intVal('childNoBed', 0), customerId, customerName: custName, customerPhone: custPhone, customerPassport: custPassport, customerEmail: custEmail, customerNationality: custNationality, specialRequest: strVal('pkgSpecialRequest'), cancellationPolicy: strVal('pkgCancellationPolicy'), notes: strVal('pkgNotes'),
      itinerary: cappedItin, itineraryRouteOrder, hotelStayOrder: [...hotelStayOrder], inclusions: JSON.parse(JSON.stringify(dedupeTextItems(inclusionsItems))), exclusions: JSON.parse(JSON.stringify(dedupeTextItems(exclusionsItems))), importantNotes: JSON.parse(JSON.stringify(dedupeTextItems(importantNotesItems))), paymentTerms: JSON.parse(JSON.stringify(dedupeTextItems(paymentTermsItems))), cancellationPolicyItems: JSON.parse(JSON.stringify(dedupeTextItems(cancellationPolicyItems))),
      ziyarahTransport: JSON.parse(JSON.stringify(ziyarahTransportItems)), makkahHotels: JSON.parse(JSON.stringify(makkahItems)), madinahHotels: JSON.parse(JSON.stringify(madinahItems)), flights: JSON.parse(JSON.stringify(flightItems)), transports: JSON.parse(JSON.stringify(transportItems)), visas: JSON.parse(JSON.stringify(visaItems)), services: JSON.parse(JSON.stringify(serviceItems)),
      hotelCost: t.hotelCost, flightCost: t.flightCost, transportCost: t.transportCost, visaCost: t.visaCost, serviceCost: t.serviceCost, ziyarahTransportCost: t.ziyarahTransportCost, subTotal: t.subTotal,
      vendorHotelCost: t.vendorHotelCost, vendorFlightCost: t.vendorFlightCost, vendorTransportCost: t.vendorTransportCost, vendorServiceCost: t.vendorServiceCost, vendorZiyarahCost: t.vendorZiyarahCost, vendorVisaCost: t.vendorVisaCost, totalVendorCost: t.totalVendorCost, flightProfit: t.flightProfit,
      vatPercent: t.vatPercent, vatAmount: t.vatAmount, serviceFeeAmount: t.serviceFeeAmount, markupType: t.markupType, markupPercent: t.markupPercent, markupValue: t.markupValue, markupAmount: t.markupAmount, discountAmount: t.discountAmount, advanceAmount: t.advanceAmount, dueAmount: t.dueAmount, grandTotal: t.grandTotal, actualProfit: t.actualProfit, profitMargin: t.profitMargin, perPerson: t.perPerson, templateKey: strVal('pkgTemplateKey'), createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now()
    };

    await dbSave(STORES.packages, data);
    STORE.packages = await dbGetAll(STORES.packages);

    hideLoading();
    closeModal('builderModal');
    renderPackages();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAccounts === 'function') renderAccounts();
    updateSidebarBadges();

    if (typeof addNotification === 'function') {
      addNotification({ type: editingPackageId ? 'package_edit' : 'package_create', icon: editingPackageId ? '✏️' : '📦', message: editingPackageId ? `✏️ Package edited: <b>${esc(name)}</b>` : `📦 New package: <b>${esc(name)}</b> by ${esc(custName || 'customer')}`, link: 'packages' });
    }

    toast(editingPackageId ? '✅ Package updated' : '✅ Package saved');
    editingPackageId = null;
    return true;
  } catch (e) {
    hideLoading();
    toast('Save failed: ' + e.message, 'error');
    return false;
  }
}

function resetBuilder() { confirmDelete('Clear all package data?', () => { openBuilder(); }); }

function syncHotelRoomNightsFromDates(packageNights = getPackageNights()) {
  const checkIn = $('pkgCheckIn')?.value || '';
  const checkOut = $('pkgCheckOut')?.value || '';
  makkahItems.forEach(h => {
    if (!h._makkahDateManual || !h.checkIn) h.checkIn = checkIn;
    if (!h._makkahDateManual || !h.checkOut) h.checkOut = checkOut;
    if (h.checkIn && h.checkOut) {
      const hotelNights = daysBetween(h.checkIn, h.checkOut);
      (h.rooms || []).forEach(r => { r.nights = hotelNights; });
    } else if (!h._makkahDateManual && packageNights > 0) {
      (h.rooms || []).forEach(r => { r.nights = packageNights; });
    }
  });

  const firstMakkah = makkahItems.find(h => h.hotelId && h.checkOut);
  const madinahAutoIn = firstMakkah?.checkOut || checkIn || '';

  madinahItems.forEach(h => {
    if (!h._madinahDateManual || !h.checkIn) h.checkIn = madinahAutoIn;
    if (!h._madinahDateManual || !h.checkOut) h.checkOut = checkOut || '';
    if (h.checkIn && h.checkOut) {
      const hotelNights = daysBetween(h.checkIn, h.checkOut);
      (h.rooms || []).forEach(r => { r.nights = hotelNights; });
    }
  });
}

function calcDuration() {
  const checkIn = $('pkgCheckIn')?.value;
  const checkOut = $('pkgCheckOut')?.value;
  let nights = 0, days = 0;

  if (checkIn && checkOut) {
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (co < ci) { setError('pkgCheckOut', 'Invalid date'); return; }
    else { clearError('pkgCheckOut'); }
    nights = Math.max(0, Math.round((co - ci) / 86400000));
    days = nights + 1;
  }
  if ($('pkgNights')) $('pkgNights').value = nights + ' Nights / ' + days + ' Days';

  syncHotelRoomNightsFromDates(nights);
  renderMakkahHotelsList();
  renderMadinahHotelsList();
  regenerateItineraryFromDates();
  recalc();
}