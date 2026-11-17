/* ============================================================
   UMRAH BUILDER — BUILDER / TRANSPORT (v10 — Perfect)
   ⭐ Adult, Child, Infant আলাদা দাম
   ⭐ ডাইনামিক Pax Calculation
   ============================================================ */

/* ==================== ADD TRANSPORT ITEM ==================== */
function addTransportItem() {
  transportItems.push({
    id: ++tC,
    transportId: null,
    from: '',
    to: '',
    vehicle: '',
    trainClass: '',
    capacity: 12,
    priceType: 'per_vehicle',
    vehicleCount: 1,
    price: 0,
    sellPrice: 0,
    vendorCost: 0,
    // ⭐ Bullet Train Fields
    adultSell: 0,
    adultCost: 0,
    childSell: 0,
    childCost: 0,
    infantSell: 0,
    infantCost: 0,
    currentMultiplier: 1
  });
  renderTransportsList();
  recalc();
}

/* ==================== REMOVE TRANSPORT ITEM ==================== */
function removeTransportItem(id) {
  transportItems = transportItems.filter(t => t.id !== id);
  renderTransportsList();
  recalc();
}

/* ==================== ON TRANSPORT CHANGE ==================== */
function onTransportItemChange(itemId, transportId) {
  const t = transportItems.find(x => x.id === itemId);
  if (!t) return;

  if (!transportId) {
    t.paymentItemId = createPaymentItemId('transport');
    Object.assign(t, {
      transportId: null, from: '', to: '', vehicle: '', trainClass: '',
      capacity: 12, priceType: 'per_vehicle', vehicleCount: 1,
      price: 0, sellPrice: 0, vendorCost: 0, vendorId: '',
      adultSell: 0, adultCost: 0, childSell: 0, childCost: 0, infantSell: 0, infantCost: 0,
      currentMultiplier: 1
    });
  } else {
    const dbT = STORE.transports.find(x => x.id === parseInt(transportId));
    if (!dbT) return;
    if (String(t.transportId || '') !== String(dbT.id)) {
      t.paymentItemId = createPaymentItemId('transport');
    }
    
    const isBulletTrain = dbT.vehicle === 'Bullet Train';

    t.transportId = dbT.id;
    t.vendorId = dbT.vendorId || '';
    t.from = dbT.from;
    t.to = dbT.to;
    t.vehicle = dbT.vehicle;
    t.trainClass = dbT.trainClass || '';

    if (isBulletTrain) {
      t.capacity = 0;
      t.priceType = 'per_person';
      t.vehicleCount = 1;
      
      t.adultSell = Number(dbT.adultSell || 0);
      t.adultCost = Number(dbT.adultCost || 0);
      t.childSell = Number(dbT.childSell || 0);
      t.childCost = Number(dbT.childCost || 0);
      t.infantSell = Number(dbT.infantSell || 0);
      t.infantCost = Number(dbT.infantCost || 0);
      
      t.price = t.adultSell;
      t.sellPrice = t.adultSell;
      t.vendorCost = t.adultCost;
    } else {
      t.capacity = dbT.capacity || VEHICLE_CAPACITY[dbT.vehicle] || 12;
      t.priceType = dbT.priceType || 'per_vehicle';
      t.vehicleCount = dbT.vehicleCount || 1;

      const defaultSell = Number(dbT.sellPrice !== undefined ? dbT.sellPrice : (dbT.price || 0));
      const defaultVendor = Number(dbT.vendorCost !== undefined ? dbT.vendorCost : (dbT.price || 0));

      t.price = defaultSell;
      t.sellPrice = defaultSell;
      t.vendorCost = defaultVendor;
    }
  }
  
  recalcTransportTotals(t);
  renderTransportsList();
  recalc();
}

