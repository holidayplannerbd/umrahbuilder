/* ============================================================
   UMRAH BUILDER — APP INIT (v6 — Safe Navigation)
   ============================================================ */

async function init() {
  try {
    if (window.firebaseAuthStateReady) {
      const user = await window.firebaseAuthStateReady;
      if (!user) return;
    }
    await openDB();

    if (window.firebaseAuth?.currentUser && typeof loadUserRole === 'function') {
      await loadUserRole();
    }
    if (typeof updateUserUI === 'function') await updateUserUI();

    const role = (window.currentUserRole || 'admin').toLowerCase();

    if (role === 'admin') {
      try {
        await dbDelete(STORES.settings, 'gemini_config');
      } catch (e) {}
    }

    const getForAdmin = async (storeName) => role === 'admin' ? dbGetAll(storeName) : [];
    const getForAdminAndAccountant = async (storeName) =>
      role === 'admin' || role === 'accountant' ? dbGetAll(storeName) : [];

    const [mk, md, f, t, v, z, sv, p, c, vend, pay, fu] = await Promise.all([
      getForAdmin(STORES.makkahHotels),
      getForAdmin(STORES.madinahHotels),
      getForAdmin(STORES.flights),
      getForAdmin(STORES.transports),
      getForAdmin(STORES.visas),
      getForAdmin(STORES.ziyarah),
      getForAdmin(STORES.services),
      dbGetAll(STORES.packages),
      getForAdminAndAccountant(STORES.customers),
      getForAdminAndAccountant(STORES.vendors),
      getForAdminAndAccountant(STORES.payments),
      getForAdmin(STORES.followups)
    ]);

    STORE.makkahHotels = mk; STORE.madinahHotels = md; STORE.flights = f;
    STORE.transports = t; STORE.visas = v; STORE.ziyarah = z; STORE.services = sv;
    STORE.packages = p; STORE.customers = c; STORE.vendors = vend;
    STORE.payments = pay; STORE.followups = fu;

    if (typeof loadChatState === 'function') loadChatState();
    await Promise.all([
      typeof loadTheme === 'function' ? loadTheme() : Promise.resolve(),
      typeof refreshUserProfiles === 'function' ? refreshUserProfiles() : Promise.resolve(),
      typeof loadSettingsForm === 'function' ? loadSettingsForm() : Promise.resolve()
    ]);
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();

    if (role === 'admin') (async () => {
      let transportFixed = 0;
      for (const t of STORE.transports) {
        const correctCap = VEHICLE_CAPACITY[t.vehicle];
        if (correctCap && t.capacity !== correctCap) {
          t.capacity = correctCap; t.updatedAt = Date.now();
          await dbSave(STORES.transports, t); transportFixed++;
        }
      }
      if (transportFixed > 0) STORE.transports = await dbGetAll(STORES.transports);

      let fixed = 0;
      for (const pkg of STORE.packages) {
        const sourceItinerary = Array.isArray(pkg.itinerary) ? pkg.itinerary : [];
        const seen = new Set();
        const cleanItin = [];
        sourceItinerary.forEach((it) => {
          const key = `${it.day}-${it.title || ''}-${it.description || ''}`;
          if (seen.has(key)) return;
          seen.add(key);
          const newIdx = cleanItin.length + 1;
          cleanItin.push({ ...it, id: newIdx, day: newIdx });
        });
        const maxDays = pkg.days || cleanItin.length;
        const capped = cleanItin.slice(0, maxDays);
        const cleanInclusions = typeof dedupeTextItems === 'function' ? dedupeTextItems(pkg.inclusions || []) : (pkg.inclusions || []);
        const cleanExclusions = typeof dedupeTextItems === 'function' ? dedupeTextItems(pkg.exclusions || []) : (pkg.exclusions || []);
        const changed = capped.length !== sourceItinerary.length || cleanInclusions.length !== (pkg.inclusions || []).length || cleanExclusions.length !== (pkg.exclusions || []).length;
        if (changed) {
          pkg.itinerary = capped; pkg.inclusions = cleanInclusions; pkg.exclusions = cleanExclusions;
          pkg.updatedAt = Date.now(); await dbSave(STORES.packages, pkg); fixed++;
        }
      }
      if (fixed > 0) STORE.packages = await dbGetAll(STORES.packages);
    })();

    if (window.firebaseAuth?.currentUser && typeof loadUserRole === 'function') await loadUserRole();
    
    let savedPage = null;
    try { savedPage = localStorage.getItem('umrah_active_page'); } catch (e) {}
    const permissions = window.currentUserPermissions;
    const fallbackPage = permissions?.pages?.includes('dashboard') ? 'dashboard' : (permissions?.pages?.[0] || 'dashboard');
    const initialPage = savedPage && typeof canAccessPage === 'function' && canAccessPage(savedPage) ? savedPage : fallbackPage;
    const navItem = document.querySelector(`.ni[data-page="${initialPage}"]`);
    
    // ⭐ Safe Navigation (এরর দূর করার জন্য)
    try {
      if (typeof nav === 'function') await nav(initialPage, navItem);
    } catch (navErr) {
      console.warn('Navigation safe-guard caught error:', navErr);
      if (initialPage === 'packages' && typeof renderPackages === 'function') renderPackages();
    }
    
    document.body.classList.add('app-ready');
    if (typeof toast === 'function') toast('✅ Umrah Builder ready');
  } catch (e) {
    console.error('Init failed:', e);
    document.body.classList.add('app-ready');
    if (typeof toast === 'function') toast('Init failed: ' + e.message, 'error');
  }
}

window.addEventListener('load', () => {
  init();
});

async function runMigration() {
  try {
    const user = window.firebaseAuth?.currentUser;
    if (!user) { alert('❌ আপনি লগইন করেননি!'); return; }

    const myUid = user.uid;
    const profile = await dbGetUserProfile() || {};
    const myName = profile.name || user.displayName || user.email || 'User';
    const confirmMsg = `⚠️ Migration চালাবেন?\n\n👤 User: ${myName}\n📧 Email: ${user.email}\n🔑 UID: ${myUid}\n\nএই ইউজারের নামে সব পুরনো প্যাকেজ ও কাস্টমার যুক্ত হবে।\n\nContinue?`;
    if (!confirm(confirmMsg)) return;

    if (typeof showLoading === 'function') showLoading('Migrating data...');

    let pkgCount = 0;
    for (const pkg of STORE.packages) {
      if (!pkg.userId) { pkg.userId = myUid; await dbSave(STORES.packages, pkg); pkgCount++; }
    }
    STORE.packages = await dbGetAll(STORES.packages);

    let custCount = 0;
    for (const cust of STORE.customers) {
      if (!cust.userId) { cust.userId = myUid; await dbSave(STORES.customers, cust); custCount++; }
    }
    STORE.customers = await dbGetAll(STORES.customers);

    if (typeof hideLoading === 'function') hideLoading();
    alert(`✅ Migration সফল!\n\n👤 ${myName} এর নামে:\n📦 ${pkgCount} টি প্যাকেজ\n👥 ${custCount} জন কাস্টমার`);

    if (typeof renderDashboard === 'function') await renderDashboard();
    if (typeof renderPackages === 'function') renderPackages();
    if (typeof renderCustomersTable === 'function') renderCustomersTable();
  } catch (err) {
    console.error('Migration failed:', err);
    if (typeof hideLoading === 'function') hideLoading();
    alert('❌ Migration failed: ' + err.message);
  }
}