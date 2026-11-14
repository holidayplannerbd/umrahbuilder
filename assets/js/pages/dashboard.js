/* ============================================================
   UMRAH BUILDER — PAGES / DASHBOARD
   Firestore userProfiles ব্যবহার করে নাম ও ছবি
   ============================================================ */

/* ⭐ Firebase Auth + Firestore profile থেকে ইউজারের তথ্য */
async function getCurrentUserInfo() {
  const user = window.firebaseAuth?.currentUser;
  if (!user) return { name: 'User', photo: '', email: '', user: null };

  let profile = {};
  try {
    if (typeof dbGetUserProfile === 'function') {
      profile = await dbGetUserProfile() || {};
    }
  } catch (e) {
    console.warn('Could not load profile:', e);
  }

  const name = profile.name
    || user.displayName
    || (user.email ? user.email.split('@')[0] : 'User');

  const photo = profile.photo || user.photoURL || '';
  const email = user.email || '';

  return { name, photo, email, user };
}

/* ⭐ ইউজারের ছবি বা প্রথম অক্ষর দেখানো */
function renderUserAvatar(photoURL, name, imgId, fallbackId) {
  const imgEl = $(imgId);
  const fallbackEl = $(fallbackId);
  if (!imgEl) return;

  if (photoURL) {
    imgEl.src = photoURL;
    imgEl.style.display = 'block';
    imgEl.style.visibility = 'visible';
    imgEl.style.objectFit = 'cover';
    if (fallbackEl) fallbackEl.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    if (fallbackEl) {
      fallbackEl.style.display = 'flex';
      fallbackEl.textContent = (name?.[0] || 'A').toUpperCase();
    }
  }
}

/* ⭐ প্যাকেজের মালিকের নাম বের করা */
function getPackageOwnerName(pkg) {
  if (!pkg || !pkg.userId) return '';

  const cu = window.firebaseAuth?.currentUser;

  if (cu && cu.uid === pkg.userId) {
    return cu.displayName || cu.email?.split('@')[0] || 'You';
  }

  const profiles = window.__userProfiles || {};
  if (profiles[pkg.userId]?.name) return profiles[pkg.userId].name;

  return '';
}

/* ⭐ আমার প্যাকেজ কিনা চেক */
function isMyPackage(pkg) {
  const cu = window.firebaseAuth?.currentUser;
  return cu && pkg.userId === cu.uid;
}

/* ==================== RENDER DASHBOARD ==================== */
async function renderDashboard() {
  const setNum = (id, n) => {
    const e = $(id);
    if (e) e.textContent = n;
  };

  const { name: displayName, photo: userPhoto, email: userEmail, user } = await getCurrentUserInfo();

  // পেজ টাইটেল
  const nameEl = $('pageTitle');
  if (nameEl) nameEl.innerHTML = `Welcome back, <span>${esc(displayName)}!</span>`;

  // সাইডবারে নাম ও ইমেইল
  const sideNameEl = $('sideName');
  if (sideNameEl) sideNameEl.textContent = displayName;
  const sideEmailEl = $('sideEmail');
  if (sideEmailEl) sideEmailEl.textContent = userEmail || '';

  // সাইডবার ও Analytics ছবি
  renderUserAvatar(userPhoto, displayName, 'sideAvatar', 'sideAvatarFallback');
  renderUserAvatar(userPhoto, displayName, 'anAvatarImg', 'anAvatarFallback');

  // Analytics নাম
  const anNameEl = $('anProfileName');
  if (anNameEl) anNameEl.textContent = displayName;

  // Settings প্রোফাইল ছবি
  const profilePicPreview = $('profilePicPreview');
  if (profilePicPreview) {
    if (userPhoto) {
      profilePicPreview.innerHTML = `<img src="${userPhoto}" alt="">`;
    } else {
      profilePicPreview.innerHTML = `<span id="profilePicFallback">${(displayName?.[0] || 'A').toUpperCase()}</span>`;
    }
  }

  /* ⭐ Packages সংখ্যা */
  let myPackageCount = STORE.packages.filter(p => p.status === 'Paid').length;
  if (user) {
    myPackageCount = STORE.packages.filter(p => p.userId === user.uid && p.status === 'Paid').length;
  }
  setNum('statPackages', myPackageCount);

  /* ⭐ বাকি ডেটা */
  setNum('statCustomers', STORE.customers.length);

  let totalDue = 0;
  STORE.customers.forEach(c => {
    const t = getCustomerTotals(c);
    totalDue += t.due;
  });
  const dueEl = $('statDue');
  if (dueEl) dueEl.textContent = fmt(totalDue).replace('৳ ', '৳');

  let totalReceived = 0;
  STORE.customers.forEach(c => {
    (c.payments || []).forEach(p => {
      totalReceived += Math.max(0, Number(p.amount || 0));
    });
  });
  STORE.packages.forEach(p => {
    const advance = getPackageAdvance(p);
    if (advance <= 0) return;
    let alreadyRecorded = false;
    STORE.customers.forEach(c => {
      if (alreadyRecorded) return;
      (c.payments || []).forEach(pm => {
        if (pm.packageId === p.id && pm.isAdvance) alreadyRecorded = true;
      });
    });
    if (!alreadyRecorded) totalReceived += advance;
  });
  const revEl = $('statRevenue');
  if (revEl) revEl.textContent = fmt(totalReceived).replace('৳ ', '৳');

  /* Recent Packages */
  const el = $('recentPackagesList');
  if (el) {
    const recent = STORE.packages.slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);

    if (!recent.length) {
      el.innerHTML = '<div class="empty-slot"><span class="ic">📦</span>No packages yet — Create your first!</div>';
    } else {
      el.innerHTML = recent.map(p => {
        const cls = (p.status || 'draft').toLowerCase().replace(/\s+/g, '-');
        const ownerName = getPackageOwnerName(p);
        const isMe = isMyPackage(p);

        return `<div class="pkg-row" onclick="viewPackage(${p.id})">
          <span class="pkg-row-dot ${cls}"></span>
          <div class="pkg-row-info">
            <h4>${esc(p.name) || 'Untitled'}</h4>
            <div class="meta">
              ${ownerName ? `<span style="color:${isMe ? 'var(--primary)' : 'var(--blue)'};font-weight:700">👤 ${esc(ownerName)}${isMe ? ' (You)' : ''}</span>` : ''}
              <span>${p.nights || 0}N / ${p.days || 0}D</span>
              <span>${p.paxAdult || 0} adults</span>
            </div>
          </div>
          <span class="pkg-row-badge ${cls}">${esc(p.status || 'Draft')}</span>
          <span class="pkg-row-price">${fmt(p.grandTotal)}</span>
        </div>`;
      }).join('');
    }
  }

  // ⭐ Recent Tasks লোড করা (সঠিক জায়গায়)
  if (typeof renderDashboardTasks === 'function') {
    await renderDashboardTasks();
  }

  updateCharts();
  if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
}

