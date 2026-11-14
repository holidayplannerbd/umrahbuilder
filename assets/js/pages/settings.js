/* ============================================================
   UMRAH BUILDER — PAGES / SETTINGS
   Firestore userProfiles ব্যবহার করে নাম ও ছবি
   ============================================================ */

/* ==================== GENERATE QUOTATION REF ==================== */
async function generateQuotationRef(type = 'UMR') {
  const s = await dbGetSetting('settings') || {};
  const companyPrefix = s.refCompanyPrefix || 'ALH';
  const typePrefix = s.refTypePrefix || type;
  const serialPad = parseInt(s.refSerialPad) || 4;
  const format = s.refFormat || '{COMPANY}-{TYPE}-{YEAR}-{SERIAL}';
  const year = new Date().getFullYear();

  const existing = STORE.packages.filter(p => p.refNo && p.refNo.includes(String(year)));
  let maxSerial = 0;
  existing.forEach(p => {
    const match = String(p.refNo).match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxSerial) maxSerial = num;
    }
  });

  const serial = String(maxSerial + 1).padStart(serialPad, '0');
  const now = new Date();

  const replacements = {
    '{COMPANY}': companyPrefix,
    '{TYPE}': typePrefix,
    '{YEAR}': String(now.getFullYear()),
    '{YEAR2}': String(now.getFullYear()).slice(-2),
    '{MONTH}': String(now.getMonth() + 1).padStart(2, '0'),
    '{DAY}': String(now.getDate()).padStart(2, '0'),
    '{SERIAL}': serial
  };

  let ref = format;
  Object.entries(replacements).forEach(([k, v]) => { ref = ref.replaceAll(k, v); });
  return ref;
}

async function regenerateRefNo() {
  const ref = await generateQuotationRef();
  setVal('pkgRefNo', ref);
  toast('🔄 Ref regenerated: ' + ref, 'info');
}

async function previewRefFormat() {
  const format = $('setRefFormat')?.value || '{COMPANY}-{TYPE}-{YEAR}-{SERIAL}';
  const company = $('setRefCompanyPrefix')?.value || 'ALH';
  const type = $('setRefTypePrefix')?.value || 'UMR';
  const pad = parseInt($('setRefSerialPad')?.value) || 4;
  const now = new Date();
  const serial = String(1).padStart(pad, '0');

  let ref = format
    .replaceAll('{COMPANY}', company)
    .replaceAll('{TYPE}', type)
    .replaceAll('{YEAR}', String(now.getFullYear()))
    .replaceAll('{YEAR2}', String(now.getFullYear()).slice(-2))
    .replaceAll('{MONTH}', String(now.getMonth() + 1).padStart(2, '0'))
    .replaceAll('{DAY}', String(now.getDate()).padStart(2, '0'))
    .replaceAll('{SERIAL}', serial);

  if ($('refPreview')) $('refPreview').textContent = ref;
}

