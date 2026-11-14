/* ============================================================
   UMRAH BUILDER — BUILDER / HOTELS
   ============================================================ */

/* ==================== MAKKAH HOTEL ==================== */
function addMakkahHotel() {
  makkahItems.push({
    id: ++mC, hotelId: null, vendorId: null, vendorName: '', name: '', distance: '', star: 4, imageIds: [], checkIn: '', checkOut: '', rooms: []
  });
  renderMakkahHotelsList();
  recalc();
}

function removeMakkahHotel(id) {
  makkahItems = makkahItems.filter(h => h.id !== id);
  renderMakkahHotelsList();
  recalc();
}

function onMakkahHotelChange(itemId, hotelId) {
  const h = makkahItems.find(x => x.id === itemId);
  if (!h) return;

  if (!hotelId) {
    h.hotelId = null; h.vendorId = null; h.vendorName = ''; h.name = ''; h.distance = ''; h.star = 4; h.imageIds = []; h.vendorHotelItemId = ''; h.rooms = [];
  } else {
    const dbH = STORE.makkahHotels.find(x => String(x.id) === String(hotelId));
    if (!dbH) return;
    
    h.hotelId = dbH.id;
    h.vendorId = dbH.vendorId || null;
    h.vendorHotelItemId = dbH.vendorHotelItemId || '';
    h.vendorName = h.vendorId ? (STORE.vendors.find(v => String(v.id) === String(h.vendorId))?.name || '') : '';
    h.city = 'Makkah';
    h.name = dbH.name;
    h.distance = dbH.distance;
    h.star = dbH.star;
    h.imageIds = dbH.imageIds || [];
    if (!h.checkIn) h.checkIn = strVal('pkgCheckIn');
    
    if (!h.rooms.length) {
      const pax = intVal('paxAdult', 0) + intVal('paxChild', 0);
      createRoomsForPax(h, 'makkah', pax);
    }
    
    syncHotelVendor('makkah', h);
    syncHotelRoomRates('makkah', h);
    
    h.rooms.forEach(room => {
      room.vendorRate = getHotelRoomVendorRate('makkah', h, room);
      room.mealRate = room.meal && room.meal !== 'room_only' ? getHotelDefaultMealRate('makkah', h, room.meal) : 0;
    });
  }
  renderMakkahHotelsList();
  recalc();
}

/* ==================== MADINAH HOTEL ==================== */
function addMadinahHotel() {
  madinahItems.push({
    id: ++mdC, hotelId: null, vendorId: null, vendorName: '', name: '', distance: '', star: 4, imageIds: [], checkIn: '', checkOut: '', rooms: []
  });
  renderMadinahHotelsList();
  recalc();
}

function removeMadinahHotel(id) {
  madinahItems = madinahItems.filter(h => h.id !== id);
  renderMadinahHotelsList();
  recalc();
}

function refreshBuilderHotelVendorRates() {
  makkahItems.forEach(h => (h.rooms || []).forEach(room => {
    room.vendorRate = getHotelRoomVendorRate('makkah', h, room);
  }));
  madinahItems.forEach(h => (h.rooms || []).forEach(room => {
    room.vendorRate = getHotelRoomVendorRate('madinah', h, room);
  }));
  renderMakkahHotelsList();
  renderMadinahHotelsList();
  recalc();
}

function refreshBuilderHotelMasterRates(cityType, hotelId) {
  const items = cityType === 'makkah' ? makkahItems : madinahItems;
  items.filter(h => String(h.hotelId) === String(hotelId)).forEach(h => {
    (h.rooms || []).forEach(room => {
      room.vendorRate = getHotelRoomVendorRate(cityType, h, room);
    });
  });
  if (cityType === 'makkah') renderMakkahHotelsList(); else renderMadinahHotelsList();
  recalc();
}

function onMadinahHotelChange(itemId, hotelId) {
  const h = madinahItems.find(x => x.id === itemId);
  if (!h) return;

  if (!hotelId) {
    h.hotelId = null; h.vendorId = null; h.vendorName = ''; h.name = ''; h.distance = ''; h.star = 4; h.imageIds = []; h.vendorHotelItemId = ''; h.rooms = [];
  } else {
    const dbH = STORE.madinahHotels.find(x => String(x.id) === String(hotelId));
    if (!dbH) return;
    
    h.hotelId = dbH.id;
    h.vendorId = dbH.vendorId || null;
    h.vendorHotelItemId = dbH.vendorHotelItemId || '';
    h.vendorName = h.vendorId ? (STORE.vendors.find(v => String(v.id) === String(h.vendorId))?.name || '') : '';
    h.city = 'Madinah';
    h.name = dbH.name;
    h.distance = dbH.distance;
    h.star = dbH.star;
    h.imageIds = dbH.imageIds || [];

    const firstMakkah = makkahItems.find(m => m.hotelId && m.checkOut);
    if (!h.checkIn) h.checkIn = firstMakkah?.checkOut || '';
    if (!h.checkOut) h.checkOut = strVal('pkgCheckOut');
    
    if (!h.rooms.length) {
      const pax = intVal('paxAdult', 0) + intVal('paxChild', 0);
      createRoomsForPax(h, 'madinah', pax);
    }
    
    syncHotelVendor('madinah', h);
    syncHotelRoomRates('madinah', h);
    
    h.rooms.forEach(room => {
      room.vendorRate = getHotelRoomVendorRate('madinah', h, room);
      room.mealRate = room.meal && room.meal !== 'room_only' ? getHotelDefaultMealRate('madinah', h, room.meal) : 0;
    });
  }
  renderMadinahHotelsList();
  recalc();
}