/* ==================== UPDATE FIELD ==================== */
function updateTransportItemField(id, field, value) {
  const t = transportItems.find(x => x.id === id);
  if (!t) return;
  if (field === 'vendorCost') return;

  if (field === 'price' || field === 'sellPrice') {
    t[field] = Math.max(0, parseFloat(value) || 0);
    if (field === 'sellPrice') t.price = t.sellPrice;
  } else if (field === 'vehicleCount') {
    t.vehicleCount = Math.max(1, parseInt(value) || 1);
  } else {
    t[field] = value;
  }

  recalcTransportTotals(t);
  renderTransportsList();
  recalc();
}

/* ==================== RECALC TOTALS ==================== */
function recalcTransportTotals(t) {
  if (!t) return;
  
  const paxAdult = intVal('paxAdult', 0);
  const paxChild = intVal('paxChild', 0);
  const paxInfant = intVal('paxInfant', 0);
  
  const isBulletTrain = t.vehicle === 'Bullet Train';
  const cap = VEHICLE_CAPACITY[t.vehicle] || t.capacity || 12;
  const isPerVehicle = t.priceType === 'per_vehicle' && !isBulletTrain;

  let multiplier = 1;
  if (isBulletTrain) {
    multiplier = Math.max(1, paxAdult + paxChild + paxInfant);
  } else if (isPerVehicle) {
    const totalPax = paxAdult + paxChild;
    const required = cap > 0 ? Math.ceil(totalPax / cap) : 1;
    multiplier = Math.max(1, Number(t.vehicleCount || 1), required);
  } else {
    multiplier = Math.max(1, paxAdult + paxChild);
  }

  if (isBulletTrain) {
    const adultTotalSell = (t.adultSell || 0) * paxAdult;
    const childTotalSell = (t.childSell || 0) * paxChild;
    const infantTotalSell = (t.infantSell || 0) * paxInfant;
    t.sellTotal = adultTotalSell + childTotalSell + infantTotalSell;

    const adultTotalCost = (t.adultCost || 0) * paxAdult;
    const childTotalCost = (t.childCost || 0) * paxChild;
    const infantTotalCost = (t.infantCost || 0) * paxInfant;
    t.vendorTotal = adultTotalCost + childTotalCost + infantTotalCost;
  } else {
    const sellPer = Number(t.sellPrice !== undefined ? t.sellPrice : (t.price || 0));
    const vendorPer = Number(t.vendorCost !== undefined ? t.vendorCost : (t.price || 0));
    t.sellTotal = sellPer * multiplier;
    t.vendorTotal = vendorPer * multiplier;
  }

  t.currentMultiplier = multiplier;
  t.profit = t.sellTotal - t.vendorTotal;
}

