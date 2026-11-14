/* ============================================================
   UMRAH BUILDER — MASTERS / VENDORS (v5 — Amount Fix)
   ⭐ Payment amount editable — no auto-override
   ⭐ Vendor · Hotel Allocation · Live summary
   ============================================================ */

/* vendorSearchQuery, vendorItemCounter, vendorItemsDraft,
   currentVendorType, currentViewVendorId declared in state.js */

function searchVendors(q) {
  vendorSearchQuery = String(q || '').toLowerCase();
  renderVendorsTable();
}

/* ==================== VENDOR TYPE CONFIG ==================== */
function getVendorTypeConfig(type) {
  const configs = {
    hotel: { title: '🕌 Hotel Rates (Vendor Actual Cost)', addLabel: '➕ Add Hotel', itemLabel: 'Hotel', icon: '🏨' },
    transport: { title: '▣ Transport Routes (Vendor Cost)', addLabel: '➕ Add Route', itemLabel: 'Route', icon: '🚐' },
    visa: { title: '▤ Visa Rates (Vendor Actual Cost)', addLabel: '➕ Add Visa', itemLabel: 'Visa', icon: '▤' },
    ziyarah: { title: '★ Ziyarah Car Rates (Vendor Cost)', addLabel: '➕ Add Ziyarah', itemLabel: 'Ziyarah', icon: '★' },
    service: { title: '▦ Service Rates (Vendor Cost)', addLabel: '➕ Add Service', itemLabel: 'Service', icon: '▦' },
    other: { title: '📦 Additional Notes', addLabel: null, itemLabel: 'Note', icon: '📦' }
  };
  return configs[type] || configs.other;
}

function onVendorTypeChange() {
  const type = $('vendType')?.value || 'hotel';
  currentVendorType = type;
  const cfg = getVendorTypeConfig(type);

  if ($('vendorRatesTitle')) $('vendorRatesTitle').textContent = cfg.title;

  if ($('vendorAddBtn')) {
    if (cfg.addLabel) {
      $('vendorAddBtn').style.display = 'inline-flex';
      $('vendorAddBtn').textContent = cfg.addLabel;
      $('vendorAddBtn').onclick = addVendorItem;
    } else {
      $('vendorAddBtn').style.display = 'none';
    }
  }
  if ($('vendorRatesSection')) {
    $('vendorRatesSection').style.display = type === 'other' ? 'none' : 'block';
  }
  renderVendorItems();
}

/* ==================== OPEN VENDOR SETUP ==================== */
function openVendorSetup(editId = null) {
  vendorItemsDraft = [];
  vendorItemCounter = 0;

  if (editId) {
    const v = STORE.vendors.find(x => x.id === editId);
    if (v) {
      $('vendorModalTitle').textContent = '✏️ Edit Vendor';
      $('vendEditId').value = editId;
      $('vendName').value = v.name || '';
      $('vendType').value = v.type || 'hotel';
      $('vendContact').value = v.contact || '';
      $('vendPhone').value = v.phone || '';
      $('vendEmail').value = v.email || '';
      $('vendAddress').value = v.address || '';
      $('vendNotes').value = v.notes || '';
      const savedItems = [
        ...(Array.isArray(v.items) ? v.items : []),
        ...(Array.isArray(v.hotels) ? v.hotels : [])
      ];
      const seenItemIds = new Set();
      vendorItemsDraft = JSON.parse(JSON.stringify(savedItems.filter(item => {
        const key = item?.id == null ? item : `id:${item.id}`;
        if (seenItemIds.has(key)) return false;
        seenItemIds.add(key);
        return true;
      })));
      vendorItemCounter = Math.max(0, ...vendorItemsDraft.map(h => h.id || 0));
      currentVendorType = v.type || 'hotel';

      if (currentVendorType === 'transport') {
        vendorItemsDraft = vendorItemsDraft.map(t => ({
          ...t,
          vendorCost: t.vendorCost !== undefined ? t.vendorCost : (t.price || 0),
          sellPrice: t.sellPrice !== undefined ? t.sellPrice : (t.price || 0)
        }));
      }
    }
  } else {
    $('vendorModalTitle').textContent = '🏢 Add Vendor';
    ['vendName', 'vendContact', 'vendPhone', 'vendEmail', 'vendAddress', 'vendNotes'].forEach(id => setVal(id, ''));
    setVal('vendType', 'hotel');
    setVal('vendEditId', '');
    currentVendorType = 'hotel';
  }
  onVendorTypeChange();
  clearAllErrors();
  openModal('vendorSetupModal');
}

/* ==================== ADD/REMOVE/UPDATE ITEMS ==================== */
function addVendorItem() {
  vendorItemCounter++;
  const type = currentVendorType;
  const base = { id: vendorItemCounter };
  let item = { ...base };

  if (type === 'hotel') {
    item = { ...item, name: '', city: 'Makkah', distance: '', star: 4, quad: 0, triple: 0, double: 0, single: 0, breakfast: 0, halfBoard: 0, fullBoard: 0 };
  } else if (type === 'transport') {
    item = { ...item, from: '', to: '', vehicle: 'Hiace', capacity: 12, priceType: 'per_vehicle', vehicleCount: 1, price: 0 };
  } else if (type === 'visa') {
    item = { ...item, name: '', validity: 90, priceAdult: 0, priceChild: 0, priceInfant: 0 };
  } else if (type === 'ziyarah') {
    item = { ...item, name: '', city: 'Makkah', duration: '', sedan: 0, '7seater': 0, hiace: 0, coaster: 0 };
  } else if (type === 'service') {
    item = { ...item, name: '', priceType: 'per_person', price: 0 };
  }
  vendorItemsDraft.push(item);
  renderVendorItems();
}

function removeVendorItem(id) {
  vendorItemsDraft = vendorItemsDraft.filter(h => h.id !== id);
  renderVendorItems();
}

function updateVendorItem(id, field, value) {
  const h = vendorItemsDraft.find(x => x.id === id);
  if (!h) return;

  const numericFields = [
    'quad', 'triple', 'double', 'single', 'breakfast', 'halfBoard', 'fullBoard',
    'price', 'priceAdult', 'priceChild', 'priceInfant',
    'vendorCost', 'sellPrice', 'actualCost', 'sellingPrice',
    'sedan', '7seater', 'hiace', 'coaster',
    'capacity', 'vehicleCount', 'validity'
  ];

  if (numericFields.includes(field)) {
    h[field] = Math.max(0, parseFloat(value) || 0);
  } else if (field === 'star') {
    h.star = parseInt(value) || 4;
  } else {
    h[field] = value;
  }

  if (field === 'vendorCost' || field === 'sellPrice') {
    renderVendorItems();
  }
}