/* ==================== UPDATE CHARTS ==================== */
function updateCharts() {
  const allPackages = STORE.packages;

  const types = { Economy: 0, Standard: 0, Premium: 0, Ramadan: 0 };
  allPackages.forEach(p => {
    const t = p.type || 'Standard';
    if (types[t] !== undefined) types[t]++;
  });

  if ($('legendStandard')) $('legendStandard').textContent = types.Standard;
  if ($('legendEconomy')) $('legendEconomy').textContent = types.Economy;
  if ($('legendPremium')) $('legendPremium').textContent = types.Premium;
  if ($('legendRamadan')) $('legendRamadan').textContent = types.Ramadan;

  const donutEl = document.getElementById('typeChart');
  if (donutEl) {
    if (typeChartInstance) typeChartInstance.destroy();
    const total = Object.values(types).reduce((a, b) => a + b, 0);
    const isDark = document.body.classList.contains('dark');
    const emptyColor = isDark ? '#27272a' : '#f0f0f2';

    if (total === 0) {
      typeChartInstance = new Chart(donutEl, {
        type: 'doughnut',
        data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: [emptyColor], borderWidth: 0 }] },
        options: { cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, responsive: true, maintainAspectRatio: false }
      });
    } else {
      typeChartInstance = new Chart(donutEl, {
        type: 'doughnut',
        data: {
          labels: ['Standard', 'Economy', 'Premium', 'Ramadan'],
          datasets: [{ data: [types.Standard, types.Economy, types.Premium, types.Ramadan], backgroundColor: ['#f97316', '#3b82f6', '#a855f7', '#22c55e'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: { cutout: '72%', plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
      });
    }
  }

  const canvasEl = document.getElementById('progressChart');
  if (canvasEl) {
    if (progressChartInstance) progressChartInstance.destroy();

    const isDark = document.body.classList.contains('dark');
    const gridColor = isDark ? '#27272a' : '#f0f0f2';
    const tickColor = isDark ? '#71717a' : '#a1a1aa';

    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    const counts = days.map(d => {
      const start = new Date();
      start.setDate(start.getDate() - (30 - d));
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return allPackages.filter(p => {
        const c = new Date(p.createdAt || 0);
        return c >= start && c < end;
      }).length;
    });

    let cumulative = 0;
    const cumData = counts.map(c => { cumulative += c; return cumulative; });

    const ctx = canvasEl.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, 'rgba(249,115,22,.25)');
    grad.addColorStop(1, 'rgba(249,115,22,0)');

    progressChartInstance = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: days.map(d => (d === 1 || d % 5 === 0) ? d : ''),
        datasets: [{
          label: 'Total Packages',
          data: cumData,
          borderColor: '#f97316',
          backgroundColor: grad,
          borderWidth: 2.5,
          fill: true,
          tension: .35,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#f97316',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#18181b', padding: 10, cornerRadius: 8, displayColors: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, weight: '600' } }, border: { display: false } },
          y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 10, weight: '600' }, padding: 8 }, border: { display: false }, beginAtZero: true }
        }
      }
    });
  }
}