function syncHotelRoomRates(cityType, hotel) {
  (hotel.rooms || []).forEach(room => {
    room.mealRate = room.meal && room.meal !== 'room_only' ? getHotelDefaultMealRate(cityType, hotel, room.meal) : 0;
  });
}

/* ==================== HOTEL DATE UPDATE ==================== */
function updateHotelDate(cityType, hotelItemId, field, value) {
  const items = cityType === 'makkah' ? makkahItems : madinahItems;
  const h = items.find(x => x.id === hotelItemId);
  if (!h) return;

  h[field] = value;

  if (cityType === 'makkah') {
    h._makkahDateManual = true;
    if (field === 'checkOut') {
      madinahItems.forEach(mh => {
        if (!mh._madinahDateManual) { mh.checkIn = value; mh._madinahDateManual = false; }
      });
    }
  }
  if (cityType === 'madinah') h._madinahDateManual = true;

  if (h.checkIn && h.checkOut) {
    const nights = daysBetween(h.checkIn, h.checkOut);
    (h.rooms || []).forEach(r => { r.nights = nights; });
  }

  renderMakkahHotelsList();
  renderMadinahHotelsList();
  calcDuration();
}

/* ==================== ROOM MANAGEMENT ==================== */
function addHotelRoom(cityType, hotelItemId, roomType = 'double') {
  const items = cityType === 'makkah' ? makkahItems : madinahItems;
  const h = items.find(x => x.id === hotelItemId);
  if (!h) return;

  const cap = ROOM_CAPACITY[roomType] || 2;
  let totalNights = getPackageNights();
  if (h.checkIn && h.checkOut) totalNights = daysBetween(h.checkIn, h.checkOut);

  hotelRoomCounter++;
  const newRoom = {
    id: hotelRoomCounter, type: roomType, adults: cap, children: 0, nights: totalNights, rate: 0, meal: 'room_only', mealRate: 0
  };
  
  newRoom.vendorRate = getHotelRoomVendorRate(cityType, h, newRoom);
  h.rooms.push(newRoom);
  syncHotelVendor(cityType, h);

  renderMakkahHotelsList();
  renderMadinahHotelsList();
  recalc();
}

function removeHotelRoom(cityType, hotelItemId, roomId) {
  const items = cityType === 'makkah' ? makkahItems : madinahItems;
  const h = items.find(x => x.id === hotelItemId);
  if (!h) return;
  h.rooms = h.rooms.filter(r => r.id !== roomId);
  renderMakkahHotelsList();
  renderMadinahHotelsList();
  recalc();
}

function updateHotelRoom(cityType, hotelItemId, roomId, field, value) {
  const items = cityType === 'makkah' ? makkahItems : madinahItems;
  const h = items.find(x => x.id === hotelItemId);
  if (!h) return;
  const r = h.rooms.find(x => x.id === roomId);
  if (!r) return;

  if (field === 'type') {
    r.type = normalizeHotelRoomType(value);
    r.adults = ROOM_CAPACITY[value] || 2;
    r.vendorRate = getHotelRoomVendorRate(cityType, h, r);
    if (r.meal && r.meal !== 'room_only') {
      const newMealRate = getHotelDefaultMealRate(cityType, h, r.meal);
      if (newMealRate > 0) r.mealRate = newMealRate;
    }
  } else if (field === 'meal') {
    r.meal = value;
    if (value === 'room_only') r.mealRate = 0;
    else {
      const autoRate = getHotelDefaultMealRate(cityType, h, value);
      if (autoRate > 0) r.mealRate = autoRate;
    }
  } else if (field === 'mealRate') {
    r.mealRate = Math.max(0, parseFloat(value) || 0);
  } else if (['adults', 'children', 'nights'].includes(field)) {
    r[field] = Math.max(0, parseInt(value) || 0);
  } else if (field === 'rate') {
    r.rate = Math.max(0, parseFloat(value) || 0);
  }

  if (field === 'type') syncHotelVendor(cityType, h);
  renderMakkahHotelsList();
  renderMadinahHotelsList();
  recalc();
}