/* ==================== RENDER VENDOR ITEMS ==================== */
function renderVendorItems() {
  const el = $('vendorItemsList');
  if (!el) return;
  const type = currentVendorType;

  if (!vendorItemsDraft.length) {
    const cfg = getVendorTypeConfig(type);
    el.innerHTML = `<div class="empty-slot" style="padding:20px"><span class="ic">${cfg.icon}</span>No ${cfg.itemLabel.toLowerCase()} added</div>`;
    return;
  }

  if (type === 'hotel') {
    el.innerHTML = vendorItemsDraft.map((h, i) => `
      <div class="vendor-item">
        <div class="vendor-item-head">
          <div class="title">🏨 Hotel ${i + 1}</div>
          <button class="remove-btn" onclick="removeVendorItem(${h.id})">✕</button>
        </div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field"><label>Hotel Name</label><input type="text" value="${esc(h.name)}" onchange="updateVendorItem(${h.id},'name',this.value)"></div>
          <div class="field"><label>City</label>
            <select onchange="updateVendorItem(${h.id},'city',this.value)">
              <option value="Makkah" ${h.city === 'Makkah' ? 'selected' : ''}>Makkah</option>
              <option value="Madinah" ${h.city === 'Madinah' ? 'selected' : ''}>Madinah</option>
            </select>
          </div>
          <div class="field"><label>Distance</label><input type="text" value="${esc(h.distance)}" onchange="updateVendorItem(${h.id},'distance',this.value)"></div>
          <div class="field"><label>Star</label>
            <select onchange="updateVendorItem(${h.id},'star',this.value)">
              <option value="3" ${h.star === 3 ? 'selected' : ''}>3 Star</option>
              <option value="4" ${h.star === 4 ? 'selected' : ''}>4 Star</option>
              <option value="5" ${h.star === 5 ? 'selected' : ''}>5 Star</option>
            </select>
          </div>
        </div>
        <div class="section-divider">Vendor Room Cost (Per Night)</div>
        <div class="room-rate-grid" style="margin-bottom:12px">
          <div class="room-rate-card"><div class="rr-head">Quad</div><input type="number" value="${h.quad || ''}" onchange="updateVendorItem(${h.id},'quad',this.value)"></div>
          <div class="room-rate-card"><div class="rr-head">Triple</div><input type="number" value="${h.triple || ''}" onchange="updateVendorItem(${h.id},'triple',this.value)"></div>
          <div class="room-rate-card"><div class="rr-head">Double</div><input type="number" value="${h.double || ''}" onchange="updateVendorItem(${h.id},'double',this.value)"></div>
          <div class="room-rate-card"><div class="rr-head">Single</div><input type="number" value="${h.single || ''}" onchange="updateVendorItem(${h.id},'single',this.value)"></div>
        </div>
        <div class="section-divider">Vendor Meal Cost (Per Person)</div>
        <div class="grid-3">
          <div class="field"><label>🍳 Breakfast</label><input type="number" value="${h.breakfast || ''}" onchange="updateVendorItem(${h.id},'breakfast',this.value)"></div>
          <div class="field"><label>🍱 Half Board</label><input type="number" value="${h.halfBoard || ''}" onchange="updateVendorItem(${h.id},'halfBoard',this.value)"></div>
          <div class="field"><label>🍽️ Full Board</label><input type="number" value="${h.fullBoard || ''}" onchange="updateVendorItem(${h.id},'fullBoard',this.value)"></div>
        </div>
      </div>
    `).join('');
  } else if (type === 'transport') {
    el.innerHTML = vendorItemsDraft.map((t, i) => `
      <div class="vendor-item">
        <div class="vendor-item-head"><div class="title">🚐 Route ${i + 1}</div><button class="remove-btn" onclick="removeVendorItem(${t.id})">✕</button></div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field"><label>From</label><input type="text" value="${esc(t.from)}" onchange="updateVendorItem(${t.id},'from',this.value)"></div>
          <div class="field"><label>To</label><input type="text" value="${esc(t.to)}" onchange="updateVendorItem(${t.id},'to',this.value)"></div>
          <div class="field"><label>Vehicle</label>
            <select onchange="updateVendorItem(${t.id},'vehicle',this.value)">
              <option value="Sedan" ${t.vehicle === 'Sedan' ? 'selected' : ''}>Sedan (4)</option>
              <option value="7-Seater" ${t.vehicle === '7-Seater' ? 'selected' : ''}>7-Seater</option>
              <option value="Hiace" ${t.vehicle === 'Hiace' ? 'selected' : ''}>Hiace (12)</option>
              <option value="GMC" ${t.vehicle === 'GMC' ? 'selected' : ''}>GMC (7)</option>
              <option value="Coaster" ${t.vehicle === 'Coaster' ? 'selected' : ''}>Coaster (22)</option>
            </select>
          </div>
          <div class="field"><label>Price (৳)</label><input type="number" value="${t.price || ''}" onchange="updateVendorItem(${t.id},'price',this.value)"></div>
        </div>
      </div>
    `).join('');
  } else if (type === 'visa') {
    el.innerHTML = vendorItemsDraft.map((v, i) => `
      <div class="vendor-item">
        <div class="vendor-item-head"><div class="title">▤ Visa ${i + 1}</div><button class="remove-btn" onclick="removeVendorItem(${v.id})">✕</button></div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field"><label>Visa Type</label><input type="text" value="${esc(v.name)}" onchange="updateVendorItem(${v.id},'name',this.value)"></div>
          <div class="field"><label>Validity (Days)</label><input type="number" value="${v.validity || 90}" onchange="updateVendorItem(${v.id},'validity',this.value)"></div>
        </div>
        <div class="section-divider">Vendor Actual Cost</div>
        <div class="grid-3">
          <div class="field"><label>Adult Cost</label><input type="number" value="${v.priceAdult || ''}" onchange="updateVendorItem(${v.id},'priceAdult',this.value)"></div>
          <div class="field"><label>Child Cost</label><input type="number" value="${v.priceChild || ''}" onchange="updateVendorItem(${v.id},'priceChild',this.value)"></div>
          <div class="field"><label>Infant Cost</label><input type="number" value="${v.priceInfant || ''}" onchange="updateVendorItem(${v.id},'priceInfant',this.value)"></div>
        </div>
      </div>
    `).join('');
  } else if (type === 'ziyarah') {
    el.innerHTML = vendorItemsDraft.map((z, i) => `
      <div class="vendor-item">
        <div class="vendor-item-head"><div class="title">★ Ziyarah ${i + 1}</div><button class="remove-btn" onclick="removeVendorItem(${z.id})">✕</button></div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field"><label>Ziyarah Name</label><input type="text" value="${esc(z.name)}" onchange="updateVendorItem(${z.id},'name',this.value)"></div>
          <div class="field"><label>City</label>
            <select onchange="updateVendorItem(${z.id},'city',this.value)">
              <option value="Makkah" ${z.city === 'Makkah' ? 'selected' : ''}>Makkah</option>
              <option value="Madinah" ${z.city === 'Madinah' ? 'selected' : ''}>Madinah</option>
            </select>
          </div>
        </div>
        <div class="section-divider">Vendor Car Cost</div>
        <div class="grid-4">
          <div class="field"><label>🚗 Sedan</label><input type="number" value="${z.sedan || ''}" onchange="updateVendorItem(${z.id},'sedan',this.value)"></div>
          <div class="field"><label>🚐 7-Seater</label><input type="number" value="${z['7seater'] || ''}" onchange="updateVendorItem(${z.id},'7seater',this.value)"></div>
          <div class="field"><label>🚐 Hiace</label><input type="number" value="${z.hiace || ''}" onchange="updateVendorItem(${z.id},'hiace',this.value)"></div>
          <div class="field"><label>🚌 Coaster</label><input type="number" value="${z.coaster || ''}" onchange="updateVendorItem(${z.id},'coaster',this.value)"></div>
        </div>
      </div>
    `).join('');
  } else if (type === 'service') {
    el.innerHTML = vendorItemsDraft.map((s, i) => `
      <div class="vendor-item">
        <div class="vendor-item-head"><div class="title">▦ Service ${i + 1}</div><button class="remove-btn" onclick="removeVendorItem(${s.id})">✕</button></div>
        <div class="grid-3">
          <div class="field"><label>Name</label><input type="text" value="${esc(s.name)}" onchange="updateVendorItem(${s.id},'name',this.value)"></div>
          <div class="field"><label>Type</label>
            <select onchange="updateVendorItem(${s.id},'type',this.value)">
              <option value="per_person" ${s.priceType === 'per_person' ? 'selected' : ''}>Per Person</option>
              <option value="per_group" ${s.priceType === 'per_group' ? 'selected' : ''}>Per Group</option>
            </select>
          </div>
          <div class="field"><label>Price (৳)</label><input type="number" value="${s.price || ''}" onchange="updateVendorItem(${s.id},'price',this.value)"></div>
        </div>
      </div>
    `).join('');
  }
}