/* ==================== LOAD SETTINGS FORM ==================== */
async function loadSettingsForm() {
  try {
    const user = window.firebaseAuth?.currentUser;
    const globalS = await dbGetSetting('settings') || {};
    const profile = await dbGetUserProfile() || {};

    // ---- 👤 User Profile ----
    if ($('setUserName')) $('setUserName').value = profile.name || user?.displayName || '';
    if ($('setUserEmail')) $('setUserEmail').value = user?.email || '';
    if ($('setUserPhone')) $('setUserPhone').value = profile.phone || user?.phoneNumber || '';
    if ($('setUserRole')) $('setUserRole').value = profile.role || globalS.userRole || 'Travel Agent';

    // ---- 🏢 Company Info (গ্লোবাল) ----
    if ($('setCompany')) $('setCompany').value = globalS.company || 'Al-Haram Travels';
    if ($('setPhone')) $('setPhone').value = globalS.phone || '';
    if ($('setAddress')) $('setAddress').value = globalS.address || '';
    if ($('setEmail')) $('setEmail').value = globalS.email || '';
    if ($('setLicense')) $('setLicense').value = globalS.license || '';
    if ($('setSarRate')) $('setSarRate').value = globalS.sarRate || '32.80';
    if ($('setUsdRate')) $('setUsdRate').value = globalS.usdRate || '120';
    if ($('setExBuffer')) $('setExBuffer').value = globalS.exBuffer || '2';
    if ($('setRefCompanyPrefix')) $('setRefCompanyPrefix').value = globalS.refCompanyPrefix || 'ALH';
    if ($('setRefTypePrefix')) $('setRefTypePrefix').value = globalS.refTypePrefix || 'UMR';
    if ($('setRefSerialPad')) $('setRefSerialPad').value = globalS.refSerialPad || '4';
    if ($('setRefFormat')) $('setRefFormat').value = globalS.refFormat || '{COMPANY}-{TYPE}-{YEAR}-{SERIAL}';
    if ($('setVatPercent')) $('setVatPercent').value = globalS.vatPercent !== undefined ? globalS.vatPercent : '15';
    if ($('setServiceFee')) $('setServiceFee').value = globalS.serviceFee || '0';
    if ($('setDefaultPolicy')) $('setDefaultPolicy').value = globalS.defaultPolicy || '';
    if ($('setDefaultNotes')) $('setDefaultNotes').value = globalS.defaultNotes || '';

    previewRefFormat();

    // ---- 👤 Profile Picture (Firestore থেকে) ----
    const prev = $('profilePicPreview');
    const profilePhoto = profile.photo || user?.photoURL || '';
    if (profilePhoto) {
      if (prev) prev.innerHTML = `<img src="${profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      const firstLetter = (profile.name?.[0] || user?.displayName?.[0] || user?.email?.[0] || 'A').toUpperCase();
      if (prev) prev.innerHTML = `<span id="profilePicFallback">${firstLetter}</span>`;
    }

    // ---- Header/Footer Images ----
    if (globalS.headerImgData) {
      const hp = $('headerImgPreview');
      if (hp) hp.innerHTML = `<img src="${globalS.headerImgData}" alt="">`;
    }
    if (globalS.footerImgData) {
      const fp = $('footerImgPreview');
      if (fp) fp.innerHTML = `<img src="${globalS.footerImgData}" alt="">`;
    }

    // ---- Linked providers ----
    if (typeof renderAccountInfo === 'function') {
      setTimeout(renderAccountInfo, 100);
    }
  } catch (e) {
    console.warn('loadSettingsForm error:', e);
  }
}

/* ==================== SAVE SETTINGS ==================== */
async function saveSettings() {
  try {
    const user = window.firebaseAuth?.currentUser;
    if (!user) {
      toast('❌ লগইন করুন', 'error');
      return;
    }

    const newName = $('setUserName')?.value?.trim() || '';
    const newPhone = $('setUserPhone')?.value?.trim() || '';
    const newRole = $('setUserRole')?.value?.trim() || '';
    const vatValue = parseFloat($('setVatPercent')?.value);

    // ⭐ ১. Firestore userProfiles-এ নাম সেভ (সবার দেখার জন্য)
    await dbSaveUserProfile({
      name: newName,
      phone: newPhone,
      role: newRole
    });

    // ⭐ ২. Firebase Auth-এও নাম সেভ (quick access, তবে ছবি না)
    if (newName && newName !== user.displayName) {
      try {
        if (window.firebaseAuthFns?.updateProfile) {
          await window.firebaseAuthFns.updateProfile(user, { displayName: newName });
        }
      } catch (e) { console.warn('Auth displayName update failed:', e); }
    }

    // ⭐ ৩. গ্লোবাল সেটিংস
    const globalData = {
      company: $('setCompany')?.value || '',
      phone: $('setPhone')?.value || '',
      address: $('setAddress')?.value || '',
      email: $('setEmail')?.value || '',
      license: $('setLicense')?.value || '',
      sarRate: parseFloat($('setSarRate')?.value) || 32.80,
      usdRate: parseFloat($('setUsdRate')?.value) || 120,
      exBuffer: parseFloat($('setExBuffer')?.value) || 2,
      refCompanyPrefix: $('setRefCompanyPrefix')?.value || 'ALH',
      refTypePrefix: $('setRefTypePrefix')?.value || 'UMR',
      refSerialPad: parseInt($('setRefSerialPad')?.value) || 4,
      refFormat: $('setRefFormat')?.value || '{COMPANY}-{TYPE}-{YEAR}-{SERIAL}',
      vatPercent: Number.isFinite(vatValue) ? vatValue : 15,
      serviceFee: parseFloat($('setServiceFee')?.value) || 0,
      defaultPolicy: $('setDefaultPolicy')?.value || '',
      defaultNotes: $('setDefaultNotes')?.value || '',
      savedAt: Date.now()
    };

    const existingGlobal = await dbGetSetting('settings') || {};
    await dbSaveSetting('settings', { ...existingGlobal, ...globalData });

    // ⭐ ৪. সব profile cache রিফ্রেশ
    if (typeof refreshUserProfiles === 'function') {
      await refreshUserProfiles();
    }

    // ⭐ ৫. UI রিফ্রেশ
    await loadSettingsForm();
    if (typeof renderDashboard === 'function') await renderDashboard();
    if (typeof renderPackages === 'function') renderPackages();
    if (typeof renderPerformance === 'function') renderPerformance();

    toast('✅ Settings saved for ' + (newName || user.email));
  } catch (e) {
    console.error('Save settings failed:', e);
    toast('Save failed: ' + e.message, 'error');
  }
}

/* ==================== UPLOAD USER PIC (শুধু Firestore-এ) ==================== */
async function uploadUserPic(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('❌ Max 2MB', 'error'); event.target.value = ''; return; }
  if (!file.type.startsWith('image/')) { toast('❌ শুধু ছবি', 'error'); event.target.value = ''; return; }

  toast('⏳ ছবি আপলোড হচ্ছে...', 'info');

  const user = window.firebaseAuth?.currentUser;
  if (!user) { toast('❌ লগইন করুন', 'error'); return; }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      // ⭐ শুধু Firestore-এ সেভ (Firebase Auth-এ সেভ করব না, কারণ সেখানে base64 সাইজ লিমিট)
      await dbSaveUserProfile({
        photo: ev.target.result
      });

      console.log('✅ Photo saved, size:', ev.target.result.length, 'chars');

      // Settings প্রিভিউ
      const prev = $('profilePicPreview');
      if (prev) {
        prev.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }

      // profile cache রিফ্রেশ
      if (typeof refreshUserProfiles === 'function') {
        await refreshUserProfiles();
      }

      // UI রিফ্রেশ
      if (typeof renderDashboard === 'function') await renderDashboard();
      if (typeof renderPerformance === 'function') renderPerformance();

      toast('✅ ছবি আপলোড হয়েছে! সবাই দেখতে পাবে');
    } catch (err) {
      console.error('❌ Upload failed:', err);
      toast('❌ আপলোড ব্যর্থ: ' + err.message, 'error');
    }
  };
  reader.onerror = () => toast('❌ ছবি পড়তে ব্যর্থ', 'error');
  reader.readAsDataURL(file);
  event.target.value = '';
}

/* ==================== REMOVE USER PIC ==================== */
async function removeUserPic() {
  confirmDelete('Remove profile photo?', async () => {
    try {
      const user = window.firebaseAuth?.currentUser;
      if (!user) return;

      await dbSaveUserProfile({ photo: '' });

      const firstLetter = (user.displayName?.[0] || user.email?.[0] || 'A').toUpperCase();
      const prev = $('profilePicPreview');
      if (prev) prev.innerHTML = `<span id="profilePicFallback">${firstLetter}</span>`;

      if (typeof refreshUserProfiles === 'function') await refreshUserProfiles();
      if (typeof renderDashboard === 'function') await renderDashboard();
      if (typeof renderPerformance === 'function') renderPerformance();

      toast('✅ Photo removed');
    } catch (err) {
      toast('❌ Remove failed: ' + err.message, 'error');
    }
  });
}

/* ==================== HEADER/FOOTER IMAGES ==================== */
async function uploadHeaderImg(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Max 2MB', 'error'); return; }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    const e = await dbGetSetting('settings') || {};
    e.headerImgData = ev.target.result;
    await dbSaveSetting('settings', e);
    await loadSettingsForm();
    toast('✅ Header image uploaded');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

async function removeHeaderImg() {
  confirmDelete('Remove header image?', async () => {
    const e = await dbGetSetting('settings') || {};
    e.headerImgData = '';
    await dbSaveSetting('settings', e);
    const hp = $('headerImgPreview');
    if (hp) hp.innerHTML = '<span>No header image</span>';
    toast('✅ Header removed');
  });
}

async function uploadFooterImg(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Max 2MB', 'error'); return; }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    const e = await dbGetSetting('settings') || {};
    e.footerImgData = ev.target.result;
    await dbSaveSetting('settings', e);
    await loadSettingsForm();
    toast('✅ Footer image uploaded');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

async function removeFooterImg() {
  confirmDelete('Remove footer image?', async () => {
    const e = await dbGetSetting('settings') || {};
    e.footerImgData = '';
    await dbSaveSetting('settings', e);
    const fp = $('footerImgPreview');
    if (fp) fp.innerHTML = '<span>No footer image</span>';
    toast('✅ Footer removed');
  });
}

/* ==================== QUICK ADD ==================== */
function quickAddHotel(ct, id) {
  openBuilder();
  setTimeout(() => {
    if (ct === 'makkah') {
      addMakkahHotel();
      const l = makkahItems[makkahItems.length - 1];
      if (l) onMakkahHotelChange(l.id, id);
    } else {
      addMadinahHotel();
      const l = madinahItems[madinahItems.length - 1];
      if (l) onMadinahHotelChange(l.id, id);
    }
  }, 150);
}

function quickAddFlight(id) {
  openBuilder();
  setTimeout(() => {
    addFlightItem();
    const l = flightItems[flightItems.length - 1];
    if (l) onFlightItemChange(l.id, id);
  }, 150);
}

function quickAddTransport(id) {
  openBuilder();
  setTimeout(() => {
    addTransportItem();
    const l = transportItems[transportItems.length - 1];
    if (l) onTransportItemChange(l.id, id);
  }, 150);
}

function quickAddVisa(id) {
  openBuilder();
  setTimeout(() => {
    addVisaItem();
    const l = visaItems[visaItems.length - 1];
    if (l) onVisaItemChange(l.id, id);
  }, 150);
}

function quickAddService(id) {
  openBuilder();
  setTimeout(() => {
    addServiceItem();
    const l = serviceItems[serviceItems.length - 1];
    if (l) onServiceItemChange(l.id, id);
  }, 150);
}

/* ==================== LIVE PREVIEW ==================== */
document.addEventListener('input', e => {
  if (['setRefFormat', 'setRefCompanyPrefix', 'setRefTypePrefix', 'setRefSerialPad'].includes(e.target.id)) {
    previewRefFormat();
  }
});

/* ============================================================
   STAFF MANAGEMENT (Admin Only)
   ============================================================ */

/* ==================== RENDER STAFF LIST ==================== */
async function renderStaffList() {
  const container = document.getElementById('staffList');
  if (!container) return;

  if (!isAdmin()) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);font-size:12px">🔒 Admin only</div>';
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);font-size:12px">Loading...</div>';

  try {
    const staff = await getStaffList();

    if (!staff.length) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3);font-size:12px">No staff yet — Click "➕ Add Staff" to create</div>';
      return;
    }

    container.innerHTML = staff.map(s => {
      const roleLabel = s.role === 'admin' ? '👑 Admin' : '💼 Accountant';
      const roleColor = s.role === 'admin' ? 'var(--primary)' : 'var(--blue)';
      const roleBg = s.role === 'admin' ? 'var(--primary-bg)' : 'var(--blue-bg)';
      const isMe = window.firebaseAuth?.currentUser?.uid === s.uid;

      return `
        <div style="padding:12px 14px;background:var(--bg-2);border-radius:10px;display:flex;align-items:center;gap:12px;border:1px solid var(--border)">
          <div style="width:42px;height:42px;border-radius:50%;background:${roleBg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
            ${s.photo ? `<img src="${s.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : (s.role === 'admin' ? '👑' : '💼')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:6px">
              ${esc(s.name)} ${isMe ? '<span style="font-size:10px;color:var(--primary);font-weight:800">(You)</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">${esc(s.email)}</div>
          </div>
          <span style="font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:20px;background:${roleBg};color:${roleColor};text-transform:uppercase;letter-spacing:.4px">${roleLabel}</span>
          ${!isMe ? `<button class="btn btn-sm btn-ghost btn-icon" onclick="deleteStaff('${s.uid}','${esc(s.email)}')" title="Delete">🗑️</button>` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--red);font-size:12px">Error: ${esc(e.message)}</div>`;
  }
}

/* ==================== OPEN ADD STAFF MODAL ==================== */
function openAddStaffModal() {
  if (!isAdmin()) {
    toast('❌ Admin only', 'error');
    return;
  }

  const html = `
    <div class="modal-bg act" id="addStaffModal">
      <div class="modal narrow">
        <div class="modal-head">
          <h2>➕ Add Staff Account</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">

          <!-- ⭐ Role Selection -->
          <div class="field" style="margin-bottom:16px">
            <label>Select Role *</label>
            <div class="role-selector" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px">
              <div class="role-option" data-role="admin" onclick="selectStaffRole('admin', this)" style="padding:14px 10px;border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:center;transition:all .15s">
                <div style="font-size:26px;margin-bottom:6px">👑</div>
                <div style="font-size:12.5px;font-weight:800">Admin</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:3px">Full Access</div>
              </div>
              <div class="role-option act" data-role="accountant" onclick="selectStaffRole('accountant', this)" style="padding:14px 10px;border:2px solid var(--primary);border-radius:10px;cursor:pointer;text-align:center;transition:all .15s;background:var(--primary-bg)">
                <div style="font-size:26px;margin-bottom:6px">💼</div>
                <div style="font-size:12.5px;font-weight:800">Accountant</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:3px">Accounts Only</div>
              </div>
              <div class="role-option" data-role="staff" onclick="selectStaffRole('staff', this)" style="padding:14px 10px;border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:center;transition:all .15s">
                <div style="font-size:26px;margin-bottom:6px">👤</div>
                <div style="font-size:12.5px;font-weight:800">Staff</div>
                <div style="font-size:10px;color:var(--text-3);margin-top:3px">Limited Access</div>
              </div>
            </div>
            <input type="hidden" id="staffRole" value="accountant">
          </div>

          <!-- ⭐ Dynamic Permission Info -->
          <div id="staffRoleInfo" style="padding:14px;background:linear-gradient(135deg,var(--blue-bg),var(--card));border-radius:10px;border-left:3px solid var(--blue);margin-bottom:20px;font-size:12.5px;line-height:1.7"></div>

          <div class="grid-2">
            <div class="field" style="grid-column:1/-1">
              <label>Full Name *</label>
              <input type="text" id="staffName" placeholder="e.g., Rahim Ahmed">
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Email *</label>
              <input type="email" id="staffEmail" placeholder="staff@umrah.com">
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Password * (min 6 characters)</label>
              <input type="text" id="staffPassword" placeholder="Temp password for staff">
              <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">Staff এই password দিয়ে login করবে, পরে পরিবর্তন করতে পারবে</div>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Phone (optional)</label>
              <input type="text" id="staffPhone" placeholder="01XXXXXXXXX">
            </div>
          </div>

        </div>
        <div class="modal-foot">
          <div></div>
          <div class="right-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="createStaffAccount()">👥 Create Staff</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
  updateStaffRoleInfo('accountant');
}

/* ==================== SELECT STAFF ROLE ==================== */
function selectStaffRole(role, el) {
  /* Reset all options */
  document.querySelectorAll('#addStaffModal .role-option').forEach(opt => {
    opt.style.borderColor = 'var(--border)';
    opt.style.background = '';
  });

  /* Highlight selected */
  el.style.borderColor = 'var(--primary)';
  el.style.background = 'var(--primary-bg)';

  /* Save value */
  document.getElementById('staffRole').value = role;

  /* Update info box */
  updateStaffRoleInfo(role);
}

/* ==================== UPDATE ROLE INFO ==================== */
function updateStaffRoleInfo(role) {
  const info = document.getElementById('staffRoleInfo');
  if (!info) return;

  const configs = {
    admin: {
      color: '#f97316',
      bg: 'linear-gradient(135deg, #fff7ed, var(--card))',
      border: '#f97316',
      title: '👑 Admin Permissions:',
      items: [
        '✅ সব Pages access (Dashboard, Packages, Customers, etc.)',
        '✅ Packages Create/Edit/Delete',
        '✅ Customers, Vendors, Hotels সব কিছু',
        '✅ Accounts, Documents, Reports',
        '✅ Staff Management (নতুন Staff create)',
        '✅ Settings edit'
      ]
    },
    accountant: {
      color: '#3b82f6',
      bg: 'linear-gradient(135deg, #eff6ff, var(--card))',
      border: '#3b82f6',
      title: '💼 Accountant Permissions:',
      items: [
        '✅ Accounts & Ledger (Full access)',
        '✅ Documents (Upload + own delete)',
        '✅ Reports (Financial only)',
        '❌ Dashboard, Packages, Customers — No access',
        '❌ Settings, Staff Management — No access'
      ]
    },
    staff: {
      color: '#a855f7',
      bg: 'linear-gradient(135deg, #faf5ff, var(--card))',
      border: '#a855f7',
      title: '👤 Staff Permissions:',
      items: [
        '✅ Reports (View only)',
        '✅ Documents (View + Upload)',
        '❌ Accounts & Ledger — No access',
        '❌ Dashboard, Packages, Customers — No access',
        '❌ Settings, Staff Management — No access'
      ]
    }
  };

  const cfg = configs[role] || configs.accountant;

  info.style.background = cfg.bg;
  info.style.borderLeft = `3px solid ${cfg.border}`;

  info.innerHTML = `
    <b style="color:${cfg.color}">${cfg.title}</b><br>
    ${cfg.items.map(item => `• ${item}`).join('<br>')}
  `;
}

/* ==================== CREATE STAFF ACCOUNT ==================== */
async function createStaffAccount() {
  if (!isAdmin()) {
    toast('❌ Admin only', 'error');
    return;
  }

  const name = (document.getElementById('staffName')?.value || '').trim();
  const email = (document.getElementById('staffEmail')?.value || '').trim();
  const password = document.getElementById('staffPassword')?.value || '';
  const phone = (document.getElementById('staffPhone')?.value || '').trim();
  const role = document.getElementById('staffRole')?.value || 'accountant';
  if (!name) { toast('Name দিন', 'error'); return; }
  if (!email) { toast('Email দিন', 'error'); return; }
  if (!password || password.length < 6) { toast('Password কমপক্ষে ৬ characters', 'error'); return; }

  if (!confirm(`Create staff account?\n\nName: ${name}\nEmail: ${email}\nRole: Accountant\n\nContinue?`)) return;

  showLoading('Creating staff account...');

  try {
    /* Save current admin auth to restore later */
    const adminUser = window.firebaseAuth?.currentUser;
    if (!adminUser) throw new Error('Admin not logged in');

    /* ⭐ Firebase secondary app to create user without logging out current admin */
    const { initializeApp, deleteApp } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
    const { getAuth, createUserWithEmailAndPassword, signOut: signOutSecondary, updateProfile: updateProfileSecondary } =
      await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');

    const firebaseConfig = {
      apiKey: "AIzaSyAQU6J2Wjb9lHiZEvyKB2q1D5aHKAz9jAo",
      authDomain: "umrah-package-builder.firebaseapp.com",
      projectId: "umrah-package-builder",
      storageBucket: "umrah-package-builder.firebasestorage.app",
      messagingSenderId: "867591484402",
      appId: "1:867591484402:web:295974892b167e4743716b"
    };

    /* ⭐ Create secondary app instance */
    const secondaryApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);

    /* ⭐ Create user in secondary auth */
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCred.user;

    /* Update display name */
    try {
      await updateProfileSecondary(newUser, { displayName: name });
    } catch (e) { console.warn('updateProfile failed:', e); }

    /* Sign out from secondary auth */
    await signOutSecondary(secondaryAuth);

    /* ⭐ Save user profile to Firestore (from admin session) */
    const { doc, setDoc } = window.firebaseFns;
    await setDoc(doc(window.firebaseDB, 'userProfiles', newUser.uid), {
      uid: newUser.uid,
      email: email,
      name: name,
      phone: phone,
      role: role,                       // ⬅️ dynamic
      createdAt: Date.now(),
      createdBy: adminUser.uid
    });

    /* Cleanup secondary app */
    try { await deleteApp(secondaryApp); } catch (e) { console.warn('deleteApp failed:', e); }

    hideLoading();
    document.getElementById('addStaffModal')?.remove();
    if (typeof addNotification === 'function') {
      addNotification({
        type: 'staff_created',
        icon: '👥',
        message: `👥 New staff: <b>${esc(name)}</b> (${role})`,
        link: 'settings'
      });
    }
    toast(`✅ Staff account created!\nEmail: ${email}`, 'success');
    const roleLabels = { admin: 'Admin', accountant: 'Accountant', staff: 'Staff' };
    alert(`✅ Staff Account Created!\n\n` +
      `📧 Email: ${email}\n` +
      `🔑 Password: ${password}\n` +
      `👤 Name: ${name}\n` +
      `🎭 Role: ${roleLabels[role] || role}\n\n` +
      `Staff এখন login করতে পারবে।\n\n` +
      `⚠️ Staff কে এই credentials জানাতে ভুলবেন না।`);

    renderStaffList();
  } catch (e) {
    hideLoading();
    console.error('Create staff failed:', e);
    let msg = e.message;
    if (e.code === 'auth/email-already-in-use') msg = 'এই email already registered';
    else if (e.code === 'auth/invalid-email') msg = 'Invalid email';
    else if (e.code === 'auth/weak-password') msg = 'Password too weak';
    toast('❌ ' + msg, 'error');
  }
}

/* ==================== DELETE STAFF ==================== */
async function deleteStaff(uid, email) {
  if (!isAdmin()) {
    toast('❌ Admin only', 'error');
    return;
  }

  if (!confirm(`⚠️ Delete staff account?\n\nEmail: ${email}\n\nStaff আর login করতে পারবে না।\n\nContinue?`)) return;

  showLoading('Deleting staff...');

  try {
    /* Delete Firestore userProfile */
    const { doc, deleteDoc } = window.firebaseFns;
    await deleteDoc(doc(window.firebaseDB, 'userProfiles', uid));

    hideLoading();
    toast('✅ Staff deleted');
    renderStaffList();
  } catch (e) {
    hideLoading();
    toast('Delete failed: ' + e.message, 'error');
  }
}