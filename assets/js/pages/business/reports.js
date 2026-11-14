/* ============================================================
   UMRAH BUILDER — REPORTS (v4 — Fully Dynamic)
   ⭐ Dynamic vendor due + customer due from real payments
   ⭐ Flight vendor excluded (only net/sell profit)
   ============================================================ */

/* reportChart, reportTypeChart declared in state.js */

/* ⭐ Vendor cost calculation (Flight excluded — flight vendor nai) */
function getPackageVendorCost(p) {
  return (p.vendorHotelCost || 0) +
         (p.vendorTransportCost || 0) +
         (p.vendorVisaCost || 0) +
         (p.vendorServiceCost || 0) +
         (p.vendorZiyarahCost || 0);
}

/* ⭐ Helper: Vendor paid total from payments */
function getVendorPaidTotal(vendorId) {
  const v = STORE.vendors.find(x => String(x.id) === String(vendorId));
  if (!v) return 0;
  return (v.payments || []).reduce((s, pm) => s + Number(pm.amount || 0), 0);
}

/* ⭐ Helper: Vendor bill from all Packages (Fixed for all statuses) */
function getVendorBillTotal(vendorId) {
  let total = 0;
  STORE.packages.forEach(pkg => {
    const packageBills = getPackageVendorBillMap(pkg);
    total += Number(packageBills[String(vendorId)] || 0);
  });

  return total;
}