/* ==================== SAVE VENDOR (with auto-link) ==================== */
async function saveVendorSetup() {
  clearAllErrors();
  const name = strVal('vendName');
  const editId = strVal('vendEditId');

  if (!name) {
    setError('vendName', 'Name required');
    toast('Name required', 'error');
    return;
  }

  showLoading('Saving...');
  try {
    const existing = editId ? STORE.vendors.find(x => x.id === parseInt(editId)) : null;
    const type = strVal('vendType', 'hotel');
    const vendorId = editId ? parseInt(editId) : Date.now();

    const data = {
      id: vendorId,
      name, type,
      contact: strVal('vendContact'),
      phone: strVal('vendPhone'),
      email: strVal('vendEmail'),
      address: strVal('vendAddress'),
      notes: strVal('vendNotes'),
      items: JSON.parse(JSON.stringify(vendorItemsDraft)),
      hotels: type === 'hotel' ? JSON.parse(JSON.stringify(vendorItemsDraft)) : (existing?.hotels || []),
      payments: existing?.payments || [],
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await dbSave(STORES.vendors, data);
    STORE.vendors = await dbGetAll(STORES.vendors);

    /* Auto-link vendor hotel items to master hotels */
    if (type === 'hotel' && vendorItemsDraft.length > 0) {
      let linkedCount = 0, createdCount = 0;
      for (const vh of vendorItemsDraft) {
        if (!vh.name || !vh.name.trim()) continue;
        const city = (vh.city || 'Makkah').toLowerCase();
        const masterList = city === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels;
        const storeName = city === 'makkah' ? STORES.makkahHotels : STORES.madinahHotels;

        const targetName = normalizeHotelName(vh.name);
        const match = masterList.find(m => normalizeHotelName(m.name) === targetName);

        if (match) {
          if (String(match.vendorId) !== String(vendorId) ||
              String(match.vendorHotelItemId || '') !== String(vh.id)) {
            match.vendorId = vendorId;
            match.vendorHotelItemId = vh.id;
            match.updatedAt = Date.now();
            await dbSave(storeName, match);
            linkedCount++;
          }
        } else {
          const newHotel = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            city: vh.city || 'Makkah',
            cityType: city,
            name: vh.name,
            distance: vh.distance || '',
            star: vh.star || 4,
            quad: 0, triple: 0, double: 0, single: 0,
            breakfast: 0, halfBoard: 0, fullBoard: 0,
            validFrom: '', validUntil: '',
            vendorId: vendorId,
            vendorHotelItemId: vh.id,
            imageIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await dbSave(storeName, newHotel);
          createdCount++;
        }
      }
      STORE.makkahHotels = await dbGetAll(STORES.makkahHotels);
      STORE.madinahHotels = await dbGetAll(STORES.madinahHotels);
      if (linkedCount > 0 || createdCount > 0) {
        toast(`🔗 ${linkedCount} linked · ${createdCount} auto-created hotels`);
      }
    }

    hideLoading();
    closeModal('vendorSetupModal');
    renderVendorsTable();
    if (typeof refreshBuilderHotelVendorRates === 'function') refreshBuilderHotelVendorRates();
    toast(editId ? '✅ Vendor updated' : '✅ Vendor saved');
  } catch (e) {
    hideLoading();
    toast('Save failed: ' + e.message, 'error');
  }
}

/* ==================== DELETE VENDOR ==================== */
function deleteVendor(id) {
  const v = STORE.vendors.find(x => x.id === id);
  if (!v) return;
  confirmDelete(`Delete vendor "${v.name}"?`, async () => {
    STORE.vendors = STORE.vendors.filter(x => x.id !== id);
    await dbDelete(STORES.vendors, id);
    STORE.vendors = await dbGetAll(STORES.vendors);
    renderVendorsTable();
    toast('Vendor deleted', 'warning');
  });
}

/* ==================== VENDOR TOTALS ==================== */
/* ==================== READABLE ITEM NAME GENERATOR ==================== */
function getReadableItemName(item, category) {
  if (!item) return '—';
  const cat = (category || '').toLowerCase();

  if (cat === 'transport') {
    const vehicle = item.vehicle || item.car || 'Vehicle';
    const label = vehicle.charAt(0).toUpperCase() + vehicle.slice(1);
    const from = item.from || item.pickup || '—';
    const to   = item.to   || item.drop   || '—';
    return `${from} → ${to} (${label})`;
  }
  if (cat === 'hotel') {
    const city = item.city ? item.city.charAt(0).toUpperCase() + item.city.slice(1) : '';
    const name = item.name || item.hotelName || '—';
    return `${name} ${city ? '— ' + city : ''}`.trim();
  }
  if (cat === 'flight') {
    return `${item.from || '—'} → ${item.to || '—'} ${item.airline ? '· ' + item.airline : ''}`;
  }
  return item.name || item.title || '—';
}

function getPackageVendorItemCost(pkg, item, category) {
  if (!pkg || !item) return 0;

  const paxAdult = Number(pkg.paxAdult || 0);
  const paxChild = Number(pkg.paxChild || 0);
  const paxInfant = Number(pkg.paxInfant || 0);
  const paxChargeable = paxAdult + paxChild;

  if (category === 'transport') {
    if (item.vendorTotal !== undefined && item.vendorTotal !== null) {
      return Math.max(0, Number(item.vendorTotal) || 0);
    }
    const vendorPer = Number(item.vendorCost !== undefined ? item.vendorCost : (item.price || 0));
    return Math.max(0, vendorPer * Math.max(1, Number(item.currentMultiplier) || 1));
  }
  if (category === 'visa') {
    return Math.max(0,
      Number(item.costAdult || 0) * paxAdult +
      Number(item.costChild || 0) * paxChild +
      Number(item.costInfant || 0) * paxInfant
    );
  }
  if (category === 'service') {
    const multiplier = item.priceType === 'per_group' ? 1 : paxChargeable;
    return Math.max(0, Number(item.price || 0) * multiplier);
  }
  if (category === 'ziyarah') {
    return Math.max(0, Number(item.price || 0) * Number(item.cars || 1));
  }
  return 0;
}

function isVendorItemPayment(payment, pkg, item, category, itemIndex) {
  if (String(payment.packageId) !== String(pkg.id) || payment.category !== category) return false;
  const allocationKey = String(payment.allocationKey || '');
  if (allocationKey.startsWith('item:')) return allocationKey === `item:${item.paymentItemId}`;
  if (allocationKey && !allocationKey.startsWith('item_')) return false;
  if (!payment.itemName) return false;
  if (payment.itemName !== getReadableItemName(item, category)) return false;
  const itemsField = { transport: 'transports', visa: 'visas', service: 'services', ziyarah: 'ziyarahTransport' }[category];
  const items = pkg[itemsField] || [];
  return items.findIndex(candidate => getReadableItemName(candidate, category) === payment.itemName) === itemIndex;
}

function getVendorItemPaid(pkg, vendorId, category, item, itemIndex) {
  const vendor = STORE.vendors.find(v => String(v.id) === String(vendorId));
  if (!vendor || !item) return 0;
  return (vendor.payments || []).reduce((sum, payment) =>
    sum + (isVendorItemPayment(payment, pkg, item, category, itemIndex)
      ? Number(payment.amount || 0)
      : 0), 0);
}

function getPackageVendorItemLedger(pkg) {
  const ledgerByVendor = {};
  if (!pkg) return ledgerByVendor;

  const addEntry = (vendorId, entry) => {
    if (vendorId === null || vendorId === undefined) return;
    const key = String(vendorId);
    if (!ledgerByVendor[key]) ledgerByVendor[key] = [];
    const cost = Number(entry.cost || 0);
    const paid = Number(entry.paid || 0);
    ledgerByVendor[key].push({
      packageId: pkg.id,
      packageName: pkg.name || 'Untitled',
      refNo: pkg.refNo || '',
      ...entry,
      cost,
      paid,
      due: entry.due !== undefined ? Number(entry.due) : Math.max(0, cost - paid)
    });
  };

  if (typeof getPackageHotelVendorBreakdown === 'function') {
    try {
      getPackageHotelVendorBreakdown(pkg).forEach(row => {
        if (!row.vendorId) return;
        addEntry(row.vendorId, {
          category: 'hotel',
          itemName: `${row.city} · ${row.hotelName}`,
          cost: row.cost,
          paid: getVendorHotelPaid(pkg.id, row.vendorId, row.key)
        });
      });
    } catch (e) {}
  }

  const hotelGeneralPayments = new Map();
  STORE.vendors.forEach(vendor => (vendor.payments || []).forEach(payment => {
    if (String(payment.packageId) !== String(pkg.id) || payment.category !== 'hotel' || payment.allocationKey) return;
    const key = String(vendor.id);
    hotelGeneralPayments.set(key, (hotelGeneralPayments.get(key) || 0) + Number(payment.amount || 0));
  }));
  hotelGeneralPayments.forEach((paid, vendorId) => addEntry(vendorId, {
    category: 'hotel',
    itemName: `${pkg.name || 'Package'} · Hotel General / Unallocated`,
    cost: 0,
    paid,
    due: -paid
  }));

  const categories = [
    { key: 'transport', items: 'transports', cost: 'vendorTransportCost' },
    { key: 'visa', items: 'visas', cost: 'vendorVisaCost' },
    { key: 'service', items: 'services', cost: 'vendorServiceCost' },
    { key: 'ziyarah', items: 'ziyarahTransport', cost: 'vendorZiyarahCost' }
  ];

  categories.forEach(({ key, items: itemsField, cost: costField }) => {
    const items = pkg[itemsField] || [];
    const itemOwners = new Map();
    const generalVendors = new Map();

    ensurePaymentItemIds(items, key);
    items.forEach((item, index) => {
      if (item.vendorId) itemOwners.set(index, String(item.vendorId));
    });

    STORE.vendors.forEach(vendor => {
      (vendor.payments || []).forEach(payment => {
        if (String(payment.packageId) !== String(pkg.id) || payment.category !== key) return;

        let itemIndex = -1;
        const allocationKey = String(payment.allocationKey || '');
        if (allocationKey.startsWith('item:')) {
          itemIndex = items.findIndex(item => item.paymentItemId === allocationKey.slice(5));
        }
        if (itemIndex < 0 && !allocationKey.startsWith('item:') && payment.itemName) {
          itemIndex = items.findIndex(item => getReadableItemName(item, key) === payment.itemName);
        }

        if (itemIndex >= 0) {
          if (!itemOwners.has(itemIndex)) itemOwners.set(itemIndex, String(vendor.id));
          else if (itemOwners.get(itemIndex) !== String(vendor.id)) {
            const vendorId = String(vendor.id);
            const general = generalVendors.get(vendorId) || { paid: 0 };
            general.paid += Number(payment.amount || 0);
            generalVendors.set(vendorId, general);
          }
        } else {
          const vendorId = String(vendor.id);
          const general = generalVendors.get(vendorId) || { paid: 0 };
          general.paid += Number(payment.amount || 0);
          generalVendors.set(vendorId, general);
        }
      });
    });

    let assignedCost = 0;
    itemOwners.forEach((vendorId, itemIndex) => {
      const item = items[itemIndex];
      const itemName = getReadableItemName(item, key);
      const paid = getVendorItemPaid(pkg, vendorId, key, item, itemIndex);
      const cost = getPackageVendorItemCost(pkg, item, key);
      assignedCost += cost;
      addEntry(vendorId, { category: key, itemName, cost, paid });
    });

    const remainingCost = Math.max(0, Number(pkg[costField] || 0) - assignedCost);
    generalVendors.forEach((general, vendorId) => {
      const cost = generalVendors.size === 1 ? remainingCost : 0;
      addEntry(vendorId, {
        category: key,
        itemName: `${pkg.name || 'Package'} · General / Unallocated`,
        cost,
        paid: general.paid,
        due: cost - general.paid
      });
    });
  });

  return ledgerByVendor;
}

function getPackageVendorBillMap(pkg) {
  const billByVendor = {};
  const ledgerByVendor = getPackageVendorItemLedger(pkg);
  Object.entries(ledgerByVendor).forEach(([vendorId, entries]) => {
    billByVendor[vendorId] = entries.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
  });
  return billByVendor;
}

function getVendorItemLedger(vendorId) {
  const entries = [];
  (STORE.packages || []).forEach(pkg => {
    const ledgerByVendor = getPackageVendorItemLedger(pkg);
    entries.push(...(ledgerByVendor[String(vendorId)] || []));
  });
  return entries;
}

function getVendorItemDueText(row) {
  return row.due < 0 ? `Credit ${fmt(Math.abs(row.due))}` : fmt(row.due);
}

function getVendorTotals(vendor) {
  let totalPaid = 0;
  (vendor.payments || []).forEach(p => { totalPaid += (p.amount || 0); });
  return { totalPaid };
}

/* ==================== RENDER VENDORS TABLE ==================== */
function renderVendorsTable() {
  const el = $('vendorsTable');
  if (!el) return;

  let list = STORE.vendors.slice();
  if (vendorSearchQuery) {
    list = list.filter(v =>
      (v.name || '').toLowerCase().includes(vendorSearchQuery) ||
      (v.phone || '').includes(vendorSearchQuery)
    );
  }

  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="ic">🏢</div><div class="tx">No vendors yet</div></div>';
    return;
  }

  const typeIcons = { hotel: '🕌', transport: '▣', visa: '▤', ziyarah: '★', service: '▦', other: '📦' };

  el.innerHTML = list.map(v => {
    const t = getVendorTotals(v);
    const itemCount = (v.items || v.hotels || []).length;
    return `<div class="customer-row" onclick="viewVendor(${v.id})">
      <div class="customer-avatar" style="background:linear-gradient(135deg,#6366f1,#818cf8)">${typeIcons[v.type] || '🏢'}</div>
      <div class="customer-info">
        <h4>${esc(v.name)}</h4>
        <div class="meta">
          <span>${esc(v.type || 'vendor').toUpperCase()}</span>
          ${v.phone ? `<span>📞 ${esc(v.phone)}</span>` : ''}
          ${itemCount > 0 ? `<span>📋 ${itemCount} item${itemCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="customer-stats">
        <div class="customer-stat"><div class="lbl">Total Paid</div><div class="val green">${fmt(t.totalPaid)}</div></div>
      </div>
      <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-ghost btn-icon" onclick="openVendorSetup(${v.id})">✏️</button>
        <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteVendor(${v.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

/* ==================== FUZZY HOTEL MATCH ==================== */
function normalizeHotelName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0980-\u09FF ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findVendorHotel(vendor, master, preferredRate = '') {
  if (!vendor || !master) return null;
  const items = [...new Set([
    ...(Array.isArray(vendor.items) ? vendor.items : []),
    ...(Array.isArray(vendor.hotels) ? vendor.hotels : [])
  ])];
  if (!items.length) return null;

  const targetName = normalizeHotelName(master.name);
  const targetCity = normalizeHotelName(master.city);
  const rateValue = value => typeof value === 'string'
    ? Number(value.replace(/[,\s৳]/g, ''))
    : Number(value);
  const hasRates = item => ['quad', 'triple', 'double', 'single', 'breakfast', 'halfBoard', 'fullBoard']
    .some(rate => rateValue(item[rate]) > 0);
  const hasPreferredRate = item => preferredRate && rateValue(item[preferredRate]) > 0;
  const matchesCity = item => !item.city || !master.city || normalizeHotelName(item.city) === targetCity;

  const exactNameMatches = items.filter(x =>
    normalizeHotelName(x.name) === targetName
  );
  const found = exactNameMatches.find(x =>
    hasPreferredRate(x) && matchesCity(x)
  ) || exactNameMatches.find(x =>
    hasRates(x) && matchesCity(x)
  ) || exactNameMatches.find(x =>
    matchesCity(x)
  );
  if (found) return found;

  const fuzzyMatches = targetName.length > 3 ? items.filter(x => {
    const n = normalizeHotelName(x.name);
    if (!n) return false;
    const targetWords = targetName.split(' ').filter(w => w.length > 2);
    const itemWords = n.split(' ').filter(w => w.length > 2);
    const overlap = targetWords.filter(w => itemWords.includes(w)).length;
    return overlap >= Math.min(2, targetWords.length);
  }) : [];
  return fuzzyMatches.find(x => hasPreferredRate(x) && matchesCity(x))
    || fuzzyMatches.find(x => hasRates(x) && matchesCity(x))
    || fuzzyMatches.find(matchesCity)
    || null;
}

/* ==================== VIEW VENDOR MODAL ==================== */
function viewVendor(id) {
  const v = STORE.vendors.find(x => x.id === id);
  if (!v) return;
  currentViewVendorId = id;

  const t = getVendorTotals(v);
  const payments = v.payments || [];
  const items = v.items || v.hotels || [];
  const itemLedgerRows = getVendorItemLedger(v.id).filter(row =>
    row.category !== 'hotel' || row.itemName.includes('Hotel General / Unallocated')
  );

  const paymentList = payments.length
    ? payments.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(pm => `
      <div class="payment-row">
        <div class="info">
          <div style="font-weight:700">${esc(pm.method || 'Cash')}${pm.reference ? ' · ' + esc(pm.reference) : ''}</div>
          <div class="date">${esc(pm.date) || '—'}${pm.category ? ' · ' + esc(pm.category) : ''}${pm.allocationName ? ' · ' + esc(pm.allocationName) : ''}</div>
          ${pm.itemName && pm.itemName !== pm.allocationName ? `<div style="font-size:11px;color:var(--blue);margin-top:2px">📦 ${esc(pm.itemName)}</div>` : ''}
        </div>
        <div class="amt red">- ${fmt(pm.amount)}</div>
        <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();deleteVendorPayment(${v.id}, '${pm.id}')">✕</button>
      </div>
    `).join('')
    : '<div style="color:var(--text-3);font-size:12px;padding:8px">No payments yet</div>';

  const itemsHtml = items.length
    ? items.map(h => {
      const displayName = getReadableItemName(h, v.type);

      if (v.type === 'hotel') return `<div class="payment-row"><div class="info"><div style="font-weight:700">🏨 ${esc(displayName)} <span style="color:var(--text-3)">(${h.star}⭐)</span></div><div class="date">Q: ${fmt(h.quad)} · T: ${fmt(h.triple)} · D: ${fmt(h.double)}</div></div></div>`;
      if (v.type === 'visa') return `<div class="payment-row"><div class="info"><div style="font-weight:700">▤ ${esc(displayName)}</div><div class="date">Adult: ${fmt(h.priceAdult)} · Child: ${fmt(h.priceChild)}</div></div></div>`;
      return `<div class="payment-row"><div class="info"><div style="font-weight:700">${esc(displayName)}</div><div class="date">${fmt(h.price || h.priceAdult || h.vendorCost || 0)}</div></div></div>`;
    }).join('')
    : '<div style="color:var(--text-3);font-size:12px;padding:8px">No items</div>';

  const itemLedgerHtml = itemLedgerRows.length ? `
    <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin:20px 0 10px">📊 Item-wise Payment Summary</h4>
    <div class="table-wrap"><table>
      <thead><tr><th>Package</th><th>Category / Item</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
      <tbody>${itemLedgerRows.map(row => `
        <tr>
          <td><div class="cell-main">${esc(row.packageName)}</div><div class="cell-sub">${esc(row.refNo)}</div></td>
          <td><div class="cell-main">${esc(row.category.toUpperCase())}</div><div class="cell-sub">${esc(row.itemName)}</div></td>
          <td>${fmt(row.cost)}</td>
          <td style="color:var(--green);font-weight:700">${fmt(row.paid)}</td>
          <td style="color:${row.due < 0 ? 'var(--blue)' : row.due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700">${getVendorItemDueText(row)}</td>
        </tr>
      `).join('')}</tbody>
    </table></div>
  ` : '';

  let allocationsHtml = '';
  if (v.type === 'hotel') {
    const pkgAllocations = [];
    STORE.packages.forEach(pkg => {
      const rows = getPackageHotelVendorBreakdown(pkg);
      rows.forEach(r => {
        if (String(r.vendorId) === String(v.id)) {
          const paid = getVendorHotelPaid(pkg.id, v.id, r.key);
          pkgAllocations.push({
            packageName: pkg.name || 'Untitled',
            packageId: pkg.id,
            refNo: pkg.refNo,
            city: r.city,
            hotelName: r.hotelName,
            cost: r.cost,
            paid,
            due: Math.max(0, r.cost - paid)
          });
        }
      });
    });
    allocationsHtml = pkgAllocations.length ? `
      <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin:20px 0 10px">🏨 Hotel-wise Allocations (${pkgAllocations.length})</h4>
      <div class="table-wrap"><table>
        <thead><tr><th>Package</th><th>Hotel</th><th>Cost</th><th>Paid</th><th>Due</th></tr></thead>
        <tbody>
          ${pkgAllocations.map(a => `
            <tr>
              <td><div class="cell-main">${esc(a.packageName)}</div><div class="cell-sub">${esc(a.refNo || '')}</div></td>
              <td><b>${esc(a.city)}</b><div class="cell-sub">${esc(a.hotelName)}</div></td>
              <td style="color:var(--blue);font-weight:800">${fmt(a.cost)}</td>
              <td style="color:var(--green);font-weight:800">${fmt(a.paid)}</td>
              <td style="color:${a.due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:800">${fmt(a.due)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    ` : '<div style="padding:16px;background:var(--bg-2);border-radius:10px;font-size:12px;color:var(--text-3);text-align:center;margin-top:12px">এই vendor-এর কোনো hotel allocation নেই</div>';
  }

  const html = `
    <div style="padding:20px;background:linear-gradient(135deg,#eff6ff,var(--card));border-radius:14px;margin-bottom:20px;border:1px solid var(--blue)">
      <h3 style="font-size:20px;font-weight:800;margin-bottom:4px">${esc(v.name)}</h3>
      <div style="font-size:12.5px;color:var(--text-2)">${esc(v.type || '').toUpperCase()} ${v.phone ? '· 📞 ' + esc(v.phone) : ''}</div>
    </div>
    <div class="vendor-detail-grid">
      <div class="vendor-stat-box paid">
        <div class="lbl">Total Paid</div>
        <div class="val">${fmt(t.totalPaid)}</div>
      </div>
      <div class="vendor-stat-box items">
        <div class="lbl">Items</div>
        <div class="val">${items.length}</div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-block"><div class="lbl">Contact</div><div class="val">${esc(v.contact) || '—'}</div></div>
      <div class="detail-block"><div class="lbl">Email</div><div class="val">${esc(v.email) || '—'}</div></div>
      <div class="detail-block" style="grid-column:1/-1"><div class="lbl">Address</div><div class="val">${esc(v.address) || '—'}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px">
      <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2)">💰 Payments (${payments.length})</h4>
      <button class="btn btn-primary btn-xs" onclick="event.stopPropagation();openPaymentModal('vendor', ${v.id})">➕ Add Payment</button>
    </div>
    ${paymentList}
    ${allocationsHtml}
    ${itemLedgerHtml}
    <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin:20px 0 10px">📋 Vendor Items</h4>
    ${itemsHtml}
  `;

  $('vendorDetailTitle').textContent = '🏢 ' + (v.name || 'Vendor Details');
  $('vendorDetailBody').innerHTML = html;
  openModal('vendorDetailModal');
}

function openVendorSetupFromView() {
  if (!currentViewVendorId) return;
  closeModal('vendorDetailModal');
  setTimeout(() => openVendorSetup(currentViewVendorId), 200);
}

/* ==================== PACKAGE HOTEL VENDOR BREAKDOWN ==================== */
function getPackageHotelVendorBreakdown(pkg) {
  const rows = [];
  const addCity = (cityName, hotels) => (hotels || []).forEach((h, idx) => {
    if (h.hotelId === null || h.hotelId === undefined || h.hotelId === '') return;

    const masterList = cityName === 'Makkah' ? STORE.makkahHotels : STORE.madinahHotels;
    const master = masterList.find(x => String(x.id) === String(h.hotelId));
    const vendorId = h.vendorId || master?.vendorId || null;
    const vendor = STORE.vendors.find(v => String(v.id) === String(vendorId));
    const rooms = h.rooms || [];
    const cost = getHotelVendorCost(h, cityName.toLowerCase());
    const sell = getHotelTotal(h);
    const stableKey = `${cityName}|${h.hotelId || 'x'}|${h.id || idx}`;
    rows.push({
      key: stableKey,
      city: cityName,
      hotelId: h.hotelId,
      hotelItemId: h.id,
      hotelName: h.name || master?.name || 'Hotel',
      vendorId,
      vendorName: vendor?.name || null,
      rooms: rooms.length,
      cost,
      sell,
      profit: sell - cost
    });
  });
  addCity('Makkah', pkg.makkahHotels);
  addCity('Madinah', pkg.madinahHotels);
  return rows;
}

function getVendorHotelPaid(pkgId, vendorId, allocationKey = '') {
  let paid = 0;
  STORE.vendors.forEach(v => (v.payments || []).forEach(pm => {
    if (pm.packageId === pkgId &&
        pm.category === 'hotel' &&
        String(v.id) === String(vendorId) &&
        (!allocationKey || pm.allocationKey === allocationKey)) {
      paid += Number(pm.amount || 0);
    }
  }));
  return paid;
}

function renderHotelVendorBreakdown(pkg) {
  const rows = getPackageHotelVendorBreakdown(pkg);
  if (!rows.length) return '';
  return `<div class="vendor-allocation-card">
    <h4>🏨 Hotel-wise Vendor Allocation</h4>
    <div class="table-wrap"><table>
      <thead><tr><th>City / Hotel</th><th>Vendor</th><th>Rooms</th><th>Sell</th><th>Vendor Cost</th><th>Paid</th><th>Due</th></tr></thead>
      <tbody>
        ${rows.map(r => {
          const paid = getVendorHotelPaid(pkg.id, r.vendorId, r.key);
          const due = Math.max(0, r.cost - paid);
          return `<tr>
            <td><b>${esc(r.city)}</b><div class="cell-sub">${esc(r.hotelName)}</div></td>
            <td>${r.vendorId ? esc(r.vendorName || '—') : '<span style="color:var(--red);font-size:11px">⚠️ Not linked</span>'}</td>
            <td>${r.rooms}</td>
            <td>${fmt(r.sell)}</td>
            <td style="color:var(--blue);font-weight:800">${fmt(r.cost)}</td>
            <td style="color:var(--green);font-weight:800">${fmt(paid)}</td>
            <td style="color:${due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:800">${fmt(due)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  </div>`;
}

/* ==================== PAYMENT MODAL (Customer / Vendor) ==================== */
function ensurePaymentPackageSelector() {
  const modal = $('paymentModal');
  const target = $('payTargetName')?.closest('.field');
  if (!modal || !target || $('payPackageSelectWrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'field payment-package-field';
  wrap.id = 'payPackageSelectWrap';
  wrap.innerHTML = '<label>Payment For Package</label><select id="payPackageSelect" onchange="onPaymentPackageChange(this.value)"><option value="">General customer payment</option></select>';
  target.insertAdjacentElement('afterend', wrap);
}

function refreshPaymentPackageOptions(customerId, selectedId = null) {
  const select = $('payPackageSelect');
  if (!select) return;
  const c = STORE.customers.find(x => x.id === customerId);
  const pkgs = c ? getCustomerPackages(c) : [];
  select.innerHTML = '<option value="">General customer payment</option>' +
    pkgs.map(p => `<option value="${p.id}">${esc(p.name || 'Untitled')} · ${esc(p.refNo || '')} · ${fmt(p.grandTotal)}</option>`).join('');
  const value = selectedId || (pkgs.length === 1 ? pkgs[0].id : '');
  select.value = value ? String(value) : '';
  $('payPackageId').value = select.value;
  onPaymentPackageChange(select.value);
}

function refreshVendorPaymentPackageOptions(vendorId, selectedId = null) {
  const select = $('payPackageSelect');
  if (!select) return;
  const category = $('payVendorCategory')?.value || '';
  const vendor = STORE.vendors.find(item => String(item.id) === String(vendorId));
  const packageMatches = [];

  (STORE.packages || []).filter(pkg => pkg.status !== 'Cancelled').forEach(pkg => {
    let categoryCost = 0;
    let hasAssignedItem = false;

    if (category === 'hotel') {
      const rows = getPackageHotelVendorBreakdown(pkg).filter(row => String(row.vendorId) === String(vendorId));
      hasAssignedItem = rows.length > 0;
      categoryCost = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
    } else {
      const config = {
        transport: { items: 'transports', cost: 'vendorTransportCost' },
        visa: { items: 'visas', cost: 'vendorVisaCost' },
        service: { items: 'services', cost: 'vendorServiceCost' },
        ziyarah: { items: 'ziyarahTransport', cost: 'vendorZiyarahCost' }
      }[category];
      if (config) {
        const assignedItems = (pkg[config.items] || []).filter(item => String(item.vendorId || '') === String(vendorId));
        hasAssignedItem = assignedItems.length > 0;
        categoryCost = assignedItems.reduce((sum, item) => sum + getPackageVendorItemCost(pkg, item, category), 0);
        if (!hasAssignedItem && (vendor?.payments || []).some(payment =>
          String(payment.packageId) === String(pkg.id) && payment.category === category
        )) {
          categoryCost = Number(pkg[config.cost] || 0);
        }
      }
    }

    const hasExistingPayment = (vendor?.payments || []).some(payment =>
      String(payment.packageId) === String(pkg.id) && payment.category === category
    );
    if (hasAssignedItem || hasExistingPayment) packageMatches.push({ pkg, categoryCost });
  });

  select.innerHTML = '<option value="">General Payment (Unallocated)</option>' +
    packageMatches.map(({ pkg, categoryCost }) =>
      `<option value="${pkg.id}">${esc(pkg.name || 'Untitled')} · ${esc(pkg.refNo || '')} · ${category} ${fmt(categoryCost)}</option>`
    ).join('');
  select.value = selectedId && packageMatches.some(({ pkg }) => String(pkg.id) === String(selectedId))
    ? String(selectedId)
    : '';
  $('payPackageId').value = select.value;
  onVendorPaymentPackageChange(select.value, vendorId);
}

function onVendorPaymentPackageChange(value, vendorId = parseInt($('payTargetId')?.value || 0)) {
  $('payPackageId').value = value || '';
  const allocationField = $('payVendorAllocationField');
  const allocationSelect = $('payVendorAllocation');
  const category = $('payVendorCategory')?.value || '';
  const pkg = STORE.packages.find(item => String(item.id) === String(value));

  if (!pkg || category !== 'hotel' || !allocationSelect) {
    if (allocationField) allocationField.style.display = 'none';
    if (allocationSelect) allocationSelect.innerHTML = '<option value="">General Payment (Unallocated)</option>';
    return;
  }

  const rows = getPackageHotelVendorBreakdown(pkg).filter(row => String(row.vendorId) === String(vendorId));
  allocationSelect.innerHTML = '<option value="">General Hotel Payment (Unallocated)</option>' +
    rows.map(row => `<option value="${escapeAttr(row.key)}" data-pkg="${pkg.id}">${esc(pkg.name || 'Untitled')} · ${esc(row.city)} · ${esc(row.hotelName)}</option>`).join('');
  if (allocationField) allocationField.style.display = 'block';
}

function onPaymentPackageChange(value) {
  $('payPackageId').value = value || '';
  const id = parseInt(value);
  const p = id ? STORE.packages.find(x => x.id === id) : null;
  const c = parseInt($('payTargetId')?.value || 0);

  if (p) {
    const paid = getPackagePaid(p);
    $('payTotal').textContent = fmt(p.grandTotal);
    $('payAlready').textContent = fmt(paid);
    $('payDue').textContent = fmt(Math.max(0, (p.grandTotal || 0) - paid));
  } else if (c) {
    const t = getCustomerTotals(STORE.customers.find(x => x.id === c) || {});
    $('payTotal').textContent = fmt(t.totalBilled);
    $('payAlready').textContent = fmt(t.totalPaid);
    $('payDue').textContent = fmt(t.due);
  }
}

function openPaymentModal(targetType, targetId, packageId = null) {
  ensurePaymentPackageSelector();
  $('payTargetType').value = targetType;
  $('payTargetId').value = targetId;
  $('payPackageId').value = packageId || '';
  $('payAmount').value = '';
  $('payDate').value = today();
  $('payMethod').value = 'Cash';
  $('payReference').value = '';
  $('payNotes').value = '';

  const categoryField = $('payVendorCategoryField');
  
  if (targetType === 'customer') {
    const c = STORE.customers.find(x => x.id === targetId);
    if (!c) return;
    const allocationField = $('payVendorAllocationField');
    if (allocationField) allocationField.style.display = 'none';
    $('paymentModalTitle').textContent = '💰 Add Customer Payment';
    $('payTargetName').value = c.customerName;
    const t = getCustomerTotals(c);
    $('payTotal').textContent = fmt(t.totalBilled);
    $('payAlready').textContent = fmt(t.totalPaid);
    $('payDue').textContent = fmt(t.due);
    refreshPaymentPackageOptions(targetId, packageId);
    if (categoryField) categoryField.style.display = 'none';
  } else if (targetType === 'vendor') {
    const v = STORE.vendors.find(x => x.id === targetId);
    if (!v) return;
    $('paymentModalTitle').textContent = '💸 Add Vendor Payment';
    $('payTargetName').value = v.name;
    const t = getVendorTotals(v);
    $('payTotal').textContent = fmt(t.totalPaid);
    $('payAlready').textContent = fmt(t.totalPaid);
    $('payDue').textContent = '—';
    
    if (categoryField) {
      categoryField.style.display = 'block';
      const catSelect = $('payVendorCategory');
      if (catSelect && v.type) {
        catSelect.value = v.type;
        catSelect.onchange = () => refreshVendorPaymentPackageOptions(targetId, $('payPackageSelect')?.value || '');
      }
    }

    const wrap = $('payPackageSelectWrap');
    if (wrap) wrap.style.display = 'block';
    refreshVendorPaymentPackageOptions(targetId, packageId);
    const packageSelect = $('payPackageSelect');
    if (packageSelect) {
      packageSelect.onchange = () => onVendorPaymentPackageChange(packageSelect.value, targetId);
    }
  }
  clearAllErrors();
  openModal('paymentModal');
}
async function savePayment() {
  clearAllErrors();
  const amount = parseFloat($('payAmount').value) || 0;
  if (amount <= 0) { setError('payAmount', 'Amount required'); return; }

  const targetType = $('payTargetType').value;
  const targetId = parseInt($('payTargetId').value);
  const packageId = $('payPackageId').value ? parseInt($('payPackageId').value) : null;
  const category = targetType === 'vendor' ? ($('payVendorCategory')?.value || 'hotel') : null;

  const storeName = targetType === 'customer' ? STORES.customers : STORES.vendors;

  showLoading('Saving payment...');
  try {
    const item = (targetType === 'customer' ? STORE.customers : STORE.vendors).find(x => x.id === targetId);
    if (!item) throw new Error('Not found');

    let allocationKey = '';
    let allocationName = '';
    let finalPackageId = packageId;

    if (targetType === 'vendor' && category === 'hotel' && finalPackageId) {
      const allocSelect = $('payVendorAllocation');
      const selectedAllocKey = allocSelect ? allocSelect.value : '';
      if (selectedAllocKey) {
        allocationKey = selectedAllocKey;
        const selectedOpt = allocSelect.options[allocSelect.selectedIndex];
        const allocationPackageId = selectedOpt?.getAttribute('data-pkg');
        if (allocationPackageId) finalPackageId = parseInt(allocationPackageId);

        const pkg = STORE.packages.find(x => x.id === finalPackageId);
        const row = pkg && getPackageHotelVendorBreakdown(pkg).find(x => x.key === allocationKey);
        if (row) allocationName = `${row.city} · ${row.hotelName}`;
      }
    }

    const payment = {
      id: 'vpay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      amount,
      date: strVal('payDate') || today(),
      method: strVal('payMethod', 'Cash'),
      reference: strVal('payReference'),
      notes: strVal('payNotes'),
      packageId: finalPackageId,
      category: category,
      allocationKey: allocationKey, 
      allocationName: allocationName,
      ...(targetType === 'vendor' ? {
        itemName: allocationName || (finalPackageId
          ? `${STORE.packages.find(p => p.id === finalPackageId)?.name || 'Package'} (General)`
          : 'General Payment')
      } : {}),
      isAdvance: false,
      createdAt: Date.now()
    };

    if (!item.payments) item.payments = [];
    item.payments.push(payment);
    item.updatedAt = Date.now();
    await dbSave(storeName, item);

    if (targetType === 'customer') STORE.customers = await dbGetAll(STORES.customers);
    else STORE.vendors = await dbGetAll(STORES.vendors);

    hideLoading();
    closeModal('paymentModal');

    // UI রিফ্রেশ
    if (targetType === 'customer') { 
      viewCustomer(targetId); 
      renderCustomersTable(); 
    } else { 
      viewVendor(targetId); 
      renderVendorsTable(); 
    }

    // ⭐⭐ যদি Package Details মডাল ওপেন থাকে, তবে সেটি রিফ্রেশ করা
    if (typeof currentViewPackageId !== 'undefined' && currentViewPackageId) {
      const isPackageOpen = Array.from(document.querySelectorAll('#modalsContainer .modal-bg.act h2'))
        .some(h => h.textContent.includes('Package Details'));
      
      if (isPackageOpen) {
        // পুরনো মডাল সরিয়ে ফেলা
        document.querySelectorAll('#modalsContainer .modal-bg.act').forEach(m => {
          if (m.querySelector('h2')?.textContent.includes('Package Details')) m.remove();
        });
        // নতুন করে ওপেন করা যাতে আপডেট হওয়া ডাটা লোড হয়
        setTimeout(() => {
          if (typeof viewPackage === 'function') viewPackage(currentViewPackageId);
        }, 300);
      }
    }

    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    if (typeof renderAccounts === 'function') await renderAccounts();
    if (targetType === 'vendor' && typeof renderReports === 'function') renderReports();
    
    toast('✅ Payment saved & synced');
  } catch (e) {
    hideLoading();
    toast('Failed: ' + e.message, 'error');
  }
}

async function deletePayment(customerId, paymentId) {
  confirmDelete('Delete this payment?', async () => {
    const c = STORE.customers.find(x => x.id === customerId);
    if (!c) return;
    c.payments = (c.payments || []).filter(p => p.id !== paymentId);
    await dbSave(STORES.customers, c);
    STORE.customers = await dbGetAll(STORES.customers);
    viewCustomer(customerId);
    renderCustomersTable();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    toast('Payment deleted', 'warning');
  });
}

async function deleteVendorPayment(vendorId, paymentId) {
  confirmDelete('Delete this vendor payment?', async () => {
    const v = STORE.vendors.find(x => x.id === vendorId);
    if (!v) return;
    v.payments = (v.payments || []).filter(p => p.id !== paymentId);
    await dbSave(STORES.vendors, v);
    STORE.vendors = await dbGetAll(STORES.vendors);
    if (typeof renderAccounts === 'function') await renderAccounts();
    if (typeof renderReports === 'function') renderReports();

    if (typeof currentViewVendorId !== 'undefined' && currentViewVendorId) {
      const vendorModal = document.querySelector('#vendorDetailModal.act');
      if (vendorModal) viewVendor(currentViewVendorId);
    }
    if (typeof currentViewPackageId !== 'undefined' && currentViewPackageId) {
      const pkgModals = document.querySelectorAll('#modalsContainer .modal-bg.act');
      pkgModals.forEach(m => {
        if (m.querySelector('h2')?.textContent.includes('Package Details')) {
          m.remove();
          setTimeout(() => viewPackage(currentViewPackageId), 200);
        }
      });
    }

    renderVendorsTable();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    toast('Payment deleted', 'warning');
  });
}

/* ============================================================
   ⭐ VENDOR PAYMENT SUMMARY (v5 — Fixed Amount)
   Amount field user-editable · no auto-override
   ============================================================ */

function updateVendorPaymentSummary() {
  const pkgId = parseInt($('vpPackageId')?.value);
  const pkg = STORE.packages.find(x => x.id === pkgId);
  const category = $('vpCategory')?.value;
  const vendorId = $('vpVendorId')?.value;
  const itemKey = $('vpItemKey')?.value || '';

  let cost = 0, paid = 0;

  const allocSelect = $('vpItemKey');
  if (itemKey && allocSelect && pkg) {
    const selectedOpt = allocSelect.options[allocSelect.selectedIndex];
    cost = Number(selectedOpt?.getAttribute('data-cost') || 0);
    const itemName = selectedOpt?.getAttribute('data-name');
    if (category === 'hotel') {
      paid = getVendorHotelPaid(pkg.id, vendorId, itemKey);
    } else {
      const itemsField = { transport: 'transports', visa: 'visas', service: 'services', ziyarah: 'ziyarahTransport' }[category];
      const items = pkg[itemsField] || [];
      const itemIndex = items.findIndex(item => `item:${item.paymentItemId}` === itemKey);
      if (itemIndex >= 0) {
        paid = getVendorItemPaid(pkg, vendorId, category, items[itemIndex], itemIndex);
      }
    }
  } else if (pkg) {
    const map = {
      transport: 'vendorTransportCost',
      visa: 'vendorVisaCost',
      service: 'vendorServiceCost',
      hotel: 'vendorHotelCost',
      ziyarah: 'vendorZiyarahCost'
    };
    if (category === 'hotel') {
      cost = vendorId
        ? getPackageHotelVendorBreakdown(pkg)
            .filter(row => String(row.vendorId) === String(vendorId))
            .reduce((sum, row) => sum + Number(row.cost || 0), 0)
        : 0;
    } else {
      cost = pkg[map[category]] || 0;
    }
    const vendor = STORE.vendors.find(x => String(x.id) === String(vendorId));
    (vendor?.payments || []).forEach(pm => {
      if (pm.packageId === pkg.id && pm.category === category) {
        paid += Number(pm.amount || 0);
      }
    });
  }

  const remainingDue = Math.max(0, cost - paid);

  if ($('vpTotal')) $('vpTotal').textContent = fmt(cost);
  if ($('vpAlready')) $('vpAlready').textContent = fmt(paid);
  if ($('vpDue')) $('vpDue').textContent = fmt(remainingDue);

  const amtInput = $('vpAmount');
  if (amtInput && !amtInput.dataset.touched && remainingDue > 0) {
    amtInput.value = remainingDue;
  }
}

/* ⭐ Mark amount as touched on first input */
function markVpAmountTouched() {
  const amtInput = $('vpAmount');
  if (amtInput) amtInput.dataset.touched = '1';
}

/* ==================== HOTEL ALLOCATION CHANGE ==================== */
function onHotelAllocationChange() {
  const key = $('vpHotelKey')?.value;
  const pkg = STORE.packages.find(x => x.id === parseInt($('vpPackageId').value));

  /* ⭐ Reset amount + touched when allocation changes */
  const amtInput = $('vpAmount');
  if (amtInput) {
    amtInput.value = '';
    delete amtInput.dataset.touched;
  }

  if (!key) { updateVendorPaymentSummary(); return; }
  if (!pkg) return;

  const row = getPackageHotelVendorBreakdown(pkg).find(r => r.key === key);
  if (row && row.vendorId) $('vpVendorId').value = row.vendorId;

  updateVendorPaymentSummary();
}

/* ==================== OPEN VENDOR PAYMENT MODAL ==================== */
function openVendorPaymentModal(packageId, category) {
  const p = STORE.packages.find(x => x.id === packageId);
  if (!p) return;

  $('vpPackageId').value = packageId;
  $('vpCategory').value = category;
  $('vpCategoryName').value = category.charAt(0).toUpperCase() + category.slice(1) + ' Cost';

  /* ⭐ Reset amount + touched flag */
  const amtInput = $('vpAmount');
  if (amtInput) {
    amtInput.value = '';
    delete amtInput.dataset.touched;
    amtInput.oninput = () => {
      markVpAmountTouched();
      updateVendorPaymentSummary();
    };
  }

  $('vpDate').value = today();
  $('vpMethod').value = 'Cash';
  $('vpReference').value = '';
  if ($('vpNotes')) $('vpNotes').value = '';

  $('vpOverpayWarning')?.remove();

  /* Vendor dropdown */
  const vendorType = category === 'service' ? 'service' : category;
  const packageHotelVendorIds = category === 'hotel'
    ? new Set(getPackageHotelVendorBreakdown(p)
        .map(row => row.vendorId)
        .filter(id => id !== null && id !== undefined && id !== '')
        .map(String))
    : null;
  const vendors = STORE.vendors.filter(v =>
    (v.type === vendorType || v.type === 'other') &&
    (category !== 'hotel' || packageHotelVendorIds.has(String(v.id)))
  );
  const vendorSelect = $('vpVendorId');
  if (vendorSelect) {
    vendorSelect.innerHTML = '<option value="">-- Choose Vendor --</option>' +
      vendors.map(v => `<option value="${v.id}">${esc(v.name)} (${v.type})</option>`).join('');
    vendorSelect.onchange = () => {
      if (amtInput) {
        amtInput.value = '';
        delete amtInput.dataset.touched;
      }
      updateVendorItemAllocation(p, category);
      updateVendorPaymentSummary();
    };
  }

  let allocField = $('vpItemAllocationField');
  if (!allocField) {
    const vendorField = $('vpVendorId')?.closest('.field');
    if (vendorField) {
      vendorField.insertAdjacentHTML('afterend',
        '<div class="field" id="vpItemAllocationField" style="margin-bottom:14px"><label>Select Item / Service</label><select id="vpItemKey" onchange="onItemAllocationChange()"></select></div>');
      allocField = $('vpItemAllocationField');
    }
  }
  if (allocField) allocField.style.display = 'block';

  updateVendorItemAllocation(p, category);

  updateVendorPaymentSummary();

  clearAllErrors();
  openModal('vendorPaymentModal');
}

function updateVendorItemAllocation(p, category) {
  const vendorId = $('vpVendorId')?.value;
  const allocSelect = $('vpItemKey');
  if (!allocSelect) return;

  allocSelect.innerHTML = '<option value="">-- General Payment (No specific item) --</option>';
  if (!vendorId) return;

  if (category === 'hotel') {
    const rows = getPackageHotelVendorBreakdown(p);
    let firstDueKey = '';
    let firstKey = '';
    rows.forEach(r => {
      if (String(r.vendorId) === String(vendorId)) {
        const paid = getVendorHotelPaid(p.id, r.vendorId, r.key);
        const due = Math.max(0, r.cost - paid);
        const key = String(r.key);
        if (!firstKey) firstKey = key;
        if (!firstDueKey && due > 0) firstDueKey = key;
        allocSelect.innerHTML += `<option value="${escapeAttr(r.key)}" data-name="${esc(r.city + ' · ' + r.hotelName)}" data-cost="${r.cost}">🏨 ${esc(r.hotelName)} (${esc(r.city)}) · Cost: ${fmt(r.cost)} · Paid: ${fmt(paid)} · Due: ${fmt(due)}</option>`;
      }
    });
    allocSelect.value = firstDueKey || firstKey || '';
    return;
  }

  let source = [];
  if (category === 'transport') source = p.transports || [];
  else if (category === 'visa') source = p.visas || [];
  else if (category === 'service') source = p.services || [];
  else if (category === 'ziyarah') source = p.ziyarahTransport || [];

  ensurePaymentItemIds(source, category);
  let firstDueKey = '';
  let firstKey = '';
  source.forEach(item => {
    if (String(item.vendorId || '') === String(vendorId) || !item.vendorId) {
      const displayName = getReadableItemName(item, category);
      const cost = getPackageVendorItemCost(p, item, category);
      const itemIndex = source.indexOf(item);
      const paid = getVendorItemPaid(p, vendorId, category, item, itemIndex);
      const due = Math.max(0, cost - paid);
      const unassignedLabel = item.vendorId ? '' : ' · Unassigned, assign on save';
      const key = `item:${item.paymentItemId}`;
      if (!firstKey) firstKey = key;
      if (!firstDueKey && due > 0) firstDueKey = key;
      allocSelect.innerHTML += `<option value="${escapeAttr(key)}" data-name="${esc(displayName)}" data-cost="${cost}">${category === 'transport' ? '🚐' : '📦'} ${esc(displayName)}${unassignedLabel} · Cost: ${fmt(cost)} · Paid: ${fmt(paid)} · Due: ${fmt(due)}</option>`;
    }
  });
  allocSelect.value = firstDueKey || firstKey || '';
}

function onItemAllocationChange() {
  const amtInput = $('vpAmount');
  if (amtInput) {
    amtInput.value = '';
    delete amtInput.dataset.touched;
  }
  updateVendorPaymentSummary();
}

/* ==================== SAVE VENDOR PAYMENT ==================== */
async function saveVendorPayment() {
  clearAllErrors();
  const vendorId = parseInt($('vpVendorId').value);
  const amount = parseFloat($('vpAmount').value) || 0;
  const packageId = parseInt($('vpPackageId').value);
  const category = $('vpCategory').value;

  if (!vendorId) { setError('vpVendorId', 'Choose vendor'); return; }
  if (amount <= 0) { setError('vpAmount', 'Amount required'); return; }

  /* Overpayment check */
  const selectedItem = $('vpItemKey')?.selectedOptions?.[0];
  const selectedItemName = selectedItem?.dataset.name || '';
  const itemKey = strVal('vpItemKey');
  const hotelKey = category === 'hotel'
    ? (itemKey || strVal('vpHotelKey'))
    : strVal('vpHotelKey');
  const pkg = STORE.packages.find(x => x.id === packageId);
  const packageItemsField = {
    transport: 'transports',
    visa: 'visas',
    service: 'services',
    ziyarah: 'ziyarahTransport'
  }[category];
  const packageItems = pkg && packageItemsField ? (pkg[packageItemsField] || []) : [];
  const selectedPackageItem = itemKey.startsWith('item:')
    ? packageItems.find(item => item.paymentItemId === itemKey.slice(5))
    : null;

  if (itemKey && category !== 'hotel' && !selectedPackageItem) {
    toast('Selected item is no longer available. Reopen the payment form.', 'error');
    return;
  }
  if (selectedPackageItem?.vendorId && String(selectedPackageItem.vendorId) !== String(vendorId)) {
    toast('This item is assigned to another vendor.', 'error');
    return;
  }

  if (pkg) {
    let alreadyPaidForAllocation = 0;
    let totalCostForAllocation = 0;

    if (category === 'hotel' && hotelKey) {
      const row = getPackageHotelVendorBreakdown(pkg).find(x => x.key === hotelKey);
      if (row) {
        totalCostForAllocation = row.cost;
        alreadyPaidForAllocation = getVendorHotelPaid(pkg.id, vendorId, hotelKey);
      }
    } else if (category === 'hotel' && !hotelKey) {
      totalCostForAllocation = pkg.vendorHotelCost || 0;
      STORE.vendors.forEach(v => (v.payments || []).forEach(pm => {
        if (pm.packageId === pkg.id && pm.category === 'hotel' && String(v.id) === String(vendorId)) {
          alreadyPaidForAllocation += Number(pm.amount || 0);
        }
      }));
    } else if (itemKey && selectedItemName) {
      totalCostForAllocation = Number(selectedItem?.dataset.cost || 0);
      alreadyPaidForAllocation = getVendorItemPaid(pkg, vendorId, category, selectedPackageItem, packageItems.indexOf(selectedPackageItem));
    } else {
      const catCostField = {
        flight: 'vendorFlightCost',
        transport: 'vendorTransportCost',
        visa: 'vendorVisaCost',
        service: 'vendorServiceCost',
        ziyarah: 'vendorZiyarahCost'
      }[category];
      totalCostForAllocation = pkg[catCostField] || 0;
      STORE.vendors.forEach(v => (v.payments || []).forEach(pm => {
        if (pm.packageId === pkg.id && pm.category === category && String(v.id) === String(vendorId)) {
          alreadyPaidForAllocation += Number(pm.amount || 0);
        }
      }));
    }

    const remainingDue = Math.max(0, totalCostForAllocation - alreadyPaidForAllocation);

    if (amount > remainingDue + 1) {
      const confirmed = confirm(
        `⚠️ Warning: Overpayment Detected\n\n` +
        `Category: ${category}\n` +
        `Total Cost: ৳${totalCostForAllocation.toLocaleString()}\n` +
        `Already Paid: ৳${alreadyPaidForAllocation.toLocaleString()}\n` +
        `Remaining Due: ৳${remainingDue.toLocaleString()}\n\n` +
        `You're trying to pay: ৳${amount.toLocaleString()}\n\n` +
        `This will result in overpayment of ৳${(amount - remainingDue).toLocaleString()}.\n\n` +
        `Continue anyway?`
      );
      if (!confirmed) return;
    }
  }

  showLoading('Saving...');
  try {
    const vendor = STORE.vendors.find(x => x.id === vendorId);
    if (!vendor) throw new Error('Vendor not found');

    let allocationName = '';
    if (category === 'hotel' && hotelKey && pkg) {
      const row = getPackageHotelVendorBreakdown(pkg).find(x => x.key === hotelKey);
      if (row) allocationName = `${row.city} · ${row.hotelName}`;
    } else if (selectedItemName) {
      allocationName = selectedItemName;
    }

    const payment = {
      id: 'vpay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      amount,
      date: strVal('vpDate') || today(),
      method: strVal('vpMethod', 'Cash'),
      reference: strVal('vpReference'),
      packageId,
      category,
      allocationKey: category === 'hotel' ? hotelKey : itemKey,
      allocationName,
      itemName: allocationName || (pkg ? pkg.name + ' (General)' : 'General Payment'),
      notes: strVal('vpNotes'),
      createdAt: Date.now()
    };
    if (selectedPackageItem) {
      selectedPackageItem.vendorId = vendorId;
      pkg.updatedAt = Date.now();
      await dbSave(STORES.packages, pkg);
      STORE.packages = await dbGetAll(STORES.packages);
    }
    if (!vendor.payments) vendor.payments = [];
    vendor.payments.push(payment);
    vendor.updatedAt = Date.now();
    await dbSave(STORES.vendors, vendor);
    STORE.vendors = await dbGetAll(STORES.vendors);

    hideLoading();
    closeModal('vendorPaymentModal');
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    if (typeof renderAccounts === 'function') await renderAccounts();
    if (typeof renderReports === 'function') renderReports();

    /* Refresh Package Details modal if open */
    if (typeof currentViewPackageId !== 'undefined' && currentViewPackageId) {
      const isPackageOpen = Array.from(document.querySelectorAll('#modalsContainer .modal-bg.act h2'))
        .some(h => h.textContent.includes('Package Details'));
      if (isPackageOpen) {
        document.querySelectorAll('#modalsContainer .modal-bg.act').forEach(m => {
          if (m.querySelector('h2')?.textContent.includes('Package Details')) {
            m.remove();
          }
        });
        setTimeout(() => {
          if (typeof viewPackage === 'function') viewPackage(currentViewPackageId);
        }, 250);
      }
    }

    /* Refresh Vendor Details modal if open */
    if (typeof currentViewVendorId !== 'undefined' && currentViewVendorId) {
      const vendorModal = document.querySelector('#vendorDetailModal.act');
      if (vendorModal) {
        if (typeof viewVendor === 'function') viewVendor(currentViewVendorId);
      }
    }

    if (typeof addNotification === 'function') {
      addNotification({
        type: 'vendor_paid',
        icon: '💸',
        message: `💸 Vendor paid: <b>৳${amount.toLocaleString()}</b> (${category})`,
        link: 'accounts'
      });
    }
    toast('✅ Vendor payment saved & synced');
  } catch (e) {
    hideLoading();
    toast('Failed: ' + e.message, 'error');
  }
}