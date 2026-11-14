/* ============================================================
   UMRAH BUILDER — NOTIFICATION SYSTEM (v4 — Advanced)
   Real-time LIVE + Follow-up Reminder + Date-based Alerts
   ============================================================ */

let NOTIF_STATE = {
  notifications: [],
  filter: 'all',
  panelOpen: false,
  lastReminderCheck: 0,
  unsubscribe: null
};

/* ==================== ROLE TARGETS ==================== */
const NOTIF_DEFAULT_TARGETS = {
  'package_create':   ['admin'],
  'package_edit':     ['admin'],
  'package_delete':   ['admin'],
  'customer_add':     ['admin', 'accountant'],
  'customer_edit':    ['admin'],
  'payment_received': ['admin', 'accountant'],
  'vendor_paid':      ['admin', 'accountant'],
  'refund_given':     ['admin', 'accountant'],
  'document_upload':  ['admin', 'accountant'],
  'task_created':     ['admin'],
  'task_completed':   ['admin'],
  'task_assigned':    null,
  'staff_created':    ['admin'],
  'staff_deleted':    ['admin'],
  'expense_added':    ['admin', 'accountant'],
  'lead_created':     ['admin'],
  'lead_assigned':    null,
  'followup':         ['admin'],
  'reminder':         null,
  'system':           ['admin']
};

/* ==================== START REAL-TIME LISTENER ==================== */
function startNotificationsListener() {
  const user = window.firebaseAuth?.currentUser;
  if (!user) {
    console.warn('⚠️ Cannot start listener: no user');
    return;
  }

  if (NOTIF_STATE.unsubscribe) {
    try { NOTIF_STATE.unsubscribe(); } catch (e) {}
  }

  try {
    const { doc, onSnapshot } = window.firebaseFns;
    const notifRef = doc(window.firebaseDB, 'settings', 'notifications');

    console.log('🔔 Starting notification listener...');

    NOTIF_STATE.unsubscribe = onSnapshot(
      notifRef,
      (snap) => {
        if (!snap.exists()) {
          NOTIF_STATE.notifications = [];
          renderNotifications();
          updateNotifBadge();
          return;
        }

        const data = snap.data();
        const allNotifs = data.value || data.notifications || (Array.isArray(data) ? data : []);

        const myRole = (window.currentUserRole || 'admin').toLowerCase();
        const myUid = user.uid;
        const myEmail = user.email;

        const myNotifs = allNotifs.filter(n => {
          if (n.targetUid === myUid) return true;
          if (n.targetEmail === myEmail) return true;
          if (Array.isArray(n.targetRoles)) {
            return n.targetRoles.map(r => r.toLowerCase()).includes(myRole);
          }
          return myRole === 'admin';
        });

        myNotifs.sort((a, b) => {
          if (a.read !== b.read) return a.read ? 1 : -1;
          return b.createdAt - a.createdAt;
        });

        const oldCount = NOTIF_STATE.notifications.length;
        const newCount = myNotifs.filter(n => !n.read).length;
        const oldUnread = NOTIF_STATE.notifications.filter(n => !n.read).length;

        NOTIF_STATE.notifications = myNotifs;
        renderNotifications();
        updateNotifBadge();

        if (oldCount > 0 && newCount > oldUnread) {
          const newest = myNotifs.find(n => !n.read && !NOTIF_STATE.notifications.find(x => x.id === n.id && x.read));
          if (newest && typeof toast === 'function') {
            const cleanMsg = newest.message.replace(/<[^>]*>/g, '').substring(0, 60);
            toast(`🔔 ${cleanMsg}`, 'info');
          }
        }
      },
      (error) => {
        console.warn('❌ Notification listener error:', error);
        startFallbackPolling();
      }
    );

  } catch (e) {
    console.warn('❌ Failed to start listener:', e);
    startFallbackPolling();
  }
}

/* ==================== FALLBACK (if onSnapshot fails) ==================== */
let fallbackInterval = null;
function startFallbackPolling() {
  if (fallbackInterval) return;
  console.log('📡 Fallback polling every 15s');
  fallbackInterval = setInterval(loadNotifications, 15000);
}

