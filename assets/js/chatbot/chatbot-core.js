/* ============================================================
   UMRAH BUILDER — CHATBOT / CORE
   Chat state, toggle, reset, message helpers, process
   With Gemini AI Fallback + Animated Loading
   ============================================================ */

/* chatState, chatbotHotelListState declared in state.js */

/* ==================== SAVE / LOAD STATE ==================== */
function saveChatState() {
  try {
    localStorage.setItem('umrah_chat_state', JSON.stringify({ ...chatState }));
  } catch (e) {}
}

function loadChatState() {
  try {
    const raw = localStorage.getItem('umrah_chat_state');
    if (raw) chatState = { ...chatState, ...JSON.parse(raw) };
    if (chatState.step === 'custom_rooms') {
      chatState.step = null;
      chatState.rooms = [];
      saveChatState();
    }
  } catch (e) {}
}

/* ==================== TOGGLE CHATBOT ==================== */
function toggleChatbot() {
  const panel = $('chatbotPanel');
  if (!panel) return;
  panel.classList.toggle('act');
  if (panel.classList.contains('act')) {
    setTimeout(() => $('chatbotInput')?.focus(), 300);
  }
}

/* ==================== RESET CHATBOT ==================== */
function chatbotReset() {
  document.getElementById('chatbotRoomConfigMsg')?.remove();
  const wrap = $('chatbotMessages');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="chatbot-msg bot">
      <div class="chatbot-bubble">
        আসসালামু আলাইকুম! 👋<br>
        আমি আপনার <b>Booking Assistant</b>।<br><br>
        <b>Try করুন:</b><br>
        <i>"makkah ziyarah 8 jon"</i><br>
        <i>"madinah ziyarah 16 jon"</i><br>
        <i>"makkah 3 star hotel list"</i><br>
        <i>"hi kemon acho?"</i>
      </div>
    </div>
    <div class="chatbot-quick-actions">
      <button class="chatbot-quick-btn" onclick="chatbotAsk('hotel')">🏨 Hotel Booking</button>
      <button class="chatbot-quick-btn" onclick="chatbotAsk('hotel_list')">📋 Hotel List</button>
      <button class="chatbot-quick-btn" onclick="chatbotAsk('ziyarah')">★ Ziyarah Car</button>
      <button class="chatbot-quick-btn" onclick="chatbotAsk('help')">❓ Help</button>
    </div>
  `;

  chatState = {
    step: null, mode: null, cities: [], star: null, nights: null,
    roomType: null, pax: null, meal: null, rooms: [], results: [],
    transportId: null, ziyarahId: null, pendingListCity: null, ziyarahPax: null
  };
  saveChatState();
}

/* ==================== MESSAGE HELPERS ==================== */
function chatbotAddMessage(text, sender = 'bot') {
  const wrap = $('chatbotMessages');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'chatbot-msg ' + sender;
  div.innerHTML = `<div class="chatbot-bubble">${text}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatbotAddHtml(html) {
  const wrap = $('chatbotMessages');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'chatbot-msg bot';
  div.innerHTML = html;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatbotAddActions(actions) {
  const wrap = $('chatbotMessages');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'chatbot-msg bot chatbot-msg-actions';
  div.innerHTML = `<div class="chatbot-actions-block">
    ${actions.map(a => `<button class="chatbot-action-btn ${a.type || 'secondary'}" onclick="${a.onclick}">${a.icon ? `<span style="margin-right:6px">${a.icon}</span>` : ''}${a.label}</button>`).join('')}
  </div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

/* ==================== AI FALLBACK HELPER (with animated dots) ==================== */
function chatbotTryAI(text) {
  /* Check Gemini config */
  if (typeof GEMINI_CONFIG === 'undefined' || !GEMINI_CONFIG.enabled || !GEMINI_CONFIG.apiKey) {
    return false;
  }

  const thinkingId = 'ai-think-' + Date.now();
  chatbotAddHtml(`<div class="chatbot-bubble" id="${thinkingId}">
    <span class="ai-dots"><span></span><span></span><span></span></span>
    <span style="color:var(--text-3);font-size:13px;vertical-align:middle">AI ভাবছে...</span>
  </div>`);

  callGeminiAPI(text).then(aiResponse => {
    const el = document.getElementById(thinkingId);
    if (el) {
      el.outerHTML = `<div class="chatbot-bubble">${esc(aiResponse).replace(/\n/g, '<br>')}</div>`;
    }
    const wrap = $('chatbotMessages');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }).catch(e => {
    console.warn('Gemini AI failed:', e);
    const el = document.getElementById(thinkingId);
    if (el) {
      el.outerHTML = `<div class="chatbot-bubble">দুঃখিত, AI সাময়িকভাবে কাজ করছে না 😔<br><br>Try করুন:<br><i>"makkah ziyarah 8 jon"</i><br><i>"customer due"</i></div>`;
    }
  });

  return true;
}

/* ==================== SEND MESSAGE ==================== */
function chatbotSend() {
  const input = $('chatbotInput');
  const text = input.value.trim();
  if (!text) return;

  chatbotAddMessage(esc(text), 'user');
  input.value = '';
  setTimeout(() => chatbotProcess(text), 400);
}

/* ==================== ASK (quick commands) ==================== */
function chatbotAsk(command) {
  if (command === 'help') {
    chatbotAddHtml(`<div class="chatbot-bubble"><b>🤖 আমি যা করতে পারি:</b><br><br><b>1. Hotel List:</b><br><i>"makkah 3 star hotel list"</i><br><br><b>2. Ziyarah Car Calculation:</b><br><i>"makkah ziyarah 8 jon"</i><br><i>"madinah ziyarah 16 jon"</i><br><br><b>3. নির্দিষ্ট Hotel:</b><br><i>"swissotel price"</i><br><br><b>4. AI Chat:</b><br>যেকোনো প্রশ্ন লিখুন — AI উত্তর দেবে 🤖</div>`);
    return;
  }

  if (command === 'hotel') {
    chatState = { ...chatState, step: 'ask_cities', mode: 'hotel' };
    saveChatState();
    chatbotAddHtml(`<div class="chatbot-bubble">🏨 <b>Hotel Booking</b><br><br>কোন শহর?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotPick('city','makkah')">🕌 Makkah</button><button class="chatbot-option-btn" onclick="chatbotPick('city','madinah')">🕌 Madinah</button><button class="chatbot-option-btn" onclick="chatbotPick('city','both')">🕌 Both</button></div></div>`);
    return;
  }

  if (command === 'hotel_list') {
    chatState.step = 'ask_list_city';
    chatState.mode = 'hotel_list';
    saveChatState();
    chatbotAddHtml(`<div class="chatbot-bubble">📋 <b>Hotel List</b><br><br>কোন শহরের?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotListCity('makkah')">🕌 Makkah</button><button class="chatbot-option-btn" onclick="chatbotListCity('madinah')">🕌 Madinah</button></div></div>`);
    return;
  }

  if (command === 'ziyarah') {
    const ziyarahList = STORE.ziyarah;
    if (!ziyarahList.length) {
      chatbotAddHtml('<div class="chatbot-bubble">★ কোনো Ziyarah Master Data নেই। Dashboard → Ziyarah-এ add করুন।</div>');
      return;
    }
    chatState.mode = 'ziyarah';
    chatState.step = 'ziyarah_select';
    saveChatState();
    chatbotAddHtml(`<div class="chatbot-bubble">★ <b>Ziyarah</b> — কোনটা?</div><div class="chatbot-list">${ziyarahList.map((z, i) => `<div class="chatbot-list-item" onclick="chatbotPickZiyarah(${z.id})"><div class="info"><div class="name">${i + 1}. ${esc(z.name)}</div><div class="meta">${esc(z.city)}${z.duration ? ' · ' + esc(z.duration) : ''}</div></div></div>`).join('')}</div>`);
    return;
  }
}

/* ==================== PROCESS USER INPUT ==================== */
function chatbotProcess(rawText) {
  const text = String(rawText || '').toLowerCase();

  /* Step-based flow */
  if (chatState.step) {
    chatbotHandleStep(text);
    return;
  }

  /* 1. Exact hotel name match */
  const allHotels = [...STORE.makkahHotels, ...STORE.madinahHotels];
  for (const h of allHotels) {
    if (text.includes(h.name.toLowerCase())) {
      const city = h.cityType === 'makkah' ? 'makkah' : 'madinah';
      chatbotHotelDetail(h.id, city);
      return;
    }
  }

  /* 2. Ziyarah with city + pax */
  const ziyarahMatch = text.match(/(makkah|madinah|মক্কা|মদিনা)\s*(ziyarah|জিয়ারাহ|ziyara|ziyarat)/i);
  if (ziyarahMatch) {
    const city = /makkah|মক্কা/i.test(ziyarahMatch[1]) ? 'Makkah' : 'Madinah';
    const z = STORE.ziyarah.find(x => x.city === city);
    if (!z) {
      chatbotAddHtml(`<div class="chatbot-bubble">😔 ${city} Ziyarah Master Data নেই। Dashboard → Ziyarah-এ add করুন।</div>`);
      return;
    }
    const paxMatch = text.match(/(\d+)\s*(?:jon|jan|manush|প্যাক্স|pax|person|জন|people|adult)/i);
    if (paxMatch) {
      chatState.ziyarahId = z.id;
      chatbotZiyarahPax(parseInt(paxMatch[1]));
      return;
    }
    chatbotPickZiyarah(z.id);
    return;
  }

  /* 3. Hotel list */
  if (/(hotel|হোটেল)\s*(list|লিস্ট)/i.test(text) || /list\s*(hotel|হোটেল)/i.test(text)) {
    const cityMatch = text.match(/(makkah|madinah|মক্কা|মদিনা)/i);
    if (cityMatch) {
      const city = /makkah|মক্কা/i.test(cityMatch[0]) ? 'makkah' : 'madinah';
      const starMatch = text.match(/(\d)\s*star/i);
      if (starMatch) { chatbotListStar(city, parseInt(starMatch[1])); return; }
      chatbotListCity(city);
      return;
    }
    chatbotAsk('hotel_list');
    return;
  }

  /* 4. Star + city list */
  const starCityMatch = text.match(/(makkah|madinah|মক্কা|মদিনা).*?(\d)\s*star/i);
  if (starCityMatch) {
    const city = /makkah|মক্কা/i.test(starCityMatch[1]) ? 'makkah' : 'madinah';
    chatbotListStar(city, parseInt(starCityMatch[2]));
    return;
  }

  /* 5. General hotel booking */
  if (/hotel|হোটেল/i.test(text)) {
    const hasMakkah = /makkah|মক্কা/i.test(text);
    const hasMadinah = /madinah|মদিনা/i.test(text);
    const nightsMatch = text.match(/(\d+)\s*(?:rat|night|raat|রাত|nights)/i);
    const paxMatch = text.match(/(\d+)\s*(?:pax|person|manush|জন|people|adult)/i);
    const starMatch = text.match(/(\d)\s*star|(\d)\s*⭐/i);

    if ((hasMakkah || hasMadinah) && nightsMatch && paxMatch) {
      const nights = parseInt(nightsMatch[1]);
      const pax = parseInt(paxMatch[1]);
      const star = starMatch ? parseInt(starMatch[1] || starMatch[2]) : null;

      chatState.mode = 'hotel';
      chatState.nights = nights;
      chatState.pax = pax;
      chatState.star = star;
      chatState.cities = [];
      if (hasMakkah) chatState.cities.push('makkah');
      if (hasMadinah) chatState.cities.push('madinah');
      chatState.results = [];
      chatState.rooms = [];

      if (/quad/i.test(text)) chatState.roomType = 'quad';
      else if (/triple/i.test(text)) chatState.roomType = 'triple';
      else if (/double/i.test(text)) chatState.roomType = 'double';
      else if (/single/i.test(text)) chatState.roomType = 'single';

      if (/full\s*board/i.test(text)) chatState.meal = 'full_board';
      else if (/half\s*board/i.test(text)) chatState.meal = 'half_board';
      else if (/breakfast/i.test(text)) chatState.meal = 'breakfast';
      else if (/room\s*only/i.test(text)) chatState.meal = 'room_only';

      saveChatState();

      if (!chatState.roomType) {
        chatState.step = 'ask_roomType';
        saveChatState();
        chatbotAddHtml(`<div class="chatbot-bubble">✅ <b>${nights} nights · ${pax} pax</b>${star ? ' · ' + star + '⭐' : ''}<br><br>Room distribution?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotRoomMode('auto')">🤖 Auto</button><button class="chatbot-option-btn" onclick="chatbotRoomMode('custom')">✏️ Custom</button></div></div>`);
        return;
      }
      chatbotExecuteHotel();
      return;
    }
    chatbotAsk('hotel');
    return;
  }

  /* 6. Just "ziyarah" */
  if (/ziyarah|জিয়ারাহ|ziyara|ziyarat/i.test(text)) {
    chatbotAsk('ziyarah');
    return;
  }

  /* ⭐ 7. AI FALLBACK (Gemini) */
  if (chatbotTryAI(rawText)) {
    return;
  }

  /* 8. Final fallback (no AI) */
  chatbotAddHtml(`<div class="chatbot-bubble">আমি ঠিক বুঝতে পারিনি 🤔<br><br><div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotAsk('hotel')">🏨 Hotel Booking</button><button class="chatbot-option-btn" onclick="chatbotAsk('hotel_list')">📋 Hotel List</button><button class="chatbot-option-btn" onclick="chatbotAsk('ziyarah')">★ Ziyarah Car</button></div></div>`);
}

/* ==================== HANDLE STEP INPUT ==================== */
function chatbotHandleStep(text) {
  const step = chatState.step;

  if (step === 'ask_list_star') {
    const m = text.match(/(\d)/);
    if (m) { chatbotListStar(chatState.pendingListCity, parseInt(m[1])); return; }
    if (/all|সব/i.test(text)) { chatbotListStar(chatState.pendingListCity, 'all'); return; }
  }

  if (step === 'ask_cities') {
    if (/makkah|মক্কা/i.test(text)) { chatState.cities = ['makkah']; chatState.step = 'ask_star'; saveChatState(); chatbotAskStar(); return; }
    if (/madinah|মদিনা/i.test(text)) { chatState.cities = ['madinah']; chatState.step = 'ask_star'; saveChatState(); chatbotAskStar(); return; }
    if (/both|দুটো/i.test(text)) { chatState.cities = ['makkah', 'madinah']; chatState.step = 'ask_star'; saveChatState(); chatbotAskStar(); return; }
  }

  if (step === 'ask_star') {
    const m = text.match(/(\d)/);
    if (m) { chatState.star = parseInt(m[1]); chatState.step = 'ask_nights'; saveChatState(); chatbotAskNights(); return; }
  }

  if (step === 'ask_nights') {
    const m = text.match(/(\d+)/);
    if (m) { chatState.nights = parseInt(m[1]); chatState.step = 'ask_pax'; saveChatState(); chatbotAskPax(); return; }
  }

  if (step === 'ask_pax') {
    const m = text.match(/(\d+)/);
    if (m) { chatState.pax = parseInt(m[1]); chatState.step = 'ask_roomType'; saveChatState(); chatbotAskRoomMode(); return; }
  }

  if (step === 'ask_roomType') {
    if (/quad/i.test(text)) chatState.roomType = 'quad';
    else if (/triple/i.test(text)) chatState.roomType = 'triple';
    else if (/double/i.test(text)) chatState.roomType = 'double';
    else if (/single/i.test(text)) chatState.roomType = 'single';
    if (chatState.roomType) { chatState.step = 'ask_meal'; saveChatState(); chatbotAskMeal(); return; }
  }

  if (step === 'ask_meal') {
    if (/full/i.test(text)) chatState.meal = 'full_board';
    else if (/half/i.test(text)) chatState.meal = 'half_board';
    else if (/break|ব্রেক/i.test(text)) chatState.meal = 'breakfast';
    else if (/room|only|না/i.test(text)) chatState.meal = 'room_only';
    if (chatState.meal) { chatbotExecuteHotel(); return; }
  }

  if (step === 'ziyarah_pax') {
    const m = text.match(/(\d+)/);
    if (m) { chatbotZiyarahPax(parseInt(m[1])); return; }
  }

  if (step === 'ziyarah_select') {
    const m = text.match(/(\d+)/);
    if (m) {
      const list = STORE.ziyarah;
      const idx = parseInt(m[1]) - 1;
      if (list[idx]) { chatbotPickZiyarah(list[idx].id); return; }
    }
  }

  /* ⭐ Unknown input at step → try AI */
  if (chatbotTryAI(text)) {
    return;
  }

  chatbotAddHtml(`<div class="chatbot-bubble">দয়া করে option select করুন।</div>`);
}

/* ==================== ASK HELPERS ==================== */
function chatbotAskRoomMode() {
  chatbotAddHtml(`<div class="chatbot-bubble">Room distribution?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotRoomMode('auto')">🤖 Auto</button><button class="chatbot-option-btn" onclick="chatbotRoomMode('custom')">✏️ Custom</button></div></div>`);
}

function chatbotAskStar() {
  chatbotAddHtml(`<div class="chatbot-bubble">কত স্টার?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotPick('star',3)">3⭐</button><button class="chatbot-option-btn" onclick="chatbotPick('star',4)">4⭐</button><button class="chatbot-option-btn" onclick="chatbotPick('star',5)">5⭐</button><button class="chatbot-option-btn" onclick="chatbotPick('star','all')">All</button></div></div>`);
}

function chatbotAskNights() {
  chatbotAddHtml(`<div class="chatbot-bubble">কত রাত?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotPick('nights',3)">3</button><button class="chatbot-option-btn" onclick="chatbotPick('nights',5)">5</button><button class="chatbot-option-btn" onclick="chatbotPick('nights',7)">7</button><button class="chatbot-option-btn" onclick="chatbotPick('nights',10)">10</button><button class="chatbot-option-btn" onclick="chatbotPick('nights',14)">14</button></div></div>`);
}

function chatbotAskPax() {
  chatbotAddHtml(`<div class="chatbot-bubble">কতজন?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotPick('pax',2)">2</button><button class="chatbot-option-btn" onclick="chatbotPick('pax',3)">3</button><button class="chatbot-option-btn" onclick="chatbotPick('pax',4)">4</button><button class="chatbot-option-btn" onclick="chatbotPick('pax',5)">5</button><button class="chatbot-option-btn" onclick="chatbotPick('pax',8)">8</button></div></div>`);
}

function chatbotAskMeal() {
  chatbotAddHtml(`<div class="chatbot-bubble">Meal?<div class="chatbot-options"><button class="chatbot-option-btn" onclick="chatbotPick('meal','room_only')">Room Only</button><button class="chatbot-option-btn" onclick="chatbotPick('meal','breakfast')">🍳 Breakfast</button><button class="chatbot-option-btn" onclick="chatbotPick('meal','half_board')">🍱 Half Board</button><button class="chatbot-option-btn" onclick="chatbotPick('meal','full_board')">🍽️ Full Board</button></div></div>`);
}

/* ==================== PICK (button clicks) ==================== */
function chatbotPick(field, value) {
  if (field === 'city') {
    if (value === 'makkah') chatState.cities = ['makkah'];
    else if (value === 'madinah') chatState.cities = ['madinah'];
    else chatState.cities = ['makkah', 'madinah'];
    chatState.step = 'ask_star';
    saveChatState();
    chatbotAskStar();
    return;
  }
  if (field === 'star') { chatState.star = value; chatState.step = 'ask_nights'; saveChatState(); chatbotAskNights(); return; }
  if (field === 'nights') { chatState.nights = value; chatState.step = 'ask_pax'; saveChatState(); chatbotAskPax(); return; }
  if (field === 'pax') { chatState.pax = value; chatState.step = 'ask_roomType'; saveChatState(); chatbotAskRoomMode(); return; }
  if (field === 'roomType') { chatState.roomType = value; chatState.step = 'ask_meal'; saveChatState(); chatbotAskMeal(); return; }
  if (field === 'meal') { chatState.meal = value; chatbotExecuteHotel(); return; }
}

/* ==================== OUTSIDE CLICK ==================== */
document.addEventListener('click', e => {
  const panel = $('chatbotPanel');
  const fab = $('chatbotFab');
  if (!panel || !fab) return;
  if (!panel.classList.contains('act')) return;
  if (panel.contains(e.target) || fab.contains(e.target)) return;

  // ⭐ বাটন বা ইন্টারঅ্যাক্টিভ এলিমেন্টে ক্লিক হলে প্যানেল বন্ধ হবে না
  const tag = (e.target.tagName || '').toLowerCase();
  if (['select', 'option', 'input', 'textarea', 'button', 'a', 'label'].includes(tag)) return;
  
  // ⭐ চ্যাটবটের ভেতরের যেকোনো ক্লিকেবল এলিমেন্টে ক্লিক হলে প্যানেল বন্ধ হবে না
  if (e.target.closest('.chatbot-messages')) return;
  if (e.target.closest('.chatbot-options')) return;
  if (e.target.closest('.chatbot-room-config')) return;
  if (e.target.closest('.chatbot-actions-block')) return;
  if (e.target.closest('.chatbot-load-more')) return; // ⭐ Load More বাটন
  if (e.target.closest('.chatbot-hotel-card')) return; // ⭐ Hotel Card ক্লিক

  panel.classList.remove('act');
});