/* ==================== RENDER LIST ==================== */
function renderTransportsList() {
  const el = $('transportsList');
  if (!el) return;

  if ($('transportCount')) $('transportCount').textContent = transportItems.length;

  if (!transportItems.length) {
    el.innerHTML = '<div class="empty-slot"><span class="ic">▣</span>No transport</div>';
    return;
  }

  const opts = STORE.transports.map(t =>
    `<option value="${t.id}">${t.vehicle === 'Bullet Train' ? '🚄 ' : ''}${esc(t.from)} → ${esc(t.to)} — ${esc(t.vehicle)}</option>`
  ).join('');

  const paxAdult = intVal('paxAdult', 0);
  const paxChild = intVal('paxChild', 0);
  const paxInfant = intVal('paxInfant', 0);

  el.innerHTML = transportItems.map((t, i) => {
    recalcTransportTotals(t);

    const isBulletTrain = t.vehicle === 'Bullet Train';
    const cap = isBulletTrain ? 0 : (VEHICLE_CAPACITY[t.vehicle] || t.capacity || 12);
    const sellTotal = t.sellTotal || 0;
    const vendorTotal = t.vendorTotal || 0;
    const profit = t.profit || 0;

    const subLabel = isBulletTrain 
      ? `<b>🚄 ${esc(t.vehicle)}</b> · ${esc(t.trainClass || 'Economy')} Class`
      : `<b>🚐 ${esc(t.vehicle)}</b> (${cap} seats) · ${t.priceType === 'per_vehicle' ? `${t.vehicleCount || 1} vehicle` : `${paxAdult + paxChild} pax`}`;

    return `<div class="item-card">
      <div class="item-card-head">
        <span class="lbl">Transport ${i + 1} ${isBulletTrain ? '🚄' : ''}</span>
        <button class="remove-btn" onclick="removeTransportItem(${t.id})">✕</button>
      </div>

      <div class="field" style="margin-bottom:14px">
        <label>Select Route</label>
        <select onchange="onTransportItemChange(${t.id},this.value)" data-selected="${t.transportId || ''}">
          <option value="">-- Choose Route --</option>${opts}
        </select>
      </div>

      ${t.transportId ? `
        <div style="padding:10px 12px;background:var(--bg-2);border-radius:10px;margin-bottom:12px;font-size:11.5px">
          ${subLabel}
        </div>
        ${renderPackageItemVendorSelect('transport', t)}

        ${isBulletTrain ? `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
            <div style="padding:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center">
              <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:800">Adult</div>
              <div style="font-size:11px;font-weight:700;margin-top:2px">${paxAdult} × ${fmt(t.adultSell||0)}</div>
            </div>
            <div style="padding:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center">
              <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:800">Child</div>
              <div style="font-size:11px;font-weight:700;margin-top:2px">${paxChild} × ${fmt(t.childSell||0)}</div>
            </div>
            <div style="padding:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center">
              <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:800">Infant</div>
              <div style="font-size:11px;font-weight:700;margin-top:2px">${paxInfant} × ${fmt(t.infantSell||0)}</div>
            </div>
          </div>
        ` : `
          <div class="grid-3">
            <div class="field">
              <label>🏢 Vendor Cost / ${t.priceType === 'per_vehicle' ? 'Vehicle' : 'Person'}</label>
              <input class="transport-number-input transport-vendor-input" type="number" value="${t.vendorCost || ''}" readonly title="Fixed vendor cost">
            </div>
            <div class="field">
              <label>💵 Sell Price / ${t.priceType === 'per_vehicle' ? 'Vehicle' : 'Person'}</label>
              <input class="transport-number-input transport-sell-input" type="number" value="${t.sellPrice || ''}" placeholder="0"
                     onchange="updateTransportItemField(${t.id},'sellPrice',this.value)" min="0">
            </div>
            <div class="field">
              <label>Vehicle Count</label>
              <input class="transport-number-input transport-count-input" type="number" value="${t.vehicleCount || 1}"
                     onchange="updateTransportItemField(${t.id},'vehicleCount',this.value)" min="1" ${t.priceType === 'per_person' ? 'disabled' : ''}>
            </div>
          </div>
        `}

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px">
          <div style="padding:10px 12px;background:var(--blue-bg);border-radius:8px;text-align:center">
            <div style="font-size:9.5px;color:var(--blue);font-weight:800;text-transform:uppercase">Vendor Cost</div>
            <div style="font-size:15px;font-weight:900;color:var(--blue);margin-top:2px">${fmt(vendorTotal)}</div>
          </div>
          <div style="padding:10px 12px;background:var(--primary-bg);border-radius:8px;text-align:center">
            <div style="font-size:9.5px;color:var(--primary);font-weight:800;text-transform:uppercase">Sell Price</div>
            <div style="font-size:15px;font-weight:900;color:var(--primary);margin-top:2px">${fmt(sellTotal)}</div>
          </div>
          <div style="padding:10px 12px;background:${profit >= 0 ? 'var(--green-bg)' : 'var(--red-bg)'};border-radius:8px;text-align:center">
            <div style="font-size:9.5px;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:800;text-transform:uppercase">Profit</div>
            <div style="font-size:15px;font-weight:900;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};margin-top:2px">${profit >= 0 ? '+' : ''}${fmt(profit)}</div>
          </div>
        </div>
      ` : ''}
    </div>`;
  }).join('');

  transportItems.forEach(t => {
    if (t.transportId) {
      const sel = el.querySelector(`select[data-selected="${t.transportId}"]`);
      if (sel) sel.value = t.transportId;
    }
  });
}