/* ============================================================
   ⭐ DASHBOARD RECENT TASKS (Priority Based)
   ============================================================ */
async function renderDashboardTasks() {
  const el = $('dashboardTasksList');
  if (!el) return;

  // ১. টাস্ক লোড করা (যদি আগে থেকে লোড না থাকে)
  if (!window.tasksState || !window.tasksState.tasks || window.tasksState.tasks.length === 0) {
    try {
      const { collection, getDocs } = window.firebaseFns;
      const snap = await getDocs(collection(window.firebaseDB, 'tasks'));
      const allTasks = [];
      snap.forEach(doc => allTasks.push({ ...doc.data(), id: doc.data().id || doc.id }));
      
      if (window.tasksState) {
        window.tasksState.tasks = allTasks;
      } else {
        window.tasksState = { tasks: allTasks };
      }
    } catch (e) {
      console.warn('Dashboard tasks load failed:', e);
    }
  }

  const tasks = (window.tasksState?.tasks || []).filter(t => !t.done);

  if (!tasks.length) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13px">✅ সব টাস্ক কমপ্লিট! নতুন টাস্ক যোগ করুন।</div>`;
    return;
  }

  // ২. Priority অনুযায়ী সর্ট করা (High → Medium → Low)
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  tasks.sort((a, b) => {
    const pwA = priorityWeight[a.priority || 'medium'] || 2;
    const pwB = priorityWeight[b.priority || 'medium'] || 2;
    if (pwA !== pwB) return pwB - pwA; // High আগে
    return (a.dueDate || '').localeCompare(b.dueDate || ''); // একই প্রায়োরিটি হলে ডেট অনুযায়ী
  });

  // ৩. সর্বোচ্চ ৪টি টাস্ক নেওয়া
  const topTasks = tasks.slice(0, 4);

  // ৪. রেন্ডার করা
  el.innerHTML = topTasks.map(t => {
    const priorityColor = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' }[t.priority || 'medium'];
    const priorityLabel = { high: '🔴 HIGH', medium: '🟡 MEDIUM', low: '🟢 LOW' }[t.priority || 'medium'];

    // ⭐ Assignee নাম ও ছবি বের করা
    let assignName = 'Unassigned';
    let assignPhoto = '';
    const profiles = window.__userProfiles || {};
    
    if (t.assignedTo === 'both') {
      assignName = 'Both (Team)';
    } else if (t.assignedTo) {
      if (profiles[t.assignedTo]?.name) {
        assignName = profiles[t.assignedTo].name;
        assignPhoto = profiles[t.assignedTo].photo || '';
      } else if (t.assignedTo.includes('@')) {
        assignName = t.assignedTo.split('@')[0];
      } else {
        assignName = t.assignedTo;
      }
    }

    const avatarHtml = assignPhoto
      ? `<img src="${assignPhoto}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">`
      : `<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">${(assignName[0]||'?').toUpperCase()}</div>`;

    const dueText = t.dueDate ? formatTaskDateShort(t.dueDate) : 'No date';
    
    // প্রোগ্রেস
    const steps = (t.steps && t.steps.length) ? t.steps : [];
    const completed = t.stepsCompleted || 0;
    const progressPct = steps.length ? Math.round((completed / steps.length) * 100) : 0;

    return `<div class="pkg-row" onclick="openTaskDetail('${t.id}')" style="padding:12px 14px;margin-bottom:8px">
      <span class="pkg-row-dot" style="background:${priorityColor}"></span>
      <div class="pkg-row-info">
        <h4 style="margin-bottom:4px">${esc(t.title || 'Untitled Task')}</h4>
        <div class="meta">
          <span style="display:flex;align-items:center;gap:5px">
            ${avatarHtml}
            <b>${esc(assignName)}</b>
          </span>
          <span>📅 ${dueText}</span>
          <span style="color:${priorityColor};font-weight:700;font-size:10px">${priorityLabel}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:800;color:${priorityColor}">${progressPct}%</div>
        <div style="width:60px;height:4px;background:var(--bg-2);border-radius:4px;margin-top:4px;overflow:hidden">
          <div style="width:${progressPct}%;height:100%;background:${priorityColor};border-radius:4px"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ⭐ Helper: Short Date Format */
function formatTaskDateShort(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return 'Today';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch (e) {
    return dateStr;
  }
}