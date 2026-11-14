/* ============================================================
   UMRAH BUILDER — PAGES / BUSINESS / PERFORMANCE
   Top Performer Logic: Combined Score (Packages + Revenue)
   ============================================================ */

/* ==================== CONFIG ==================== */
const PERF_PKG_WEIGHT = 60;      // 60% weight on package count
const PERF_REVENUE_WEIGHT = 40;  // 40% weight on revenue

/* ==================== GET NAME BY UID ==================== */
function getPerformanceUserName(uid) {
  if (!uid) return 'Unknown';

  const cu = window.firebaseAuth?.currentUser;
  if (cu && cu.uid === uid) {
    return cu.displayName || cu.email?.split('@')[0] || 'You';
  }

  const profiles = window.__userProfiles || {};
  if (profiles[uid]?.name) return profiles[uid].name;

  return 'Team Member';
}

/* ==================== GET PHOTO BY UID ==================== */
function getPerformanceUserPhoto(uid) {
  if (!uid) return '';

  const cu = window.firebaseAuth?.currentUser;
  if (cu && cu.uid === uid) {
    const profiles = window.__userProfiles || {};
    return profiles[uid]?.photo || cu.photoURL || '';
  }

  const profiles = window.__userProfiles || {};
  if (profiles[uid]?.photo) return profiles[uid].photo;

  return '';
}

/* ==================== BUILD REAL STATS ==================== */
function buildPerformanceStats() {
  const statsMap = {};

  STORE.packages.forEach(p => {
    const uid = p.userId;
    if (!uid) return;

    if (!statsMap[uid]) {
      statsMap[uid] = { uid, count: 0, confirmed: 0, revenue: 0, customers: new Set() };
    }

    const s = statsMap[uid];
    s.count++;
    s.revenue += Number(p.grandTotal || 0);
    if (['Confirmed', 'Paid', 'Completed'].includes(p.status)) s.confirmed++;
    if (p.customerName) s.customers.add(p.customerName);
  });

  const result = [];
  for (const uid of Object.keys(statsMap)) {
    const s = statsMap[uid];
    result.push({
      uid,
      name: getPerformanceUserName(uid),
      photo: getPerformanceUserPhoto(uid),
      packages: s.count,
      confirmed: s.confirmed,
      revenue: s.revenue,
      customers: s.customers.size
    });
  }

  /* ⭐ NEW LOGIC: Combined Score
     Combined Score = (Packages × 60%) + (Revenue Share × 40%)
     
     Example:
     - Junayet: 5 packages, ৳1,00,000 revenue
     - Rajon:   15 packages, ৳50,000 revenue
     
     Rajon top — because more work done!
  */

  /* Normalize by max values */
  const maxPackages = Math.max(1, ...result.map(s => s.packages));
  const maxRevenue = Math.max(1, ...result.map(s => s.revenue));

  /* Calculate combined score */
  result.forEach(s => {
    const pkgScore = (s.packages / maxPackages) * PERF_PKG_WEIGHT;
    const revenueScore = (s.revenue / maxRevenue) * PERF_REVENUE_WEIGHT;
    s.combinedScore = pkgScore + revenueScore;
    s.pkgScore = pkgScore;
    s.revenueScore = revenueScore;
  });

  /* Sort by combined score */
  result.sort((a, b) => b.combinedScore - a.combinedScore);

  return result;
}

/* ==================== RENDER PERFORMANCE ==================== */
async function renderPerformance() {
  if (typeof refreshUserProfiles === 'function') {
    try { await refreshUserProfiles(); } catch (e) {}
  }

  const stats = buildPerformanceStats();
  const maxScore = stats.length ? stats[0].combinedScore : 1;
  const top = stats[0];

  /* ============ Top Performer Card ============ */
  const topCard = document.getElementById('topPerformerCard');
  if (topCard) {
    if (top && top.packages > 0) {
      const avatarHtml = top.photo
        ? `<img src="${top.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : `🥇`;

      const scorePct = maxScore > 0 ? (top.combinedScore / maxScore * 100).toFixed(0) : 0;

      topCard.innerHTML = `
        <div class="top-performer-card">
          <div class="top-performer-content">
            <div class="top-performer-avatar">${avatarHtml}</div>
            <div class="top-performer-info">
              <div class="top-performer-label">🏆 Top Performer</div>
              <div class="top-performer-name">${esc(top.name)}</div>
              <div class="top-performer-stats">
                <span>📦 <b>${top.packages}</b> packages</span>
                <span>💰 <b>${fmt(top.revenue)}</b></span>
                <span>✅ <b>${top.confirmed}</b> confirmed</span>
              </div>
              <div class="top-performer-score">
                ⭐ Score: ${top.combinedScore.toFixed(1)} / 100
              </div>
            </div>
            <div class="top-performer-bonus">
              <div class="lbl">💰 Bonus (2%)</div>
              <div class="val">${fmt(Math.round(top.revenue * 0.02))}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      topCard.innerHTML = `<div style="padding:20px;background:var(--bg-2);border-radius:14px;text-align:center;color:var(--text-3);font-size:13px">📊 এখনো কোনো প্যাকেজ তৈরি হয়নি</div>`;
    }
  }

  const ac = document.getElementById('perfActiveCount');
  if (ac) ac.textContent = stats.length + ' Active';

  /* ============ Leaderboard Table ============ */
  const ptb = document.getElementById('perfTableBody');
  if (ptb) {
    if (!stats.length) {
      ptb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">No data</td></tr>';
    } else {
      ptb.innerHTML = stats.map((d, i) => {
        const rc = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : 'rn';
        const scorePct = maxScore > 0 ? (d.combinedScore / maxScore * 100).toFixed(0) : 0;
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
          <td><span class="pill ${isMe ? 'confirmed' : 'quoted'}">${isMe ? 'YOU' : 'TEAM'}</span></td>
          <td><b>${d.packages}</b></td>
          <td style="color:var(--green);font-weight:800">${fmt(d.revenue)}</td>
          <td>${d.confirmed}</td>
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
  const stats = buildPerformanceStats();
  const lines = stats.map((s, i) =>
    `${i + 1}. ${s.name}\n   📦 ${s.packages} packages · 💰 ${fmt(s.revenue)} · ⭐ Score: ${s.combinedScore.toFixed(1)}`
  ).join('\n\n');
  alert(`👥 Team Members (${stats.length}):\n\n${lines || 'No users yet'}\n\n📊 Ranking by Combined Score (60% Packages + 40% Revenue)`);
}

async function showTeamLeaderboard() {
  const stats = buildPerformanceStats();
  const lines = stats.map((s, i) =>
    `${i + 1}. ${s.name} — Score: ${s.combinedScore.toFixed(1)} (${s.packages} pkg, ${fmt(s.revenue)})`
  );
  alert('🏆 Team Leaderboard:\n\n' + (lines.join('\n') || 'No data yet'));
}