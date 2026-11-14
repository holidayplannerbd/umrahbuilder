/* ============================================================
   UMRAH BUILDER — MASTERS / TRANSPORTS (v7 — Fixed)
   ============================================================ */

/* ==================== VEHICLE CHANGE ==================== */
function onVehicleChange() {
  const v = $('tsVehicle')?.value || 'Hiace';
  const isBullet = v === 'Bullet Train';

  // Bullet Train হলে Passenger Pricing দেখাবে, Standard Pricing লুকাবে
  if ($('tsPassengerPricing')) $('tsPassengerPricing').style.display = isBullet ? 'block' : 'none';
  if ($('tsStandardPricing')) $('tsStandardPricing').style.display = isBullet ? 'none' : 'block';
  if ($('tsTrainClassField')) $('tsTrainClassField').style.display = isBullet ? 'block' : 'none';

  // From/To টগল করা (Bullet হলে Select, না হলে Text Input)
  if ($('tsFromSelect')) $('tsFromSelect').style.display = isBullet ? 'block' : 'none';
  if ($('tsFrom')) $('tsFrom').style.display = isBullet ? 'none' : 'block';
  
  if ($('tsToSelect')) $('tsToSelect').style.display = isBullet ? 'block' : 'none';
  if ($('tsTo')) $('tsTo').style.display = isBullet ? 'none' : 'block';

  if (!isBullet && $('tsCapacity')) {
    const cap = VEHICLE_CAPACITY[v] || 12;
    $('tsCapacity').value = cap;
  }
}

/* ⭐ Route Inputs সিঙ্ক করা (Select থেকে Text-এ) */
function syncRouteInputs() {
  if ($('tsFromSelect') && $('tsFrom')) $('tsFrom').value = $('tsFromSelect').value;
  if ($('tsToSelect') && $('tsTo')) $('tsTo').value = $('tsToSelect').value;
}

/* ==================== OPEN SETUP ==================== */
function openTransportSetup(editId = null) {
  if (editId) {
    const t = STORE.transports.find(x => x.id === editId);
    if (t) {
      $('transportModalTitle').textContent = '✏️ Edit Transport';
      $('tsEditId').value = editId;
      
      // Vehicle সেট করা এবং লজিক আপডেট
      if ($('tsVehicle')) $('tsVehicle').value = t.vehicle || 'Hiace';
      setTimeout(() => onVehicleChange(), 50);

      // Route সেট করা
      if (t.vehicle === 'Bullet Train') {
        if ($('tsFromSelect')) $('tsFromSelect').value = t.from || 'Makkah';
        if ($('tsToSelect')) $('tsToSelect').value = t.to || 'Madinah';
        syncRouteInputs();
      } else {
        if ($('tsFrom')) $('tsFrom').value = t.from || '';
        if ($('tsTo')) $('tsTo').value = t.to || '';
      }
      
      // Class & Pricing
      if ($('tsTrainClass')) $('tsTrainClass').value = t.trainClass || 'Economy';

      if (t.vehicle === 'Bullet Train') {
        $('tsAdultSell').value = t.adultSell || 0;
        $('tsAdultCost').value = t.adultCost || 0;
        $('tsChildSell').value = t.childSell || 0;
        $('tsChildCost').value = t.childCost || 0;
        $('tsInfantSell').value = t.infantSell || 0;
        $('tsInfantCost').value = t.infantCost || 0;
      } else {
        if ($('tsCapacity')) $('tsCapacity').value = t.capacity || 12;
        if ($('tsPriceType')) $('tsPriceType').value = t.priceType || 'per_vehicle';
        if ($('tsVehicleCount')) $('tsVehicleCount').value = t.vehicleCount || 1;
        if ($('tsPrice')) $('tsPrice').value = t.sellPrice !== undefined ? t.sellPrice : (t.price || '');
        if ($('tsVendorCost')) $('tsVendorCost').value = t.vendorCost !== undefined ? t.vendorCost : (t.price || '');
      }
    }
  } else {
    $('transportModalTitle').textContent = '▣ Add Transport';
    $('tsEditId').value = '';
    
    // ডিফল্ট সেটআপ
    if ($('tsVehicle')) $('tsVehicle').value = 'Hiace';
    setTimeout(() => onVehicleChange(), 50);
    
    if ($('tsFrom')) $('tsFrom').value = '';
    if ($('tsTo')) $('tsTo').value = '';
    if ($('tsFromSelect')) $('tsFromSelect').value = 'Makkah';
    if ($('tsToSelect')) $('tsToSelect').value = 'Madinah';
    syncRouteInputs();
    
    if ($('tsPrice')) $('tsPrice').value = '';
    if ($('tsVendorCost')) $('tsVendorCost').value = '';
    if ($('tsAdultSell')) $('tsAdultSell').value = 0;
    if ($('tsAdultCost')) $('tsAdultCost').value = 0;
    if ($('tsChildSell')) $('tsChildSell').value = 0;
    if ($('tsChildCost')) $('tsChildCost').value = 0;
    if ($('tsInfantSell')) $('tsInfantSell').value = 0;
    if ($('tsInfantCost')) $('tsInfantCost').value = 0;
    if ($('tsTrainClass')) $('tsTrainClass').value = 'Economy';
    
    if ($('tsCapacity')) $('tsCapacity').disabled = false;
    if ($('tsPriceType')) $('tsPriceType').disabled = false;
    if ($('tsVehicleCount')) $('tsVehicleCount').disabled = false;
  }
  clearAllErrors();
  openModal('transportSetupModal');
}

