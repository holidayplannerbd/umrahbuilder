/* ============================================================
   UMRAH BUILDER — CORE / ROLES & PERMISSIONS
   ============================================================ */

/* Role Definitions */
const ROLES = {
  admin: 'admin',
  accountant: 'accountant',
  staff: 'staff'
};

/* Role Permissions Matrix */
const ROLE_PERMISSIONS = {
  admin: {
    pages: ['dashboard', 'analytics', 'packages', 'followups', 'makkah', 'madinah',
            'flights', 'transports', 'visas', 'ziyarah', 'services', 'customers',
            'vendors', 'reports', 'accounts', 'performance', 'tasks', 'documents', 'settings'],
    canAddPayment: true,
    canAddRefund: true,
    canPayVendor: true,
    canUploadDoc: true,
    canDeleteAnyDoc: true,
    canManageStaff: true,
    canEditSettings: true,
    canCreatePackage: true,
    canEditPackage: true,
    canDeletePackage: true
  },
  accountant: {
    pages: ['accounts', 'analytics', 'reports', 'tasks', 'documents', 'settings'],
    canAddPayment: true,
    canAddRefund: true,
    canPayVendor: true,
    canUploadDoc: true,
    canDeleteAnyDoc: false,
    canManageStaff: false,
    canEditSettings: false,
    canCreatePackage: false,
    canEditPackage: false,
    canDeletePackage: false
  },
  staff: {
    pages: ['documents', 'reports', 'settings'],
    canAddPayment: false,
    canAddRefund: false,
    canPayVendor: false,
    canUploadDoc: true,
    canDeleteAnyDoc: false,
    canManageStaff: false,
    canEditSettings: false,
    canCreatePackage: false,
    canEditPackage: false,
    canDeletePackage: false
  }
};

/* Current User Role (global) */
window.currentUserRole = 'admin';
window.currentUserPermissions = ROLE_PERMISSIONS.admin;

/* ==================== LOAD USER ROLE ==================== */
async function loadUserRole() {
  try {
    const user = window.firebaseAuth?.currentUser;
    if (!user) {
      window.currentUserRole = 'admin';
      window.currentUserPermissions = ROLE_PERMISSIONS.admin;
      return 'admin';
    }

    /* Wait for DB ready */
    if (!window.firebaseDB) {
      await new Promise(r => setTimeout(r, 500));
    }

    const profile = await dbGetUserProfile() || {};
    const roleStr = (profile.role || '').toLowerCase();

    let role = 'staff';
    if (roleStr === 'admin') role = 'admin';
    else if (roleStr === 'accountant') role = 'accountant';
    else if (roleStr === 'staff') role = 'staff';

    window.currentUserRole = role;
    window.currentUserPermissions = ROLE_PERMISSIONS[role];

    return role;
  } catch (e) {
    console.warn('loadUserRole failed:', e);
    window.currentUserRole = 'admin';
    window.currentUserPermissions = ROLE_PERMISSIONS.admin;
    return 'admin';
  }
}

/* ==================== CHECK PERMISSION ==================== */
function canAccessPage(page) {
  const perms = window.currentUserPermissions || ROLE_PERMISSIONS.admin;
  return perms.pages.includes(page);
}

function canDo(action) {
  const perms = window.currentUserPermissions || ROLE_PERMISSIONS.admin;
  return perms[action] === true;
}

function isAdmin() {
  return window.currentUserRole === 'admin';
}

function isAccountant() {
  return window.currentUserRole === 'accountant';
}

function isStaff() {
  return window.currentUserRole === 'staff';
}

/* ==================== APPLY SIDEBAR VISIBILITY ==================== */
function applyRoleToSidebar() {
  const perms = window.currentUserPermissions || ROLE_PERMISSIONS.admin;
  const allowedPages = perms.pages;

  const settingsCard = document.querySelector('#page-settings .content-card');
  if (settingsCard) {
    settingsCard.querySelectorAll('.section').forEach(section => {
      section.style.display = isAdmin() || section.id === 'accountSecuritySection' ? '' : 'none';
    });
    Array.from(settingsCard.children).forEach(child => {
      if (child.tagName === 'BUTTON') {
        child.style.display = isAdmin() ? '' : 'none';
      }
    });
  }

  /* 1. Hide/Show sidebar items by data-page */
  document.querySelectorAll('.ni[data-page]').forEach(item => {
    const page = item.dataset.page;
    if (allowedPages.includes(page)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });

  /* 2. Hide section headers if no items visible */
  document.querySelectorAll('.sb-section').forEach(section => {
    let nextEl = section.nextElementSibling;
    let hasVisible = false;
    while (nextEl && !nextEl.classList.contains('sb-section')) {
      if (nextEl.classList.contains('ni') && nextEl.style.display !== 'none' && nextEl.dataset.page) {
        hasVisible = true;
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
    section.style.display = hasVisible ? '' : 'none';
  });

  /* 3. Hide "New Package" buttons if not admin */
  if (!isAdmin()) {
    document.querySelectorAll('button').forEach(btn => {
      const txt = (btn.textContent || '').trim();
      if (txt.includes('New Package') ||
          txt.includes('Create Package') ||
          txt.includes('✨ Create')) {
        btn.style.display = 'none';
      }
    });
  }

  /* 4. Hide package-related UI for non-admin */
  if (!isAdmin()) {
    document.querySelectorAll('.table-head-actions button, .topbar-right button').forEach(btn => {
      const txt = (btn.textContent || '').trim();
      if (txt.includes('Create') || txt.includes('New Package')) {
        btn.style.display = 'none';
      }
    });

    if (!isAdmin()) {
      const createTaskButton = document.getElementById('tkCreateTaskButton');
      if (createTaskButton) createTaskButton.style.display = 'none';
    }

    /* Hide Quick Start card */
    document.querySelectorAll('.quick-card').forEach(el => {
      el.style.display = 'none';
    });

    /* Hide Templates section */
    document.querySelectorAll('.template-grid').forEach(el => {
      const parent = el.closest('.content-card');
      if (parent) parent.style.display = 'none';
    });

    /* Disable Packages KPI card */
    document.querySelectorAll('.stat-card').forEach(card => {
      const label = card.querySelector('.stat-label');
      if (label && label.textContent.includes('Packages')) {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.5';
      }
    });
  }

  /* 5. Switch Chatbot based on role */
  const adminBot = document.getElementById('chatbotFab');
  const accBot = document.getElementById('accountsChatbotFab');

  if (adminBot && accBot) {
    if (isAdmin()) {
      adminBot.style.display = 'flex';
      accBot.style.display = 'none';
      document.getElementById('accountsChatbotPanel')?.classList.remove('act');
    } else {
      adminBot.style.display = 'none';
      accBot.style.display = 'flex';
      document.getElementById('chatbotPanel')?.classList.remove('act');
    }
  }
}

/* ==================== GET STAFF LIST ==================== */
async function getStaffList() {
  try {
    const { collection, getDocs } = window.firebaseFns;
    const db = window.firebaseDB;
    const snapshot = await getDocs(collection(db, 'userProfiles'));

    const staff = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      staff.push({
        uid: data.uid,
        email: data.email || '',
        name: data.name || 'Unknown',
        role: data.role || 'admin',
        createdAt: data.createdAt || 0,
        photo: data.photo || ''
      });
    });

    return staff;
  } catch (e) {
    console.warn('getStaffList failed:', e);
    return [];
  }
}