/* ==================== MAIN RENDER ==================== */
function renderReports() {
  const from = document.getElementById('repDateFrom')?.value;
  const to = document.getElementById('repDateTo')?.value;

  let pkgs = STORE.packages.filter(p => p.status === 'Paid');
  if (from) pkgs = pkgs.filter(p => (p.checkIn || p.start || '') >= from);
  if (to) pkgs = pkgs.filter(p => (p.checkIn || p.start || '') <= to);

  const revenue = pkgs.reduce((s, p) => s + (p.grandTotal || 0), 0);

  /* ⭐ Dynamic vendor cost (Flight excluded) */
  const vCost = pkgs.reduce((s, p) => s + getPackageVendorCost(p), 0);

  /* ⭐ Net profit = revenue - vendor cost - VAT - service fee + flight profit already in margin */
  const vatTotal = pkgs.reduce((s, p) => s + (p.vatAmount || 0), 0);
  const serviceFeeTotal = pkgs.reduce((s, p) => s + (p.serviceFeeAmount || 0), 0);
  const profit = revenue - vCost - vatTotal - serviceFeeTotal;
  const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : 0;

  let el = document.getElementById('repTotalPkg');
  if (el) el.textContent = pkgs.length;

  el = document.getElementById('repRevenue');
  if (el) el.textContent = fmt(revenue);

  el = document.getElementById('repVendorCost');
  if (el) el.textContent = fmt(vCost);

  el = document.getElementById('repProfit');
  if (el) el.textContent = fmt(profit);

  el = document.getElementById('repMargin');
  if (el) el.textContent = 'Margin: ' + margin + '%';

  /* ==================== Monthly Revenue Chart ==================== */
  const canvas = document.getElementById('reportRevChart');
  if (canvas) {
    if (reportChart) reportChart.destroy();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const revData = new Array(12).fill(0);
    pkgs.forEach(p => {
      const d = new Date(p.createdAt || 0);
      revData[d.getMonth()] += (p.grandTotal || 0);
    });

    const isDark = document.body.classList.contains('dark');
    reportChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          data: revData,
          backgroundColor: 'rgba(99,102,241,.85)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: isDark ? '#71717a' : '#a1a1aa' },
            border: { display: false }
          },
          y: {
            grid: { color: isDark ? '#27272a' : '#f0f0f2' },
            ticks: { color: isDark ? '#71717a' : '#a1a1aa' },
            border: { display: false },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ==================== Package Type Donut ==================== */
  const typeCanvas = document.getElementById('reportTypeChart');
  if (typeCanvas) {
    if (reportTypeChart) reportTypeChart.destroy();
    const types = { Economy: 0, Standard: 0, Premium: 0, Ramadan: 0 };
    pkgs.forEach(p => {
      const t = p.type || 'Standard';
      if (types[t] !== undefined) types[t]++;
    });

    reportTypeChart = new Chart(typeCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Standard', 'Economy', 'Premium', 'Ramadan'],
        datasets: [{
          data: [types.Standard, types.Economy, types.Premium, types.Ramadan],
          backgroundColor: ['#f97316', '#3b82f6', '#a855f7', '#22c55e'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '72%',
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: false
      }
    });

    const leg = document.getElementById('reportTypeLegend');
    if (leg) {
      leg.innerHTML =
        '<div class="an-legend-row"><span class="name"><span class="an-legend-dot" style="background:#f97316"></span>Standard</span><span class="val">' + types.Standard + '</span></div>' +
        '<div class="an-legend-row"><span class="name"><span class="an-legend-dot" style="background:#3b82f6"></span>Economy</span><span class="val">' + types.Economy + '</span></div>' +
        '<div class="an-legend-row"><span class="name"><span class="an-legend-dot" style="background:#a855f7"></span>Premium</span><span class="val">' + types.Premium + '</span></div>' +
        '<div class="an-legend-row"><span class="name"><span class="an-legend-dot" style="background:#22c55e"></span>Ramadan</span><span class="val">' + types.Ramadan + '</span></div>';
    }
  }

  /* ==================== Status Breakdown ==================== */
  const statusCounts = {};
  pkgs.forEach(p => {
    const s = p.status || 'Draft';
    if (!statusCounts[s]) statusCounts[s] = { count: 0, total: 0 };
    statusCounts[s].count++;
    statusCounts[s].total += (p.grandTotal || 0);
  });

  const sl = document.getElementById('reportStatusList');
  if (sl) {
    const entries = Object.entries(statusCounts);
    sl.innerHTML = entries.length
      ? entries.map(e => `<div class="an-list-row"><span class="name">${esc(e[0])} (${e[1].count})</span><span class="val">${fmt(e[1].total)}</span></div>`).join('')
      : '<div style="text-align:center;color:var(--text-3);padding:16px;font-size:12px">No data</div>';
  }

  /* ==================== Top 5 Customers ==================== */
  const custTotals = {};
  pkgs.forEach(p => {
    const n = p.customerName || 'Unknown';
    custTotals[n] = (custTotals[n] || 0) + (p.grandTotal || 0);
  });
  const top = Object.entries(custTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

  const tc = document.getElementById('reportTopCustomers');
  if (tc) {
    tc.innerHTML = top.length
      ? top.map((c, i) => `<div class="an-list-row"><span class="name">${medals[i]} ${esc(c[0])}</span><span class="val">${fmt(c[1])}</span></div>`).join('')
      : '<div style="text-align:center;color:var(--text-3);padding:16px;font-size:12px">No data</div>';
  }

  /* ==================== ⭐ Vendor Payment Summary — Full Dynamic ==================== */
  const vt = document.getElementById('reportVendorTable');
  if (vt) {
    const rows = STORE.vendors.map(v => {
      const paid = getVendorPaidTotal(v.id);
      const totalCost = getVendorBillTotal(v.id);
      const due = Math.max(0, totalCost - paid);
      const itemLedger = getVendorItemLedger(v.id);
      return { v, paid, totalCost, due, itemLedger };
    }).filter(r => r.totalCost > 0 || r.paid > 0);

    if (!rows.length) {
      vt.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">No vendors with activity</td></tr>';
    } else {
      const typeIcons = { hotel: '🕌', transport: '▣', visa: '▤', ziyarah: '★', service: '▦', other: '📦' };
      const pill = { hotel: 'confirmed', visa: 'quoted', transport: 'completed', ziyarah: 'follow-up', service: 'draft' };

      let rowsHtml = rows.map(r => {
        const statusBadge = r.due === 0 && r.totalCost > 0
          ? '<span class="status-badge active">✓ Clear</span>'
          : (r.due > 0 ? '<span class="status-badge warning">⏰ Pending</span>' : '');
        const itemRows = r.itemLedger.map(item => `
          <tr style="background:var(--bg-2);font-size:11.5px">
            <td colspan="2" style="padding-left:24px;color:var(--text-2)">↳ ${esc(item.packageName)} · ${esc(item.category.toUpperCase())} · ${esc(item.itemName)}</td>
            <td>${fmt(item.cost)}</td>
            <td style="color:var(--green)">${fmt(item.paid)}</td>
            <td style="color:${item.due < 0 ? 'var(--blue)' : item.due > 0 ? 'var(--red)' : 'var(--green)'}">${getVendorItemDueText(item)}</td>
            <td></td>
          </tr>
        `).join('');

        return `<tr style="cursor:pointer" onclick="openVendorLedger(${r.v.id})">
          <td>
            <div class="cell-main" style="color:var(--primary);font-weight:800">${typeIcons[r.v.type] || '🏢'} ${esc(r.v.name)}</div>
            <div class="cell-sub">${esc(r.v.type || '').toUpperCase()}</div>
          </td>
          <td><span class="pill ${pill[r.v.type] || 'draft'}">${esc(r.v.type || '').toUpperCase()}</span></td>
          <td style="font-weight:700">${fmt(r.totalCost)}</td>
          <td style="color:var(--green);font-weight:700">${fmt(r.paid)}</td>
          <td style="color:${r.due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700">${fmt(r.due)}</td>
          <td>${statusBadge}</td>
        </tr>${itemRows}`;
      }).join('');

      /* Total row */
      const totalCostSum = rows.reduce((s, r) => s + r.totalCost, 0);
      const totalPaidSum = rows.reduce((s, r) => s + r.paid, 0);
      const totalDueSum = rows.reduce((s, r) => s + r.due, 0);

      vt.innerHTML = rowsHtml + `
        <tr style="background:var(--bg-2);font-weight:900">
          <td colspan="2" style="text-align:right;color:var(--text-2)">TOTAL</td>
          <td>${fmt(totalCostSum)}</td>
          <td style="color:var(--green)">${fmt(totalPaidSum)}</td>
          <td style="color:var(--red)">${fmt(totalDueSum)}</td>
          <td></td>
        </tr>
      `;
    }
  }
}