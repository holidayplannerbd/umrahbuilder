/* ============================================================
   UMRAH BUILDER — CHATBOT / GEMINI AI (Optimized v2)
   Fast prompt · Response cache · Better model
   ============================================================ */

let GEMINI_CONFIG = {
  apiKey: null,
  enabled: false,
  model: null,
  loaded: false
};

/* ⭐ Response Cache — same query instant reply */
const GEMINI_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/* ==================== LOAD CONFIG ==================== */
async function loadGeminiConfig() {
  // AI keys must never be stored or sent from the browser.
  GEMINI_CONFIG = { apiKey: null, enabled: false, model: null, loaded: false };
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
  throw new Error('Secure AI endpoint is not configured');
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
}
window.clearGeminiCache = clearGeminiCache;

/* ==================== INIT ==================== */
window.addEventListener('load', () => {
  setTimeout(loadGeminiConfig, 1500);
});