/* ==================== SAVE ==================== */
async function saveTransportSetup() {
  clearAllErrors();
  
  // From/To ভ্যালু সংগ্রহ (Select বা Input যেটাই হোক)
  const from = $('tsFrom').value.trim();
  const to = $('tsTo').value.trim();
  
  const vehicle = $('tsVehicle').value;
  const isBullet = vehicle === 'Bullet Train';
  const editId = $('tsEditId').value;

  if (!from || !to) { toast('From & To required', 'error'); return; }

  showLoading('Saving...');
  try {
    let data = {
      id: editId ? parseInt(editId) : Date.now(),
      from, to, vehicle,
      createdAt: editId ? (STORE.transports.find(x => x.id === parseInt(editId))?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };

    if (isBullet) {
      data = {
        ...data,
        trainClass: $('tsTrainClass').value,
        adultSell: parseFloat($('tsAdultSell').value) || 0,
        adultCost: parseFloat($('tsAdultCost').value) || 0,
        childSell: parseFloat($('tsChildSell').value) || 0,
        childCost: parseFloat($('tsChildCost').value) || 0,
        infantSell: parseFloat($('tsInfantSell').value) || 0,
        infantCost: parseFloat($('tsInfantCost').value) || 0,
        capacity: 0,
        priceType: 'per_person',
        vehicleCount: 1,
        price: parseFloat($('tsAdultSell').value) || 0,
        vendorCost: parseFloat($('tsAdultCost').value) || 0
      };
    } else {
      const legacyPrice = parseFloat($('tsPrice')?.value) || 0;
      const vendorCost = parseFloat($('tsVendorCost')?.value) || legacyPrice;
      data = {
        ...data,
        capacity: VEHICLE_CAPACITY[vehicle] || parseInt($('tsCapacity').value) || 12,
        priceType: $('tsPriceType').value || 'per_vehicle',
        vehicleCount: parseInt($('tsVehicleCount').value) || 1,
        price: legacyPrice,
        vendorCost: vendorCost,
        sellPrice: legacyPrice
      };
    }

    await dbSave(STORES.transports, data);
    STORE.transports = await dbGetAll(STORES.transports);
    hideLoading();
    closeModal('transportSetupModal');
    renderTransportsTable();
    updateSidebarBadges();
    toast(editId ? '✅ Transport updated' : '✅ Transport saved');
  } catch (e) {
    hideLoading();
    toast('Save failed: ' + e.message, 'error');
  }
}

/* ==================== DELETE ==================== */
function deleteTransport(id) {
  const t = STORE.transports.find(x => x.id === id);
  if (!t) return;
  confirmDelete(`Delete route "${t.from} → ${t.to}"?`, async () => {
    const idx = STORE.transports.findIndex(x => x.id === id);
    if (idx < 0) return;
    STORE.transports.splice(idx, 1);
    await dbDelete(STORES.transports, id);
    STORE.transports = await dbGetAll(STORES.transports);
    renderTransportsTable();
    updateSidebarBadges();
    toast('Transport deleted', 'warning');
  });
}

/* ==================== RENDER TABLE ==================== */
function renderTransportsTable() {
  const el = $('transportsTable');
  if (!el) return;

  let list = STORE.transports.slice();

  // সার্চ ফিল্টার
  const searchEl = $('trSearchInput');
  const search = searchEl ? searchEl.value.trim().toLowerCase() : '';
  if (search) {
    list = list.filter(t => 
      (t.from || '').toLowerCase().includes(search) || 
      (t.to || '').toLowerCase().includes(search) ||
      `${t.from} → ${t.to}`.toLowerCase().includes(search)
    );
  }

  // ভেহিকেল ফিল্টার
  const typeEl = $('trTypeFilter');
  const type = typeEl ? typeEl.value : 'all';
  if (type !== 'all') {
    list = list.filter(t => t.vehicle === type);
  }

  // রেজাল্ট কাউন্ট
  const countEl = $('trResultsCount');
  if (countEl) countEl.innerHTML = `<span>${list.length}</span> Vehicles Found`;

  if (!list.length) {
    el.innerHTML = '<div class="empty" style="grid-column:1/-1;text-align:center;padding:40px"><div class="ic">▣</div><div class="tx">No transport routes found</div></div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead>
      <tr>
        <th>Route</th>
        <th>Vehicle</th>
        <th>Capacity / Class</th>
        <th>Pricing</th>
        <th>Vendor Cost</th>
        <th>Sell Price</th>
        <th>Profit</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${list.map(t => {
      const isBullet = t.vehicle === 'Bullet Train';
      
      let vendorCost = 0, sellPrice = 0, profit = 0;
      let pricingLabel = '', capacityLabel = '—';

      if (isBullet) {
        vendorCost = (t.adultCost || 0) + (t.childCost || 0) + (t.infantCost || 0);
        sellPrice = (t.adultSell || 0) + (t.childSell || 0) + (t.infantSell || 0);
        profit = sellPrice - vendorCost;
        pricingLabel = 'Per Person';
        capacityLabel = `${t.trainClass || 'Economy'} Class`;
      } else {
        vendorCost = Number(t.vendorCost !== undefined ? t.vendorCost : (t.price || 0));
        sellPrice = Number(t.sellPrice !== undefined ? t.sellPrice : (t.price || 0));
        profit = sellPrice - vendorCost;
        pricingLabel = t.priceType === 'per_vehicle' ? 'Per Vehicle' : 'Per Person';
        capacityLabel = `${t.capacity || VEHICLE_CAPACITY[t.vehicle] || '—'} seats`;
      }

      return `<tr>
        <td><div class="cell-main">${esc(t.from)} → ${esc(t.to)}</div></td>
        <td>${isBullet ? '🚄 ' : ''}${esc(t.vehicle)}</td>
        <td>${capacityLabel}</td>
        <td><span class="pill ${pricingLabel === 'Per Vehicle' ? 'confirmed' : 'quoted'}">${pricingLabel}</span></td>
        <td style="color:var(--blue);font-weight:800">${fmt(vendorCost)}</td>
        <td style="color:var(--primary);font-weight:800">${fmt(sellPrice)}</td>
        <td style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:800">${profit >= 0 ? '+' : ''}${fmt(profit)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm btn-ghost btn-icon" onclick="openTransportSetup(${t.id})">✏️</button>
          <button class="btn btn-sm btn-ghost btn-icon" onclick="quickAddTransport(${t.id})">➕</button>
          <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteTransport(${t.id})">🗑️</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}