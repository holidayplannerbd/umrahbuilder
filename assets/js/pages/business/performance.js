/* ============================================================
   UMRAH BUILDER — PAGES / BUSINESS / PERFORMANCE
   Top Performer Logic: Packages, Sales, Tasks, and Time Efficiency
   ============================================================ */

/* ==================== CONFIG ==================== */
const PERF_WEIGHTS = {
  packages: 20,
  soldPackages: 20,
  revenue: 20,
  tasks: 25,
  efficiency: 15
};
let performanceTasks = [];

async function loadPerformanceTasks() {
  const { collection, getDocs } = window.firebaseFns;
  const snapshot = await getDocs(collection(window.firebaseDB, 'tasks'));
  performanceTasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

/* ==================== GET NAME BY UID ==================== */
function getPerformanceUserName(uid) {
  if (!uid) return 'Unknown';

  const profiles = window.__userProfiles || {};
  if (profiles[uid]?.name) return profiles[uid].name;

  const cu = window.firebaseAuth?.currentUser;
  if (cu && cu.uid === uid) {
    return cu.displayName || cu.email?.split('@')[0] || 'You';
  }

  return 'Team Member';
}

/* ==================== GET PHOTO BY UID ==================== */
function getPerformanceUserPhoto(uid) {
  if (!uid) return '';

  const profiles = window.__userProfiles || {};
  if (profiles[uid]?.photo) return profiles[uid].photo;

  const cu = window.firebaseAuth?.currentUser;
  if (cu && cu.uid === uid) {
    return cu.photoURL || '';
  }

  return '';
}

function formatPerformanceDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Not tracked';
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function resolvePerformanceUserId(value, statsMap) {
  if (!value || typeof value !== 'string') return '';
  if (statsMap[value]) return value;
  const profiles = window.__userProfiles || {};
  const identity = value.trim().toLowerCase();

  const profile = Object.values(profiles).find(p =>
    [p.uid, p.email, p.name, p.username]
      .some(candidate => String(candidate || '').trim().toLowerCase() === identity)
  );
  return profile?.uid || '';
}

/* ==================== BUILD REAL STATS ==================== */
function buildPerformanceStats(tasks = performanceTasks) {
  const statsMap = {};
  const profiles = window.__userProfiles || {};

  const ensureStats = (uid, role) => {
    if (!uid) return null;
    if (!statsMap[uid]) {
      statsMap[uid] = {
        uid, role: role || profiles[uid]?.role || 'staff',
        packages: 0, confirmed: 0, revenue: 0, customers: new Set(),
        tasksCompleted: 0, trackedTaskSeconds: 0, trackedTasks: 0,
        averageTaskSeconds: 0
      };
    }
    return statsMap[uid];
  };

  Object.values(profiles).forEach(profile => {
    if (profile.uid) ensureStats(profile.uid, profile.role);
  });

  STORE.packages.forEach(p => {
    const uid = p.userId;
    if (!uid) return;

    const s = ensureStats(uid);
    s.packages++;
    if (['Confirmed', 'Paid', 'Completed', 'Travelled'].includes(p.status)) {
      s.confirmed++;
      const revenue = Number(p.grandTotal || 0);
      if (Number.isFinite(revenue)) s.revenue += Math.max(0, revenue);
    }
    if (p.customerName) s.customers.add(p.customerName);
  });

  tasks.forEach(task => {
    if (!(task.done === true || String(task.status || '').toLowerCase() === 'done')) return;

    let uid = Object.prototype.hasOwnProperty.call(task, 'completedBy')
      ? task.completedBy
      : '';
    if (!Object.prototype.hasOwnProperty.call(task, 'completedBy')) {
      const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
      if (assignees.length !== 1 || ['both', 'all'].includes(String(assignees[0] || '').toLowerCase())) return;
      uid = resolvePerformanceUserId(String(assignees[0] || ''), statsMap);
    }
    if (!uid) return;

    const s = ensureStats(uid);
    s.tasksCompleted++;
    const seconds = Number(task.totalTime || 0);
    if (Number.isFinite(seconds) && seconds > 0) {
      s.trackedTaskSeconds += seconds;
      s.trackedTasks++;
    }
  });

  const result = [];
  for (const uid of Object.keys(statsMap)) {
    const s = statsMap[uid];
    result.push({
      uid,
      role: String(s.role || 'staff').replace(/^./, c => c.toUpperCase()),
      name: getPerformanceUserName(uid),
      photo: getPerformanceUserPhoto(uid),
      packages: s.packages,
      confirmed: s.confirmed,
      revenue: s.revenue,
      customers: s.customers.size,
      tasksCompleted: s.tasksCompleted,
      trackedTasks: s.trackedTasks,
      averageTaskSeconds: s.trackedTasks ? s.trackedTaskSeconds / s.trackedTasks : 0
    });
  }

  const maxValues = {
    packages: Math.max(0, ...result.map(s => s.packages)),
    soldPackages: Math.max(0, ...result.map(s => s.confirmed)),
    revenue: Math.max(0, ...result.map(s => s.revenue)),
    tasks: Math.max(0, ...result.map(s => s.tasksCompleted))
  };
  const fastestAverage = Math.min(
    ...result.filter(s => s.averageTaskSeconds > 0).map(s => s.averageTaskSeconds),
    Infinity
  );

  result.forEach(s => {
    s.efficiencyScore = s.averageTaskSeconds > 0 && Number.isFinite(fastestAverage)
      ? fastestAverage / s.averageTaskSeconds * 100
      : 0;
    const metrics = {
      packages: s.packages,
      soldPackages: s.confirmed,
      revenue: s.revenue,
      tasks: s.tasksCompleted,
      efficiency: s.efficiencyScore
    };
    s.combinedScore = Object.keys(PERF_WEIGHTS).reduce((score, key) => {
      const normalized = key === 'efficiency'
        ? metrics[key]
        : (maxValues[key] ? metrics[key] / maxValues[key] * 100 : 0);
      return score + normalized * PERF_WEIGHTS[key] / 100;
    }, 0);
  });

  result.sort((a, b) => b.combinedScore - a.combinedScore || a.name.localeCompare(b.name));

  return result;
}

/* ==================== RENDER PERFORMANCE ==================== */
async function renderPerformance() {
  if (typeof refreshUserProfiles === 'function') await refreshUserProfiles();

  try {
    await loadPerformanceTasks();
  } catch (e) {
    toast('Could not load task performance data: ' + e.message, 'error');
    return;
  }

  const stats = buildPerformanceStats();
  const top = stats[0];

  /* ============ Top Performer Card ============ */
  const topCard = document.getElementById('topPerformerCard');
  if (topCard) {
    if (top && (top.packages > 0 || top.confirmed > 0 || top.tasksCompleted > 0)) {
      const avatarHtml = top.photo
        ? `<img src="${top.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : `🥇`;

      topCard.innerHTML = `
        <div class="top-performer-card">
          <div class="top-performer-content">
            <div class="top-performer-avatar">${avatarHtml}</div>
            <div class="top-performer-info">
              <div class="top-performer-label">🏆 Top Performer</div>
              <div class="top-performer-name">${esc(top.name)}</div>
              <div class="top-performer-stats">
                <span>📦 <b>${top.packages}</b> packages</span>
                <span>🛒 <b>${top.confirmed}</b> sold · ${fmt(top.revenue)}</span>
                <span>✅ <b>${top.tasksCompleted}</b> tasks · ⏱ ${formatPerformanceDuration(top.averageTaskSeconds)} avg</span>
              </div>
              <div class="top-performer-score">
                ⭐ Score: ${top.combinedScore.toFixed(1)} / 100
              </div>
            </div>
            <div class="top-performer-bonus">
              <div class="lbl">💰 Sales Bonus (2%)</div>
              <div class="val">${fmt(Math.round(top.revenue * 0.02))}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      topCard.innerHTML = `<div style="padding:20px;background:var(--bg-2);border-radius:14px;text-align:center;color:var(--text-3);font-size:13px">📊 No performance data yet</div>`;
    }
  }

  const ac = document.getElementById('perfActiveCount');
  if (ac) ac.textContent = stats.length + ' Team Members';

  /* ============ Leaderboard Table ============ */
  const ptb = document.getElementById('perfTableBody');
  if (ptb) {
    if (!stats.length) {
      ptb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-3)">No data</td></tr>';
    } else {
      ptb.innerHTML = stats.map((d, i) => {
        const rc = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : 'rn';
        const scorePct = Math.min(100, d.combinedScore).toFixed(0);
        const isMe = window.firebaseAuth?.currentUser?.uid === d.uid;

        const avatarContent = d.photo
          ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : esc((d.name[0] || 'A').toUpperCase());

        return `<tr ${isMe ? 'style="background:var(--primary-bg)"' : ''}>
          <td><div class="rank-badge ${rc}">${i + 1}</div></td>
          <td><div style="display:flex;align-items:center;gap:10px">
            <div class="customer-avatar" style="width:36px;height:36px;font-size:14px;overflow:hidden">${avatarContent}</div>
            <div>
              <div style="font-weight:700">${esc(d.name)}${isMe ? ' <span style="color:var(--primary);font-size:10px">(You)</span>' : ''}</div>
              <div style="font-size:11px;color:var(--text-3)">${d.customers} customers</div>
            </div>
          </div></td>
          <td><span class="pill ${isMe ? 'confirmed' : 'quoted'}">${esc(d.role)}</span></td>
          <td><b>${d.packages}</b></td>
          <td>${d.confirmed}</td>
          <td style="color:var(--green);font-weight:800">${fmt(d.revenue)}</td>
          <td>${d.tasksCompleted}</td>
          <td>${formatPerformanceDuration(d.averageTaskSeconds)}</td>
          <td>
            <div class="perf-bar"><div class="perf-bar-fill" style="width:${scorePct}%"></div></div>
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">
              <b>${d.combinedScore.toFixed(1)}</b> (${scorePct}%)
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  }

  /* ============ Chart: Cumulative Line ============ */
  const canvas = document.getElementById('perfChart');
  if (canvas) {
    if (perfChart) perfChart.destroy();
    
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

    /* ⭐ Show ALL staff (not just 4) */
    const datasets = stats.map((stat, idx) => {
      const color = colors[idx % colors.length];
      
      /* ⭐ Cumulative count over 30 days */
      let cumulative = 0;
      const cumCounts = days.map(d => {
        const start = new Date();
        start.setDate(start.getDate() - (30 - d));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        
        const count = STORE.packages.filter(p => {
          if (p.userId !== stat.uid) return false;
          const c = new Date(p.createdAt || 0);
          return c >= start && c < end;
        }).length;
        
        cumulative += count;
        return cumulative;
      });
      
      /* ⭐ Check if this staff has ANY data in 30 days */
      const totalIn30Days = cumCounts[cumCounts.length - 1] || 0;
      
      return {
        label: stat.name + (totalIn30Days === 0 ? ' (no recent data)' : ` (${totalIn30Days})`),
        data: cumCounts,
        borderColor: color,
        backgroundColor: color + '15',
        borderWidth: totalIn30Days === 0 ? 1 : 2.5,
        borderDash: totalIn30Days === 0 ? [5, 5] : [],
        tension: .35,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
        fill: false
      };
    });

    if (!datasets.length) {
      datasets.push({ 
        label: 'No data', 
        data: days.map(() => 0), 
        borderColor: '#a1a1aa', 
        borderWidth: 1 
      });
    }

    perfChart = new Chart(canvas, {
      type: 'line',
      data: { labels: days.map(d => d === 1 || d % 5 === 0 ? d : ''), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { 
            position: 'top', 
            labels: { 
              boxWidth: 12, 
              padding: 14, 
              font: { size: 11, weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle'
            } 
          },
          tooltip: {
            backgroundColor: 'rgba(24,24,27,.95)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 12, weight: '700' },
            bodyFont: { size: 11 },
            callbacks: {
              label: ctx => `${ctx.dataset.label.split(' (')[0]}: ${ctx.parsed.y} package${ctx.parsed.y !== 1 ? 's' : ''}`
            }
          }
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { font: { size: 10 }, color: '#a1a1aa' },
            border: { display: false }
          },
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(0,0,0,.05)' }, 
            ticks: { precision: 0, font: { size: 10 }, color: '#a1a1aa', padding: 8 },
            border: { display: false },
            title: {
              display: true,
              text: 'Total Packages Created',
              font: { size: 10, weight: '600' },
              color: '#a1a1aa'
            }
          }
        }
      }
    });
  }
}
/* ==================== MANAGE EMPLOYEES ==================== */
async function openManageEmployees() {
  if (typeof refreshUserProfiles === 'function') {
    try { await refreshUserProfiles(); } catch (e) {}
  }
  try {
    await loadPerformanceTasks();
  } catch (e) {
    toast('Could not load task performance data: ' + e.message, 'error');
    return;
  }
  const stats = buildPerformanceStats();
  const lines = stats.map((s, i) =>
    `${i + 1}. ${s.name}\n   📦 ${s.packages} created · 🛒 ${s.confirmed} sold · ✅ ${s.tasksCompleted} tasks · ⏱ ${formatPerformanceDuration(s.averageTaskSeconds)} avg · ⭐ ${s.combinedScore.toFixed(1)}`
  ).join('\n\n');
  alert(`👥 Team Members (${stats.length}):\n\n${lines || 'No users yet'}\n\n📊 Ranking: 20% packages created, 20% sold packages, 20% sales revenue, 25% completed tasks, 15% task speed`);
}

async function showTeamLeaderboard() {
  try {
    await loadPerformanceTasks();
  } catch (e) {
    toast('Could not load task performance data: ' + e.message, 'error');
    return;
  }
  const stats = buildPerformanceStats();
  const lines = stats.map((s, i) =>
    `${i + 1}. ${s.name} — ${s.combinedScore.toFixed(1)} pts (${s.packages} created, ${s.confirmed} sold, ${s.tasksCompleted} tasks, ${formatPerformanceDuration(s.averageTaskSeconds)} avg)`
  );
  alert('🏆 Team Leaderboard:\n\n' + (lines.join('\n') || 'No data yet'));
}