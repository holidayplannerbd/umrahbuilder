/* ============================================================
   UMRAH BUILDER — CHATBOT / GEMINI AI (Optimized v2)
   Fast prompt · Response cache · Better model
   ============================================================ */

let GEMINI_CONFIG = {
  apiKey: null,
  enabled: false,
  model: 'gemini-2.5-flash',
  loaded: false
};

/* ⭐ Response Cache — same query instant reply */
const GEMINI_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/* ==================== LOAD CONFIG ==================== */
async function loadGeminiConfig() {
  try {
    const { doc, getDoc } = window.firebaseFns;
    const snap = await getDoc(doc(window.firebaseDB, 'settings', 'gemini_config'));

    if (!snap.exists()) {
      console.log('ℹ️ Gemini config not found in Firestore');
      return;
    }

    const data = snap.data();
    console.log('🔍 Raw Gemini config:', data);

    let config = data;
    if (data.value && typeof data.value === 'object' && data.value.apiKey) {
      config = data.value;
    }

    if (config && config.apiKey && config.enabled === true) {
      GEMINI_CONFIG.apiKey = config.apiKey;
      GEMINI_CONFIG.enabled = true;
      GEMINI_CONFIG.model = config.model || 'gemini-2.5-flash';
      GEMINI_CONFIG.loaded = true;
      console.log('✅ Gemini AI loaded · model:', GEMINI_CONFIG.model);
    } else {
      console.log('ℹ️ Gemini config incomplete:', {
        hasApiKey: !!config?.apiKey,
        enabled: config?.enabled
      });
    }
  } catch (e) {
    console.warn('❌ Gemini config load failed:', e);
  }
}

/* ==================== SHORT BUSINESS CONTEXT (Fast) ==================== */
function buildBusinessContext() {
  const packages = STORE.packages || [];
  const customers = STORE.customers || [];
  const vendors = STORE.vendors || [];

  const activePackages = packages.filter(p => p.status !== 'Cancelled');
  const totalSale = activePackages.reduce((s, p) => s + Number(p.grandTotal || 0), 0);

  let customerPaid = 0;
  customers.forEach(c => {
    (c.payments || []).forEach(pm => { customerPaid += Number(pm.amount || 0); });
  });

  const customerDue = Math.max(0, totalSale - customerPaid);

  return `You are "Umrah Assistant" for a travel agency. Answer briefly (1-3 lines max). Language: match user (Bangla/English). Currency: ৳.
Data: Packages=${packages.length}, Active=${activePackages.length}, Sale=৳${totalSale.toLocaleString()}, Customers=${customers.length}, CustomerDue=৳${customerDue.toLocaleString()}, Vendors=${vendors.length}.`;
}

/* ==================== LIVE DATA SNAPSHOT ==================== */
function buildLiveDataSnapshot(userQuery) {
  const query = String(userQuery || '').toLowerCase();
  const packages = STORE.packages || [];
  const customers = STORE.customers || [];
  const vendors = STORE.vendors || [];

  /* Customer due */
  if (/customer\s*due|কাস্টমার\s*বাকি|কে\s*কত\s*বাকি|due.*customer/i.test(query)) {
    const dueList = [];
    customers.forEach(c => {
      let bill = 0, paid = 0;
      packages.forEach(p => {
        if (p.status === 'Cancelled') return;
        if (p.customerId === c.id || p.customerPhone === c.phone) {
          bill += Number(p.grandTotal || 0);
        }
      });
      (c.payments || []).forEach(pm => { paid += Number(pm.amount || 0); });
      const due = Math.max(0, bill - paid);
      if (due > 0) dueList.push(`${c.customerName}: ৳${due.toLocaleString()}`);
    });
    return dueList.length ? `\nCustomer Due: ${dueList.join(', ')}` : '\nAll customers clear.';
  }

  /* Vendor due */
  if (/vendor\s*due|ভেন্ডর\s*বাকি/i.test(query)) {
    const dueList = [];
    vendors.forEach(v => {
      let paid = 0;
      (v.payments || []).forEach(pm => { paid += Number(pm.amount || 0); });
      if (paid > 0) dueList.push(`${v.name}: ৳${paid.toLocaleString()}`);
    });
    return dueList.length ? `\nVendor Paid: ${dueList.join(', ')}` : '\nNo vendor payments.';
  }

  /* Recent packages */
  if (/package|প্যাকেজ/i.test(query)) {
    const recent = packages.slice(-3).reverse();
    return `\nRecent: ${recent.map(p => `${p.name || 'Untitled'} (৳${Number(p.grandTotal || 0).toLocaleString()})`).join(', ')}`;
  }

  return '';
}

/* ==================== CALL GEMINI API (Optimized) ==================== */
async function callGeminiAPI(userMessage) {
  if (!GEMINI_CONFIG.enabled || !GEMINI_CONFIG.apiKey) {
    throw new Error('Gemini AI not configured');
  }

  /* ⭐ Check Cache */
  const cacheKey = userMessage.toLowerCase().trim();
  const cached = GEMINI_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.time) < CACHE_TTL) {
    console.log('⚡ Cache hit:', cacheKey);
    return cached.response;
  }

  const systemPrompt = buildBusinessContext();
  const dataSnapshot = buildLiveDataSnapshot(userMessage);
  const fullPrompt = `${systemPrompt}${dataSnapshot}\n\nUSER: ${userMessage}\n\nASSISTANT:`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_CONFIG.apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 200,
        topP: 0.9,
        topK: 20
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Gemini API error:', err);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    console.error('Invalid API response:', data);
    throw new Error('Invalid API response');
  }

  const aiText = data.candidates[0].content.parts[0].text;

  /* ⭐ Save to Cache */
  GEMINI_CACHE.set(cacheKey, { response: aiText, time: Date.now() });

  /* ⭐ Keep cache small (max 50 items) */
  if (GEMINI_CACHE.size > 50) {
    const firstKey = GEMINI_CACHE.keys().next().value;
    GEMINI_CACHE.delete(firstKey);
  }

  return aiText;
}

/* ==================== SMART CHATBOT PROCESS ==================== */
async function geminiChatbotProcess(text) {
  if (GEMINI_CONFIG.enabled) {
    try {
      return await callGeminiAPI(text);
    } catch (e) {
      console.warn('Gemini API failed:', e);
      throw e;
    }
  }
  throw new Error('AI not available');
}

/* ==================== CLEAR CACHE (utility) ==================== */
function clearGeminiCache() {
  GEMINI_CACHE.clear();
  console.log('🗑️ Gemini cache cleared');
}
window.clearGeminiCache = clearGeminiCache;

/* ==================== INIT ==================== */
window.addEventListener('load', () => {
  setTimeout(loadGeminiConfig, 1500);
});