/* ==================== ⭐ SMART PAX SYNC ==================== */
function syncHotelRoomsWithPax(hotel, cityType, pax) {
  if (!hotel || !hotel.hotelId) return;
  if (!hotel.rooms) hotel.rooms = [];

  let currentAssigned = 0;
  hotel.rooms.forEach(r => { currentAssigned += (r.adults || 0); });

  if (currentAssigned === pax) return;

  if (currentAssigned > pax) {
    let excess = currentAssigned - pax;
    for (let i = hotel.rooms.length - 1; i >= 0 && excess > 0; i--) {
      const room = hotel.rooms[i];
      if (room.adults > 1) {
        const reduceAmount = Math.min(room.adults - 1, excess);
        room.adults -= reduceAmount;
        excess -= reduceAmount;
      }
      if (room.adults <= 0) { hotel.rooms.splice(i, 1); }
    }
    hotel.rooms.forEach(r => {
      const idealType = getRoomTypeForCount(r.adults);
      if (idealType && r.type !== idealType) {
        r.type = idealType;
        r.adults = Math.min(r.adults, ROOM_CAPACITY[idealType] || 2);
        r.vendorRate = getHotelRoomVendorRate(cityType, hotel, r);
      }
    });
    if (cityType === 'makkah') renderMakkahHotelsList(); else renderMadinahHotelsList();
    return;
  }

  let diff = pax - currentAssigned;
  if (diff <= 0) return;

  for (const room of hotel.rooms) {
    if (diff <= 0) break;
    const roomCap = ROOM_CAPACITY[room.type] || 2;
    const emptySpace = roomCap - (room.adults || 0);
    if (emptySpace > 0) {
      const add = Math.min(emptySpace, diff);
      room.adults += add;
      diff -= add;
    }
  }

  if (diff > 0) { createRoomsForPax(hotel, cityType, diff); }
  if (cityType === 'makkah') renderMakkahHotelsList(); else renderMadinahHotelsList();
}

function getRoomTypeForCount(count) {
  if (count >= 4) return 'quad';
  if (count === 3) return 'triple';
  if (count === 2) return 'double';
  if (count === 1) return 'single';
  return 'double';
}

function createRoomsForPax(hotel, cityType, paxCount, isAdditional = false) {
  if (!hotel || paxCount <= 0) return;

  let remaining = paxCount;
  let defaultType = (typeof builderDefaultRoomSharing !== 'undefined' && builderDefaultRoomSharing) || 'double';
  let defaultCap = ROOM_CAPACITY[defaultType] || 2;

  let totalNights = getPackageNights();
  if (hotel.checkIn && hotel.checkOut) totalNights = daysBetween(hotel.checkIn, hotel.checkOut);

  while (remaining > 0) {
    let roomType = defaultType;
    let cap = defaultCap;

    if (remaining < defaultCap) {
      if (remaining === 1) { roomType = 'single'; cap = 1; }
      else if (remaining === 2) { roomType = 'double'; cap = 2; }
      else if (remaining === 3) { roomType = 'triple'; cap = 3; }
      else if (remaining === 4) { roomType = 'quad'; cap = 4; }
    }

    hotelRoomCounter++;
    const newRoom = {
      id: hotelRoomCounter, type: roomType, adults: cap, children: 0, nights: totalNights, rate: 0, meal: 'room_only', mealRate: 0
    };
    
    newRoom.vendorRate = getHotelRoomVendorRate(cityType, hotel, newRoom);
    hotel.rooms.push(newRoom);
    remaining -= cap;
  }
}

