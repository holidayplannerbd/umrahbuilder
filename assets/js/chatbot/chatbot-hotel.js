/* ============================================================
   UMRAH BUILDER — CHATBOT / HOTEL
   Room mode (auto/custom) + execute hotel booking + results
   ============================================================ */

/* ==================== ROOM MODE ==================== */
function chatbotRoomMode(mode) {
  document.getElementById('chatbotRoomConfigMsg')?.remove();

  if (mode === 'auto') {
    chatState.step = 'ask_meal';
    saveChatState();
    chatbotAskMeal();
  } else {
    chatState.step = 'custom_rooms';
    chatState.rooms = chatState.rooms || [];
    saveChatState();
    chatbotRenderRoomConfig();
  }
}

/* ==================== RENDER ROOM CONFIG ==================== */
function chatbotRenderRoomConfig() {
  const wrap = $('chatbotMessages');
  if (!wrap) return;

  const totalAssigned = (chatState.rooms || []).reduce(
    (s, r) => s + (r.adults || 0) + (r.children || 0), 0
  );

  const roomsHtml = (chatState.rooms || []).length
    ? chatState.rooms.map((r, i) => `
        <div class="chatbot-room-config" style="margin-bottom:6px">
          <div class="rc-row">
            <select onchange="chatbotUpdateRoom(${i},'type',this.value)">
              <option value="quad" ${r.type === 'quad' ? 'selected' : ''}>Quad</option>
              <option value="triple" ${r.type === 'triple' ? 'selected' : ''}>Triple</option>
              <option value="double" ${r.type === 'double' ? 'selected' : ''}>Double</option>
              <option value="single" ${r.type === 'single' ? 'selected' : ''}>Single</option>
            </select>
            <input type="number" min="1" value="${r.adults}" onchange="chatbotUpdateRoom(${i},'adults',this.value)">
            <input type="number" min="0" value="${r.children || 0}" onchange="chatbotUpdateRoom(${i},'children',this.value)">
            <button class="rm" onclick="chatbotRemoveRoom(${i})">✕</button>
          </div>
        </div>
      `).join('')
    : '<div style="padding:10px;background:var(--bg-2);border-radius:8px;font-size:11.5px;color:var(--text-3);text-align:center">No rooms</div>';

  const html = `
    <div class="chatbot-bubble" style="max-width:100%">
      ✏️ <b>Custom Room Setup</b><br>
      <span style="font-size:11.5px;color:var(--text-3)">Total: <b>${chatState.pax || 0}</b> · Assigned: <b>${totalAssigned}</b></span>
      <div style="margin-top:10px">
        ${roomsHtml}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <!-- ADD ROOM Button — Inline Style -->
        <button 
          onclick="chatbotAddRoom()" 
          style="
            width: 100%;
            padding: 12px 16px;
            background: #fff7ed;
            color: #ea580c;
            border: 1.5px solid #f97316;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all .25s cubic-bezier(.4,0,.2,1);
            box-shadow: 0 2px 8px rgba(249,115,22,.12);
            letter-spacing: .3px;
          "
          onmouseover="this.style.background='linear-gradient(135deg, #f97316 0%, #ea580c 100%)'; this.style.color='#ffffff'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(249,115,22,.4)'"
          onmouseout="this.style.background='#fff7ed'; this.style.color='#ea580c'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(249,115,22,.12)'"
        >
          ➕ Add Room
        </button>

        <!-- DONE Button — Inline Style -->
        <button 
          onclick="chatbotFinishRooms()" 
          style="
            width: 100%;
            padding: 12px 16px;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 900;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all .25s cubic-bezier(.4,0,.2,1);
            box-shadow: 0 4px 14px rgba(249,115,22,.35), inset 0 1px 0 rgba(255,255,255,.25);
            letter-spacing: .3px;
          "
          onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 10px 26px rgba(249,115,22,.55), inset 0 1px 0 rgba(255,255,255,.3)'"
          onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 14px rgba(249,115,22,.35), inset 0 1px 0 rgba(255,255,255,.25)'"
        >
          ✅ Done (${totalAssigned}/${chatState.pax || 0})
        </button>
      </div>
    </div>
  `;

  let existing = document.getElementById('chatbotRoomConfigMsg');
  if (existing) {
    existing.innerHTML = html;
  } else {
    const div = document.createElement('div');
    div.className = 'chatbot-msg bot';
    div.id = 'chatbotRoomConfigMsg';
    div.innerHTML = html;
    wrap.appendChild(div);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

function refreshChatRoomConfig() {
  chatbotRenderRoomConfig();
  saveChatState();
}

function chatbotAddRoom() {
  if (!Array.isArray(chatState.rooms)) chatState.rooms = [];
  chatState.rooms.push({ type: 'double', adults: 2, children: 0 });
  saveChatState();
  refreshChatRoomConfig();
}

function chatbotUpdateRoom(idx, field, value) {
  if (!Array.isArray(chatState.rooms) || !chatState.rooms[idx]) return;

  if (field === 'type') {
    chatState.rooms[idx].type = value;
    chatState.rooms[idx].adults = { quad: 4, triple: 3, double: 2, single: 1 }[value] || 2;
  } else {
    chatState.rooms[idx][field] = parseInt(value) || 0;
  }
  saveChatState();
  refreshChatRoomConfig();
}

function chatbotRemoveRoom(idx) {
  if (!Array.isArray(chatState.rooms) || idx < 0 || idx >= chatState.rooms.length) return;
  chatState.rooms.splice(idx, 1);
  saveChatState();
  refreshChatRoomConfig();
}

function chatbotFinishRooms() {
  const totalAssigned = (chatState.rooms || []).reduce(
    (s, r) => s + (r.adults || 0) + (r.children || 0), 0
  );
  if (totalAssigned !== chatState.pax) {
    toast(`Assigned (${totalAssigned}) ≠ pax (${chatState.pax})`, 'warning');
  }
  document.getElementById('chatbotRoomConfigMsg')?.remove();
  chatState.step = 'ask_meal';
  saveChatState();
  chatbotAskMeal();
}

/* ==================== EXECUTE HOTEL BOOKING ==================== */
function chatbotExecuteHotel() {
  document.getElementById('chatbotRoomConfigMsg')?.remove();

  const cities = chatState.cities || [];
  if (!cities.length) {
    chatbotAddHtml('<div class="chatbot-bubble">শহর missing।</div>');
    return;
  }

  chatState.results = [];

  for (const city of cities) {
    const hotels = city === 'makkah' ? STORE.makkahHotels : STORE.madinahHotels;
    let filtered = hotels.slice().filter(h => !isHotelExpired(h));

    if (chatState.star && chatState.star !== 'all') {
      filtered = filtered.filter(h => String(h.star) === String(chatState.star));
    }

    if (!filtered.length) {
      chatState.results.push({ city, error: `No ${chatState.star || ''}⭐ hotels` });
      continue;
    }

    const roomType = chatState.roomType || 'double';

    /* Lowest rate first */
    filtered.sort((a, b) => (a[roomType] || 999999) - (b[roomType] || 999999));

    const hotel = filtered[0];
    const rate = hotel[roomType] || 0;
    const nights = chatState.nights || 0;
    const pax = chatState.pax || 0;

    /* Meal rate */
    const mealRateMap = {
      room_only: 0,
      breakfast: hotel.breakfast || 0,
      half_board: hotel.halfBoard || 0,
      full_board: hotel.fullBoard || 0
    };
    const mealRate = mealRateMap[chatState.meal] || 0;

    /* Room lines */
    let roomLines = [], totalRooms = 0, totalAdults = 0;

    if (chatState.rooms && chatState.rooms.length) {
      /* Custom rooms */
      roomLines = chatState.rooms.map(r => {
        const rRate = hotel[r.type] || 0;
        const total = rRate * nights;
        totalRooms++;
        totalAdults += (r.adults || 0);
        return {
          type: r.type,
          adults: r.adults,
          children: r.children,
          rate: rRate,
          nights,
          total
        };
      });
      } else {
      /* ⭐ Smart Auto Room Distribution
         Always prefer: Quad → Triple → Double → Single
         Example:
         - 9 pax = 2 Quad (8) + 1 Single (1)
         - 6 pax = 1 Quad (4) + 1 Double (2)
         - 7 pax = 1 Quad (4) + 1 Triple (3)
         - 8 pax = 2 Quad (8)
         - 10 pax = 2 Quad (8) + 1 Double (2)
      */
      const ROOM_ORDER = [
        { type: 'quad', cap: 4 },
        { type: 'triple', cap: 3 },
        { type: 'double', cap: 2 },
        { type: 'single', cap: 1 }
      ];

      let remaining = pax;
      const autoRooms = [];

      /* First pass: use largest rooms (Quad) as much as possible */
      for (const room of ROOM_ORDER) {
        while (remaining >= room.cap) {
          autoRooms.push({ type: room.type, adults: room.cap });
          remaining -= room.cap;
        }
      }

      /* Second pass: if remaining > 0, replace LAST room with combination */
      /* Example: 6 pax = 1 Quad (4) + remaining 2 = 1 Double
         7 pax = 1 Quad (4) + remaining 3 = 1 Triple
         5 pax = 1 Quad (4) + remaining 1 = 1 Single
         9 pax = 2 Quad (8) + remaining 1 = 1 Single
         10 pax = 2 Quad (8) + remaining 2 = 1 Double
         11 pax = 2 Quad (8) + remaining 3 = 1 Triple
      */
      if (remaining > 0) {
        /* Find room type that fits remaining exactly */
        const matchingRoom = ROOM_ORDER.find(r => r.cap === remaining);
        if (matchingRoom) {
          autoRooms.push({ type: matchingRoom.type, adults: remaining });
        } else {
          /* Fallback: use smallest room that fits */
          const fitRoom = ROOM_ORDER.slice().reverse().find(r => r.cap >= remaining);
          if (fitRoom) {
            autoRooms.push({ type: fitRoom.type, adults: remaining });
          }
        }
        remaining = 0;
      }

      /* Build room lines with correct rate for each room type */
      autoRooms.forEach(room => {
        const rRate = hotel[room.type] || 0;
        const rTotal = rRate * nights;
        
        roomLines.push({
          type: room.type,
          adults: room.adults,
          children: 0,
          rate: rRate,
          nights: nights,
          total: rTotal
        });
        
        totalAdults += room.adults;
        totalRooms++;
      });
    }

    const roomCost = roomLines.reduce((s, r) => s + r.total, 0);
    const mealCost = mealRate * nights * pax;
    const total = roomCost + mealCost;

    chatState.results.push({
      city,
      hotel,
      roomLines,
      nights,
      pax,
      meal: chatState.meal,
      mealRate,
      roomCost,
      mealCost,
      total,
      totalRooms
    });
  }

  chatbotShowHotelResults();
}

/* ==================== SHOW HOTEL RESULTS ==================== */
function chatbotShowHotelResults() {
  const results = chatState.results || [];
  let totalAll = 0;
  let html = '<div class="chatbot-bubble" style="max-width:100%"><b>📊 Booking Summary</b><br><br>';

  results.forEach(r => {
    if (r.error) {
      html += `<div style="padding:10px;background:var(--red-bg);border-radius:8px;margin-bottom:8px;color:var(--red);font-size:12px">${esc(r.city.toUpperCase())}: ${r.error}</div>`;
      return;
    }
    totalAll += r.total;

    html += `<div style="padding:12px;background:var(--card);border-radius:10px;border:1px solid var(--border);margin-bottom:8px">
      <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:6px">🕌 ${r.city.toUpperCase()}</div>
      <div style="font-size:13px;font-weight:800;margin-bottom:4px">${esc(r.hotel.name)}</div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">📍 ${esc(r.hotel.distance) || '—'} · ${'⭐'.repeat(r.hotel.star)}</div>
      ${r.roomLines.map((rl, i) => `
        <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0">
          <span>R${i + 1}: ${rl.type.toUpperCase()} · ${rl.adults}A · ${rl.nights}N × ${fmt(rl.rate)}</span>
          <b>${fmt(rl.total)}</b>
        </div>
      `).join('')}
      <div style="height:1px;background:var(--border);margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0">
        <span>Meal:</span><b>${fmt(r.mealCost)}</b>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0 0;border-top:2px solid var(--primary);margin-top:6px">
        <b>Subtotal:</b><span style="color:var(--primary);font-weight:900">${fmt(r.total)}</span>
      </div>
    </div>`;
  });

  if (totalAll > 0) {
    const totalPax = results.reduce((s, r) => s + (r.pax || 0), 0);
    const perPerson = totalPax > 0 ? Math.round(totalAll / totalPax) : 0;
    html += `<div style="padding:14px;background:linear-gradient(135deg,var(--primary-bg),var(--card));border-radius:12px;border:2px solid var(--primary);margin-top:8px">
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900">
        <span>GRAND TOTAL:</span>
        <span style="color:var(--primary)">${fmt(totalAll)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-2);margin-top:6px">
        <span>Per Person:</span><b>${fmt(perPerson)}</b>
      </div>
    </div>`;
  }

  html += `</div>`;
  chatbotAddHtml(html);

  chatbotAddActions([
    { label: 'আরো Hotel', icon: '🏨', onclick: "chatbotAsk('hotel')", type: 'secondary' },
    { label: 'Ziyarah', icon: '★', onclick: "chatbotAsk('ziyarah')", type: 'secondary' },
    { label: 'নতুন শুরু', icon: '🔄', onclick: 'chatbotReset()', type: 'primary' }
  ]);

  /* Reset state */
  chatState = {
    step: null, mode: null, cities: [], star: null, nights: null,
    roomType: null, pax: null, meal: null, rooms: [], results: [],
    transportId: null, ziyarahId: null, pendingListCity: null, ziyarahPax: null
  };
  saveChatState();
}