/* ==================== LOAD (manual) ==================== */
async function loadNotifications() {
  try {
    const user = window.firebaseAuth?.currentUser;
    if (!user) {
      NOTIF_STATE.notifications = [];
      renderNotifications();
      return;
    }

    const raw = await dbGetSetting('notifications');
    const allNotifs = Array.isArray(raw) ? raw : (raw?.value || []);

    const myRole = (window.currentUserRole || 'admin').toLowerCase();
    const myUid = user.uid;
    const myEmail = user.email;

    NOTIF_STATE.notifications = allNotifs.filter(n => {
      if (n.targetUid === myUid) return true;
      if (n.targetEmail === myEmail) return true;
      if (Array.isArray(n.targetRoles)) {
        return n.targetRoles.map(r => r.toLowerCase()).includes(myRole);
      }
      return myRole === 'admin';
    }).sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    renderNotifications();
    updateNotifBadge();
  } catch (e) {
    console.warn('Load notifications failed:', e);
  }
}

/* ==================== ADD NOTIFICATION ==================== */
async function addNotification(data) {
  const user = window.firebaseAuth?.currentUser;
  const targets = data.targetRoles || NOTIF_DEFAULT_TARGETS[data.type] || ['admin'];

  const notif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type: data.type || 'system',
    icon: data.icon || '🔔',
    message: data.message || '',
    link: data.link || null,
    targetRoles: targets,
    targetUid: data.targetUid || null,
    targetEmail: data.targetEmail || null,
    read: false,
    readBy: [],
    createdAt: Date.now(),
    createdBy: user?.uid || null,
    createdByName: user?.displayName || user?.email?.split('@')[0] || 'System',
    priority: data.priority || 'normal'
  };

  const current = await dbGetSetting('notifications');
  const allNotifs = Array.isArray(current) ? current : (current?.value || []);

  allNotifs.unshift(notif);
  await dbSaveSetting('notifications', allNotifs.slice(0, 300));
}

/* ==================== MARK READ ==================== */
async function markNotifRead(id) {
  const n = NOTIF_STATE.notifications.find(x => x.id === id);
  if (!n || n.read) return;

  const myUid = window.firebaseAuth?.currentUser?.uid;
  const current = await dbGetSetting('notifications');
  const allNotifs = Array.isArray(current) ? current : (current?.value || []);
  const target = allNotifs.find(x => x.id === id);

  if (target) {
    target.readBy = target.readBy || [];
    if (!target.readBy.includes(myUid)) target.readBy.push(myUid);
    target.read = true;
    await dbSaveSetting('notifications', allNotifs);
  }

  n.read = true;
  renderNotifications();
  updateNotifBadge();
}

async function markAllNotificationsRead() {
  const current = await dbGetSetting('notifications');
  const allNotifs = Array.isArray(current) ? current : (current?.value || []);
  const myUid = window.firebaseAuth?.currentUser?.uid;
  const myIds = new Set(NOTIF_STATE.notifications.map(n => n.id));

  allNotifs.forEach(n => {
    if (myIds.has(n.id)) {
      n.read = true;
      n.readBy = n.readBy || [];
      if (!n.readBy.includes(myUid)) n.readBy.push(myUid);
    }
  });

  await dbSaveSetting('notifications', allNotifs);
  NOTIF_STATE.notifications.forEach(n => n.read = true);
  renderNotifications();
  updateNotifBadge();
  toast('✅ All marked as read');
}

/* ==================== DELETE ==================== */
async function deleteNotif(id, event) {
  if (event) event.stopPropagation();
  const current = await dbGetSetting('notifications');
  const allNotifs = Array.isArray(current) ? current : (current?.value || []);
  await dbSaveSetting('notifications', allNotifs.filter(n => n.id !== id));
  NOTIF_STATE.notifications = NOTIF_STATE.notifications.filter(n => n.id !== id);
  renderNotifications();
  updateNotifBadge();
}

async function clearAllNotifications() {
  if (!confirm('Clear all your visible notifications?')) return;
  const current = await dbGetSetting('notifications');
  const allNotifs = Array.isArray(current) ? current : (current?.value || []);
  const myIds = new Set(NOTIF_STATE.notifications.map(n => n.id));
  await dbSaveSetting('notifications', allNotifs.filter(n => !myIds.has(n.id)));
  NOTIF_STATE.notifications = [];
  renderNotifications();
  updateNotifBadge();
  toast('🗑️ Notifications cleared');
}

/* ==================== BADGE ==================== */
function updateNotifBadge() {
  const unread = NOTIF_STATE.notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  const panelCount = document.getElementById('notifPanelCount');
  const allCount = document.getElementById('notifAllCount');
  const unreadCount = document.getElementById('notifUnreadCount');
  const readCount = document.getElementById('notifReadCount');

  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
  if (panelCount) panelCount.textContent = unread;
  if (allCount) allCount.textContent = NOTIF_STATE.notifications.length;
  if (unreadCount) unreadCount.textContent = unread;
  if (readCount) readCount.textContent = NOTIF_STATE.notifications.length - unread;
}