/* ==================== HOTEL ROOM COST RATE ==================== */
function getVendorHotelItems(vendor) {
  const items = [ ...(Array.isArray(vendor?.items) ? vendor.items : []), ...(Array.isArray(vendor?.hotels) ? vendor.hotels : []) ];
  const seen = new Set();
  return items.filter(item => {
    const key = item?.id == null ? item : `id:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getHotelVendorMatch(cityType, hotelId, roomType, vendorId = null, vendorHotelItemId = '') {
  if (!hotelId) return null;
  const list = cityType === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels;
  const dbH = list.find(x => String(x.id) === String(hotelId));
  if (!dbH) return null;

  const vendors = STORE.vendors || [];
  const linkedId = vendorId || dbH.vendorId;
  const linkedItemId = vendorHotelItemId || dbH.vendorHotelItemId;
  const candidates = linkedId ? vendors.filter(v => String(v.id) === String(linkedId)) : vendors;
  let fallbackMatch = null;
  const expectedCity = dbH.city || (cityType === 'makkah' ? 'Makkah' : 'Madinah');

  for (const vendor of candidates) {
    const vendorItems = getVendorHotelItems(vendor);
    const linkedItem = linkedItemId
      ? vendorItems.find(item =>
        String(item.id) === String(linkedItemId) &&
        (!item.city && !item.cityType || normalizeHotelName(item.city || item.cityType) === normalizeHotelName(expectedCity))
      )
      : null;
    const item = linkedItem || findVendorHotel(vendor, dbH, roomType);
    if (!item) continue;
    let rate = parseHotelRate(item?.[roomType]);
    const match = { vendor, item, rate };
    if (rate > 0) return match;
    if (!fallbackMatch || linkedItem) fallbackMatch = match;
    if (linkedId) return match;
  }
  return fallbackMatch;
}

function syncHotelVendor(cityType, hotel) {
  if (!hotel?.hotelId) return;
  const roomType = hotel.rooms?.[0]?.type || 'double';
  const match = getHotelVendorMatch(cityType, hotel.hotelId, roomType, hotel.vendorId, hotel.vendorHotelItemId);
  if (match) {
    hotel.vendorId = match.vendor.id;
    hotel.vendorName = match.vendor.name || '';
    if (match.item?.id != null) hotel.vendorHotelItemId = match.item.id;
    return;
  }

  const linkedVendor = (STORE.vendors || []).find(v => String(v.id) === String(hotel.vendorId || ''));
  if (linkedVendor) hotel.vendorName = linkedVendor.name || '';
}

function parseHotelRate(value) {
  const rate = typeof value === 'string' ? Number(value.replace(/[,\s৳]/g, '')) : Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function normalizeHotelRoomType(roomType) {
  const normalized = String(roomType || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'single' || normalized === 'singleroom' || normalized === '1') return 'single';
  if (normalized === 'double' || normalized === 'doubleroom' || normalized === '2') return 'double';
  if (normalized === 'triple' || normalized === 'tripleroom' || normalized === '3') return 'triple';
  if (normalized === 'quad' || normalized === 'quadruple' || normalized === 'quadroom' || normalized === '4') return 'quad';
  return '';
}

function getHotelMasterRoomRate(cityType, hotelId, roomType) {
  const hotels = cityType === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels;
  const hotel = hotels.find(item => String(item.id) === String(hotelId));
  const normalizedType = normalizeHotelRoomType(roomType);
  if (!hotel || !normalizedType) return 0;
  const rateField = Object.keys(hotel).find(key => normalizeHotelRoomType(key) === normalizedType);
  return parseHotelRate(rateField ? hotel[rateField] : 0);
}

function getHotelRoomVendorRate(cityType, hotel, room) {
  const roomType = normalizeHotelRoomType(room.type);
  return getHotelMasterRoomRate(cityType, hotel.hotelId, roomType);
}

function getHotelVendorRateHint(cityType, hotel, room) {
  if (getHotelMasterRoomRate(cityType, hotel.hotelId, room.type) > 0) return '';
  const masterList = cityType === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels;
  const master = masterList.find(item => String(item.id) === String(hotel.hotelId));
  return `Add ${room.type} room rate for ${hotel.name || master?.name || 'this hotel'} in Hotel section.`;
}

/* ==================== MEAL RATES ==================== */
function getHotelDefaultMealRate(cityType, hotelItem, meal) {
  if (!hotelItem) return 0;
  if (meal === 'room_only' || !meal) return 0;
  const field = { breakfast: 'breakfast', half_board: 'halfBoard', full_board: 'fullBoard' }[meal];
  if (!field) return 0;
  const master = (cityType === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels).find(h => String(h.id) === String(hotelItem.hotelId));
  return Number(master?.[field] || 0);
}

function getHotelVendorMealRate(cityType, hotelItem, meal) {
  if (!hotelItem) return 0;
  if (meal === 'room_only' || !meal) return 0;
  const field = { breakfast: 'breakfast', half_board: 'halfBoard', full_board: 'fullBoard' }[meal];
  if (!field) return 0;
  const master = (cityType === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels).find(h => String(h.id) === String(hotelItem.hotelId));
  if (!master) return 0;
  const vId = hotelItem.vendorId || master.vendorId;
  if (!vId) return 0;
  const vendor = STORE.vendors.find(v => String(v.id) === String(vId));
  if (!vendor) return 0;
  const vh = hotelItem.vendorHotelItemId ? getVendorHotelItems(vendor).find(item => String(item.id) === String(hotelItem.vendorHotelItemId)) : findVendorHotel(vendor, master, field);
  return parseHotelRate(vh?.[field]);
}

/* ==================== HOTEL TOTALS ==================== */
function getHotelTotal(h) {
  return (h.rooms || []).reduce((sum, r) => {
    const paxInRoom = (r.adults || 0) + (r.children || 0);
    const mealPerNight = (r.mealRate || 0) * paxInRoom;
    const totalRatePerNight = (r.rate || 0) + mealPerNight;
    return sum + (totalRatePerNight * (r.nights || 0));
  }, 0);
}

function getHotelVendorCost(h, cityType) {
  return (h.rooms || []).reduce((sum, r) => {
    const vendorRoomRate = getHotelRoomVendorRate(cityType, h, r);
    const vendorMealRate = getHotelVendorMealRate(cityType, h, r.meal);
    const paxInRoom = (r.adults || 0) + (r.children || 0);
    const mealPerNight = vendorMealRate * paxInRoom;
    const totalRatePerNight = vendorRoomRate + mealPerNight;
    return sum + (totalRatePerNight * (r.nights || 0));
  }, 0);
}

function hasHotelVendorRates(h, cityType) {
  return (h.rooms || []).every(r => getHotelRoomVendorRate(cityType, h, r) > 0);
}

function hasHotelSellRates(h) {
  return (h.rooms || []).every(r => Number(r.rate) > 0);
}

function getMakkahTotal() { return makkahItems.reduce((s, h) => s + getHotelTotal(h), 0); }
function getMadinahTotal() { return madinahItems.reduce((s, h) => s + getHotelTotal(h), 0); }
function getMakkahVendorCost() { return makkahItems.reduce((s, h) => s + getHotelVendorCost(h, 'makkah'), 0); }
function getMadinahVendorCost() { return madinahItems.reduce((s, h) => s + getHotelVendorCost(h, 'madinah'), 0); }

/* ==================== RENDER MAKKAH HOTELS ==================== */
function renderMakkahHotelsList() {
  const el = $('makkahHotelsList');
  if (!el) return;

  if ($('makkahHotelCount')) $('makkahHotelCount').textContent = makkahItems.length;
  if (!makkahItems.length) {
    el.innerHTML = '<div class="empty-slot"><span class="ic">🕌</span>No Makkah hotel</div>';
    return;
  }

  const makkahOnlyHotels = STORE.makkahHotels.filter(h => (h.city || 'Makkah').toLowerCase() === 'makkah' || h.cityType === 'makkah');
  const opts = makkahOnlyHotels.map(h => `<option value="${h.id}">${esc(h.name)} — ${esc(h.distance || '')}</option>`).join('');

  el.innerHTML = makkahItems.map((h, i) => {
    const hotelTotal = getHotelTotal(h);
    const hotelVendorCost = getHotelVendorCost(h, 'makkah');
    const missingVendorRoom = h.rooms.find(room => getHotelRoomVendorRate('makkah', h, room) <= 0);
    const vendorRateStatus = missingVendorRoom ? getHotelVendorRateHint('makkah', h, missingVendorRoom) || `Missing ${missingVendorRoom.type} room rate` : 'Hotel section rates included';
    const hasProfitData = hasHotelVendorRates(h, 'makkah') && hasHotelSellRates(h);
    const hotelProfit = hotelTotal - hotelVendorCost;

    return `<div class="item-card">
      <div class="item-card-head">
        <span class="lbl">Makkah Hotel ${i + 1}</span>
        <button class="remove-btn" onclick="removeMakkahHotel(${h.id})">✕</button>
      </div>
      <div class="field" style="margin-bottom:14px">
        <label>Select Hotel</label>
        <select onchange="onMakkahHotelChange(${h.id},this.value)" data-selected="${h.hotelId || ''}">
          <option value="">-- Choose Hotel --</option>${opts}
        </select>
      </div>
      ${h.hotelId ? `
        <div style="padding:10px 14px;background:var(--primary-bg);border-radius:10px;margin-bottom:12px;font-size:12px;line-height:1.7;border-left:3px solid var(--primary)">
          <div>📍 <b>${esc(h.distance) || '—'}</b></div>
          <div>${'⭐'.repeat(parseInt(h.star) || 0)}</div>
          ${h.vendorName ? `<div style="color:var(--blue);font-weight:700">🏢 Vendor: ${esc(h.vendorName)}</div>` : '<div style="color:var(--red);font-weight:700;font-size:11px">⚠️ No vendor linked</div>'}
        </div>

        <div class="hotel-stay-dates">
          <div class="date-field"><label>📅 Check-in (Auto)</label><input type="date" value="${h.checkIn || ''}" readonly></div>
          <div class="date-field"><label>📅 Check-out</label><input type="date" value="${h.checkOut || ''}" onchange="updateHotelDate('makkah',${h.id},'checkOut',this.value)"></div>
        </div>

        <div class="hotel-rooms-block">
          <div class="block-head">
            <div class="title">🛏️ Rooms (${h.rooms.length})</div>
            <button class="btn btn-primary btn-xs" onclick="addHotelRoom('makkah',${h.id},'double')">➕ Add Room</button>
          </div>
          ${h.rooms.length ? h.rooms.map((r, ri) => {
            r.type = normalizeHotelRoomType(r.type) || r.type;
            const cap = ROOM_CAPACITY[r.type] || 2;
            const paxInRoom = (r.adults || 0) + (r.children || 0);
            const mealPerNight = (r.mealRate || 0) * paxInRoom;
            const totalRatePerNight = (r.rate || 0) + mealPerNight;
            const total = totalRatePerNight * (r.nights || 0);
            
            const vendorRoomRate = getHotelRoomVendorRate('makkah', h, r);
            const vendorRateHint = getHotelVendorRateHint('makkah', h, r);
            const vendorMealRate = getHotelVendorMealRate('makkah', h, r.meal);
            const vendorMealPerNight = vendorMealRate * paxInRoom;
            const vendorTotalRatePerNight = vendorRoomRate + vendorMealPerNight;
            const vendorTotal = vendorTotalRatePerNight * (r.nights || 0);
            const roomProfit = vendorRoomRate > 0 && Number(r.rate) > 0 ? total - vendorTotal : null;

            return `<div class="hotel-room-row">
              <div class="rn">R${ri + 1}<small>ROOM</small></div>
              <div class="rc room-type"><label>Type</label>
                <select onchange="updateHotelRoom('makkah',${h.id},${r.id},'type',this.value)">
                  <option value="quad" ${r.type === 'quad' ? 'selected' : ''}>Quad (4)</option>
                  <option value="triple" ${r.type === 'triple' ? 'selected' : ''}>Triple (3)</option>
                  <option value="double" ${r.type === 'double' ? 'selected' : ''}>Double (2)</option>
                  <option value="single" ${r.type === 'single' ? 'selected' : ''}>Single (1)</option>
                </select>
              </div>
              <div class="rc room-adults"><label>Adults</label><input type="number" min="1" max="${cap}" value="${r.adults}" onchange="updateHotelRoom('makkah',${h.id},${r.id},'adults',this.value)"></div>
              <div class="rc room-nights"><label>Nights</label><input type="number" min="0" value="${r.nights || 0}" onchange="updateHotelRoom('makkah',${h.id},${r.id},'nights',this.value)"></div>
              <div class="rc room-vendor-rate"><label>Vendor Cost/Night</label><input type="number" style="text-align:right" value="${vendorRoomRate || ''}" placeholder="No ${r.type} rate" title="${esc(vendorRateHint || 'Hotel section room cost')}" readonly>${vendorRateHint ? `<small class="vendor-rate-hint">${esc(vendorRateHint)}</small>` : ''}</div>
              <div class="rc room-sell-rate"><label>Sell Price/Night</label><input type="number" min="0" value="${r.rate || ''}" placeholder="Enter sell" onchange="updateHotelRoom('makkah',${h.id},${r.id},'rate',this.value)"></div>
              <div class="rc room-meal-rate"><label>Meal Rate/Person</label><input type="number" min="0" value="${r.mealRate || ''}" onchange="updateHotelRoom('makkah',${h.id},${r.id},'mealRate',this.value)" ${r.meal === 'room_only' ? 'disabled' : ''}></div>
              <div class="rc room-meal"><label>Meal</label>
                <select onchange="updateHotelRoom('makkah',${h.id},${r.id},'meal',this.value)">
                  <option value="room_only" ${r.meal === 'room_only' ? 'selected' : ''}>Room Only</option>
                  <option value="breakfast" ${r.meal === 'breakfast' ? 'selected' : ''}>🍳 Breakfast</option>
                  <option value="half_board" ${r.meal === 'half_board' ? 'selected' : ''}>🍱 Half Board</option>
                  <option value="full_board" ${r.meal === 'full_board' ? 'selected' : ''}>🍽️ Full Board</option>
                </select>
              </div>
              <div class="rc room-total">
                <label>Total</label>
                <div class="room-total-box">
                  <div class="sell-line"><span class="lbl">Sell</span><span class="val">${fmt(total)}</span></div>
                  <div class="cost-line"><span class="lbl">Cost</span><span class="val">${fmt(vendorTotal)}</span></div>
                  <div class="profit-line ${roomProfit === null ? 'missing-cost' : roomProfit < 0 ? 'negative' : ''}"><span class="lbl">Profit</span><span class="val">${roomProfit === null ? '—' : (roomProfit >= 0 ? '+' : '') + fmt(roomProfit)}</span></div>
                </div>
              </div>
              <button class="rr-btn" onclick="removeHotelRoom('makkah',${h.id},${r.id})">✕</button>
            </div>`;
          }).join('') : `<div class="hotel-rooms-empty">No rooms — click "+ Add Room"</div>`}

          ${h.rooms.length ? `
            <div class="hotel-rooms-total">
              <div class="sub-item sell">
                <div class="lbl">Customer Sell</div>
                <div class="val">${fmt(hotelTotal)}</div>
                <div class="meta">${h.rooms.length} room(s)</div>
              </div>
              <div class="sub-item cost">
                <div class="lbl">Vendor Cost</div>
                <div class="val">${fmt(hotelVendorCost)}</div>
                <div class="meta">${esc(vendorRateStatus)}</div>
              </div>
              <div class="sub-item profit ${hasProfitData ? '' : 'missing-cost'}">
                <div class="lbl">Profit</div>
                <div class="val ${hotelProfit < 0 ? 'negative' : ''}">${hasProfitData ? (hotelProfit >= 0 ? '+' : '') + fmt(hotelProfit) : '—'}</div>
                <div class="meta">${!hasHotelVendorRates(h, 'makkah') ? esc(vendorRateStatus) : hasProfitData && hotelTotal > 0 ? ((hotelProfit / hotelTotal) * 100).toFixed(1) + '%' : 'Enter sell price to calculate'}</div>
              </div>
              <div class="total-badge">
                <div class="lbl">Total</div>
                <div class="val">${fmt(hotelTotal)}</div>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>`;
  }).join('');

  makkahItems.forEach(h => {
    if (h.hotelId) {
      const sel = el.querySelector(`select[data-selected="${h.hotelId}"]`);
      if (sel) sel.value = h.hotelId;
    }
  });
}

/* ==================== RENDER MADINAH HOTELS ==================== */
function renderMadinahHotelsList() {
  const el = $('madinahHotelsList');
  if (!el) return;

  if ($('madinahHotelCount')) $('madinahHotelCount').textContent = madinahItems.length;
  if (!madinahItems.length) {
    el.innerHTML = '<div class="empty-slot"><span class="ic">🕌</span>No Madinah hotel</div>';
    return;
  }

  const madinahOnlyHotels = STORE.madinahHotels.filter(h => (h.city || 'Madinah').toLowerCase() === 'madinah' || h.cityType === 'madinah');
  const opts = madinahOnlyHotels.map(h => `<option value="${h.id}">${esc(h.name)} — ${esc(h.distance || '')}</option>`).join('');

  el.innerHTML = madinahItems.map((h, i) => {
    const hotelTotal = getHotelTotal(h);
    const hotelVendorCost = getHotelVendorCost(h, 'madinah');
    const missingVendorRoom = h.rooms.find(room => getHotelRoomVendorRate('madinah', h, room) <= 0);
    const vendorRateStatus = missingVendorRoom ? getHotelVendorRateHint('madinah', h, missingVendorRoom) || `Missing ${missingVendorRoom.type} room rate` : 'Hotel section rates included';
    const hasProfitData = hasHotelVendorRates(h, 'madinah') && hasHotelSellRates(h);
    const hotelProfit = hotelTotal - hotelVendorCost;

    return `<div class="item-card">
      <div class="item-card-head">
        <span class="lbl">Madinah Hotel ${i + 1}</span>
        <button class="remove-btn" onclick="removeMadinahHotel(${h.id})">✕</button>
      </div>
      <div class="field" style="margin-bottom:14px">
        <label>Select Hotel</label>
        <select onchange="onMadinahHotelChange(${h.id},this.value)" data-selected="${h.hotelId || ''}">
          <option value="">-- Choose Hotel --</option>${opts}
        </select>
      </div>
      ${h.hotelId ? `
        <div style="padding:10px 14px;background:var(--primary-bg);border-radius:10px;margin-bottom:12px;font-size:12px;line-height:1.7;border-left:3px solid var(--primary)">
          <div>📍 <b>${esc(h.distance) || '—'}</b></div>
          <div>${'⭐'.repeat(parseInt(h.star) || 0)}</div>
          ${h.vendorName ? `<div style="color:var(--blue);font-weight:700">🏢 Vendor: ${esc(h.vendorName)}</div>` : '<div style="color:var(--red);font-weight:700;font-size:11px">⚠️ No vendor linked</div>'}
        </div>

        <div class="hotel-stay-dates">
          <div class="date-field"><label>📅 Check-in (Auto)</label><input type="date" value="${h.checkIn || ''}" readonly></div>
          <div class="date-field"><label>📅 Check-out (Auto)</label><input type="date" value="${h.checkOut || ''}" readonly></div>
        </div>

        <div class="hotel-rooms-block">
          <div class="block-head">
            <div class="title">🛏️ Rooms (${h.rooms.length})</div>
            <button class="btn btn-primary btn-xs" onclick="addHotelRoom('madinah',${h.id},'double')">➕ Add Room</button>
          </div>
          ${h.rooms.length ? h.rooms.map((r, ri) => {
            r.type = normalizeHotelRoomType(r.type) || r.type;
            const cap = ROOM_CAPACITY[r.type] || 2;
            const paxInRoom = (r.adults || 0) + (r.children || 0);
            const mealPerNight = (r.mealRate || 0) * paxInRoom;
            const totalRatePerNight = (r.rate || 0) + mealPerNight;
            const total = totalRatePerNight * (r.nights || 0);
            
            const vendorRoomRate = getHotelRoomVendorRate('madinah', h, r);
            const vendorRateHint = getHotelVendorRateHint('madinah', h, r);
            const vendorMealRate = getHotelVendorMealRate('madinah', h, r.meal);
            const vendorMealPerNight = vendorMealRate * paxInRoom;
            const vendorTotalRatePerNight = vendorRoomRate + vendorMealPerNight;
            const vendorTotal = vendorTotalRatePerNight * (r.nights || 0);
            const roomProfit = vendorRoomRate > 0 && Number(r.rate) > 0 ? total - vendorTotal : null;

            return `<div class="hotel-room-row">
              <div class="rn">R${ri + 1}<small>ROOM</small></div>
              <div class="rc room-type"><label>Type</label>
                <select onchange="updateHotelRoom('madinah',${h.id},${r.id},'type',this.value)">
                  <option value="quad" ${r.type === 'quad' ? 'selected' : ''}>Quad (4)</option>
                  <option value="triple" ${r.type === 'triple' ? 'selected' : ''}>Triple (3)</option>
                  <option value="double" ${r.type === 'double' ? 'selected' : ''}>Double (2)</option>
                  <option value="single" ${r.type === 'single' ? 'selected' : ''}>Single (1)</option>
                </select>
              </div>
              <div class="rc room-adults"><label>Adults</label><input type="number" min="1" max="${cap}" value="${r.adults}" onchange="updateHotelRoom('madinah',${h.id},${r.id},'adults',this.value)"></div>
              <div class="rc room-nights"><label>Nights</label><input type="number" min="0" value="${r.nights || 0}" onchange="updateHotelRoom('madinah',${h.id},${r.id},'nights',this.value)"></div>
              <div class="rc room-vendor-rate"><label>Vendor Cost/Night</label><input type="number" style="text-align:right" value="${vendorRoomRate || ''}" placeholder="No ${r.type} rate" title="${esc(vendorRateHint || 'Hotel section room cost')}" readonly>${vendorRateHint ? `<small class="vendor-rate-hint">${esc(vendorRateHint)}</small>` : ''}</div>
              <div class="rc room-sell-rate"><label>Sell Price/Night</label><input type="number" min="0" value="${r.rate || ''}" placeholder="Enter sell" onchange="updateHotelRoom('madinah',${h.id},${r.id},'rate',this.value)"></div>
              <div class="rc room-meal-rate"><label>Meal Rate/Person</label><input type="number" min="0" value="${r.mealRate || ''}" onchange="updateHotelRoom('madinah',${h.id},${r.id},'mealRate',this.value)" ${r.meal === 'room_only' ? 'disabled' : ''}></div>
              <div class="rc room-meal"><label>Meal</label>
                <select onchange="updateHotelRoom('madinah',${h.id},${r.id},'meal',this.value)">
                  <option value="room_only" ${r.meal === 'room_only' ? 'selected' : ''}>Room Only</option>
                  <option value="breakfast" ${r.meal === 'breakfast' ? 'selected' : ''}>🍳 Breakfast</option>
                  <option value="half_board" ${r.meal === 'half_board' ? 'selected' : ''}>🍱 Half Board</option>
                  <option value="full_board" ${r.meal === 'full_board' ? 'selected' : ''}>🍽️ Full Board</option>
                </select>
              </div>
              <div class="rc room-total">
                <label>Total</label>
                <div class="room-total-box">
                  <div class="sell-line"><span class="lbl">Sell</span><span class="val">${fmt(total)}</span></div>
                  <div class="cost-line"><span class="lbl">Cost</span><span class="val">${fmt(vendorTotal)}</span></div>
                  <div class="profit-line ${roomProfit === null ? 'missing-cost' : roomProfit < 0 ? 'negative' : ''}"><span class="lbl">Profit</span><span class="val">${roomProfit === null ? '—' : (roomProfit >= 0 ? '+' : '') + fmt(roomProfit)}</span></div>
                </div>
              </div>
              <button class="rr-btn" onclick="removeHotelRoom('madinah',${h.id},${r.id})">✕</button>
            </div>`;
          }).join('') : `<div class="hotel-rooms-empty">No rooms</div>`}

          ${h.rooms.length ? `
            <div class="hotel-rooms-total">
              <div class="sub-item sell">
                <div class="lbl">Customer Sell</div>
                <div class="val">${fmt(hotelTotal)}</div>
                <div class="meta">${h.rooms.length} room(s)</div>
              </div>
              <div class="sub-item cost">
                <div class="lbl">Vendor Cost</div>
                <div class="val">${fmt(hotelVendorCost)}</div>
                <div class="meta">${esc(vendorRateStatus)}</div>
              </div>
              <div class="sub-item profit ${hasProfitData ? '' : 'missing-cost'}">
                <div class="lbl">Profit</div>
                <div class="val ${hotelProfit < 0 ? 'negative' : ''}">${hasProfitData ? (hotelProfit >= 0 ? '+' : '') + fmt(hotelProfit) : '—'}</div>
                <div class="meta">${!hasHotelVendorRates(h, 'madinah') ? esc(vendorRateStatus) : hasProfitData && hotelTotal > 0 ? ((hotelProfit / hotelTotal) * 100).toFixed(1) + '%' : 'Enter sell price to calculate'}</div>
              </div>
              <div class="total-badge">
                <div class="lbl">Total</div>
                <div class="val">${fmt(hotelTotal)}</div>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>`;
  }).join('');

  madinahItems.forEach(h => {
    if (h.hotelId) {
      const sel = el.querySelector(`select[data-selected="${h.hotelId}"]`);
      if (sel) sel.value = h.hotelId;
    }
  });
}