/* ==================== TIME AGO ==================== */
function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 30) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min} min${min !== 1 ? 's' : ''} ago`;
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`;
  if (day < 7) return `${day} day${day !== 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
}

/* ==================== RENDER ==================== */
function renderNotifications() {
  const list = document.getElementById('notificationList');
  if (!list) return;

  let filtered = NOTIF_STATE.notifications.slice();
  if (NOTIF_STATE.filter === 'unread') filtered = filtered.filter(n => !n.read);
  else if (NOTIF_STATE.filter === 'read') filtered = filtered.filter(n => n.read);

  if (!filtered.length) {
    list.innerHTML = `
      <div class="notification-empty">
        <div style="font-size:40px;opacity:.3;margin-bottom:12px">🔔</div>
        <div style="font-size:13px;font-weight:600">No notifications ${NOTIF_STATE.filter !== 'all' ? 'in this tab' : 'yet'}</div>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}')">
      <div class="notif-icon ${n.type}">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-text">${n.message}</div>
        <div class="notif-time">🕐 ${timeAgo(n.createdAt)}${n.createdByName ? ' · 👤 ' + esc(n.createdByName) : ''}</div>
      </div>
      <button class="notif-delete" onclick="deleteNotif('${n.id}', event)">✕</button>
    </div>
  `).join('');
}

function handleNotifClick(id) {
  const n = NOTIF_STATE.notifications.find(x => x.id === id);
  if (!n) return;
  if (!n.read) markNotifRead(id);
  if (n.link) {
    closeNotifications();
    setTimeout(() => {
      const el = document.querySelector(`[data-page="${n.link}"]`);
      if (el) nav(n.link, el);
    }, 200);
  }
}

function toggleNotifications(event) {
  if (event) event.stopPropagation();
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;
  panel.classList.toggle('act');
  NOTIF_STATE.panelOpen = panel.classList.contains('act');
  if (NOTIF_STATE.panelOpen) {
    loadNotifications();
    checkDateBasedReminders();
  }
}

function closeNotifications() {
  const panel = document.getElementById('notificationPanel');
  if (panel) panel.classList.remove('act');
  NOTIF_STATE.panelOpen = false;
}

function switchNotifTab(tab, el) {
  NOTIF_STATE.filter = tab;
  document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('act'));
  if (el) el.classList.add('act');
  renderNotifications();
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationPanel');
  const btn = document.getElementById('notificationBtn');
  if (!panel || !btn) return;
  if (panel.contains(e.target) || btn.contains(e.target)) return;
  closeNotifications();
});

/* ============================================================
   DATE-BASED REMINDERS (v4 — Advanced)
   ============================================================ */
async function checkDateBasedReminders() {
  const now = Date.now();
  const todayStr = today();
  if (now - NOTIF_STATE.lastReminderCheck < 60 * 60 * 1000) return;
  NOTIF_STATE.lastReminderCheck = now;

  const reminderKey = 'last_reminder_date_' + todayStr;
  const alreadyRun = await dbGetSetting(reminderKey);
  if (alreadyRun) return;

  /* ============================================================
     1. TASKS
     ============================================================ */
  const tasks = (window.tasksState?.tasks) || STORE.tasks || [];
  const overdueTasks = tasks.filter(t => !t.done && t.dueDate && t.dueDate < todayStr);
  const todayTasks = tasks.filter(t => !t.done && t.dueDate === todayStr);

  if (overdueTasks.length > 0) {
    await addNotification({
      type: 'task',
      icon: '⚠️',
      message: `⚠️ <b>${overdueTasks.length}</b> task${overdueTasks.length > 1 ? 's' : ''} overdue!`,
      link: 'tasks',
      targetRoles: ['admin'],
      priority: 'high'
    });
  }
  if (todayTasks.length > 0) {
    await addNotification({
      type: 'task',
      icon: '📅',
      message: `📅 <b>${todayTasks.length}</b> task${todayTasks.length > 1 ? 's' : ''} due today`,
      link: 'tasks',
      targetRoles: ['admin']
    });
  }

  /* ============================================================
     2. FOLLOW-UPS — Basic
     ============================================================ */
  const followups = STORE.followups || [];
  const overdueFollowups = followups.filter(f => !f.completed && f.date && f.date < todayStr);
  const todayFollowups = followups.filter(f => !f.completed && f.date === todayStr);

  if (overdueFollowups.length > 0) {
    await addNotification({
      type: 'followup',
      icon: '🔔',
      message: `🔔 <b>${overdueFollowups.length}</b> follow-up${overdueFollowups.length > 1 ? 's' : ''} overdue`,
      link: 'followups',
      targetRoles: ['admin'],
      priority: 'high'
    });
  }
  if (todayFollowups.length > 0) {
    await addNotification({
      type: 'followup',
      icon: '🔥',
      message: `🔥 <b>${todayFollowups.length}</b> follow-up${todayFollowups.length > 1 ? 's' : ''} for today`,
      link: 'followups',
      targetRoles: ['admin']
    });
  }

  /* ============================================================
     2b. ⭐ ADVANCED FOLLOW-UP REMINDERS
     ============================================================ */
  const allFollowups = STORE.followups || [];

  const nextTodayFollowups = allFollowups.filter(f => {
    if (f.completed || !f.nextDate) return false;
    return f.nextDate === todayStr;
  });

  const highPriorityFollowups = allFollowups.filter(f =>
    !f.completed && f.priority === 'high' && f.date && f.date <= todayStr
  );

  const stalledLeads = allFollowups.filter(f => {
    if (f.completed) return false;
    if (['won', 'lost'].includes(f.status)) return false;
    if (!f.updatedAt) return false;
    const daysSinceUpdate = Math.floor((Date.now() - f.updatedAt) / 86400000);
    return daysSinceUpdate >= 7;
  });

  if (nextTodayFollowups.length > 0) {
    await addNotification({
      type: 'followup',
      icon: '📅',
      message: `📅 <b>${nextTodayFollowups.length}</b> next follow-up scheduled today`,
      link: 'followups',
      targetRoles: ['admin']
    });
  }

  if (highPriorityFollowups.length > 0) {
    await addNotification({
      type: 'followup',
      icon: '🚨',
      message: `🚨 <b>${highPriorityFollowups.length}</b> high-priority lead${highPriorityFollowups.length > 1 ? 's' : ''} need${highPriorityFollowups.length > 1 ? '' : 's'} attention`,
      link: 'followups',
      targetRoles: ['admin'],
      priority: 'high'
    });
  }

  if (stalledLeads.length > 0) {
    await addNotification({
      type: 'followup',
      icon: '⏸️',
      message: `⏸️ <b>${stalledLeads.length}</b> lead${stalledLeads.length > 1 ? 's' : ''} stalled (7+ days no activity)`,
      link: 'followups',
      targetRoles: ['admin']
    });
  }

  /* ============================================================
     3. EXPIRING DOCUMENTS
     ============================================================ */
  const docsRaw = await dbGetSetting('documents');
  const docs = Array.isArray(docsRaw) ? docsRaw : (docsRaw?.value || []);
  const expiringSoon = docs.filter(d => {
    if (!d.expiry) return false;
    const diff = Math.round((new Date(d.expiry) - new Date()) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  if (expiringSoon.length > 0) {
    await addNotification({
      type: 'document',
      icon: '📄',
      message: `📄 <b>${expiringSoon.length}</b> document${expiringSoon.length > 1 ? 's' : ''} expiring soon`,
      link: 'documents',
      targetRoles: ['admin', 'accountant']
    });
  }

  /* ============================================================
     4. CUSTOMER DUE SUMMARY
     ============================================================ */
  const customers = STORE.customers || [];
  const dueCustomers = [];
  customers.forEach(c => {
    let bill = 0, paid = 0;
    (STORE.packages || []).forEach(p => {
      if (p.status === 'Cancelled') return;
      if (p.customerId === c.id || p.customerPhone === c.phone) bill += Number(p.grandTotal || 0);
    });
    (c.payments || []).forEach(pm => { paid += Number(pm.amount || 0); });
    const due = Math.max(0, bill - paid);
    if (due > 0) dueCustomers.push({ name: c.customerName, due });
  });

  if (dueCustomers.length > 0) {
    const totalDue = dueCustomers.reduce((s, c) => s + c.due, 0);
    await addNotification({
      type: 'payment',
      icon: '💰',
      message: `💰 <b>${dueCustomers.length}</b> customer${dueCustomers.length > 1 ? 's' : ''} due total <b>৳${totalDue.toLocaleString()}</b>`,
      link: 'accounts',
      targetRoles: ['admin', 'accountant']
    });
  }

  await dbSaveSetting(reminderKey, true);
}

/* ==================== INIT ==================== */
window.addEventListener('load', () => {
  setTimeout(() => {
    const user = window.firebaseAuth?.currentUser;
    if (user) {
      startNotificationsListener();
    } else {
      const checkUser = setInterval(() => {
        if (window.firebaseAuth?.currentUser) {
          clearInterval(checkUser);
          startNotificationsListener();
        }
      }, 1000);
    }

    setTimeout(checkDateBasedReminders, 10000);
  }, 2000);
});