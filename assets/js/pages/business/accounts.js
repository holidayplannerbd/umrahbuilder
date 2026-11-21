/* ============================================================
   UMRAH BUILDER — ACCOUNTS (v6 — Final + Logo Guaranteed)
   ============================================================ */

/* ==================== LOAD / SAVE REFUNDS ==================== */
async function loadRefunds() {
  try {
    const raw = await dbGetSetting('refunds');
    refundsCache = Array.isArray(raw) ? raw : [];
  } catch (e) {
    refundsCache = [];
  }
  return refundsCache;
}

async function saveRefunds() {
  await dbSaveSetting('refunds', refundsCache);
}

/* ⭐ Helper: Dynamic vendor cost */
function getPackageVendorCost(p) {
  return (p.vendorHotelCost || 0) +
         (p.vendorFlightCost || 0) +
         (p.vendorTransportCost || 0) +
         (p.vendorServiceCost || 0) +
         (p.vendorZiyarahCost || 0) +
         (p.vendorVisaCost || 0);
}

/* ==================== CALC ACCOUNTS TOTALS ==================== */
function calcAccountsTotals() {
  const packages = STORE.packages || [];
  const activePackages = packages.filter(p => p.status === 'Paid');

  let totalSale = 0;
  activePackages.forEach(p => { totalSale += Number(p.grandTotal || 0); });

  let vendorBill = 0;
  const totalVendorCost = activePackages.reduce((sum, p) => sum + getPackageVendorCost(p), 0);
  packages.forEach(p => {
    const packageBills = getPackageVendorBillMap(p);
    Object.values(packageBills).forEach(amount => {
      vendorBill += Number(amount || 0);
    });
  });

  let customerPaid = 0;
  STORE.customers.forEach(c => {
    (c.payments || []).forEach(pm => {
      customerPaid += Math.max(0, Number(pm.amount || 0));
    });
  });
  activePackages.forEach(p => {
    const adv = getPackageAdvance(p);
    if (adv <= 0) return;
    let recorded = false;
    STORE.customers.forEach(c => {
      if (recorded) return;
      (c.payments || []).forEach(pm => {
        if (pm.packageId === p.id && pm.isAdvance) recorded = true;
      });
    });
    if (!recorded) customerPaid += adv;
  });

  let vendorPaid = 0;
  STORE.vendors.forEach(v => {
    (v.payments || []).forEach(pm => {
      vendorPaid += Math.max(0, Number(pm.amount || 0));
    });
  });

  let totalRefund = 0;
  refundsCache.forEach(r => {
    totalRefund += Math.max(0, Number(r.amount || 0));
  });

  const customerDue = Math.max(0, totalSale - customerPaid);
  const vendorDue = Math.max(0, vendorBill - vendorPaid);
  const cashInHand = customerPaid - vendorPaid - totalRefund;
  const netProfit = totalSale - totalVendorCost - totalRefund;
  const profitMargin = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;

  return {
    totalSale, customerPaid, customerDue,
    vendorBill, vendorPaid, vendorDue,
    totalRefund, cashInHand, netProfit, profitMargin
  };
}

/* ==================== RENDER ACCOUNTS ==================== */
async function renderAccounts() {
  await loadRefunds();

  const t = calcAccountsTotals();

  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  set('accTotalSale', fmt(t.totalSale));
  set('accCustomerPaid', fmt(t.customerPaid));
  set('accCustomerDue', fmt(t.customerDue));
  set('accVendorPaid', fmt(t.vendorPaid));
  set('accVendorDue', fmt(t.vendorDue));
  set('accTotalRefund', fmt(t.totalRefund));
  set('accCashInHand', fmt(t.cashInHand));
  set('accNetProfit', fmt(t.netProfit));
  set('accProfitMargin', t.profitMargin.toFixed(1) + '%');

  renderAccountsCustomerDue();
  renderAccountsVendorDue();
  renderAccountsRefundHistory();
}

/* ==================== CUSTOMER DUE ==================== */
function renderAccountsCustomerDue() {
  const tbody = document.getElementById('accCustomerDueTable');
  if (!tbody) return;

  const map = {};
  STORE.packages.forEach(p => {
    if (p.status !== 'Paid') return;
    const key = p.customerId || p.customerPhone || p.customerName || ('anon-' + p.id);
    if (!map[key]) {
      map[key] = {
        customerId: p.customerId,
        customerName: p.customerName || 'Unknown',
        customerPhone: p.customerPhone || '',
        packages: []
      };
    }
    map[key].packages.push(p);
  });

  const rows = [];
  Object.values(map).forEach(c => {
    let bill = 0, paid = 0;
    c.packages.forEach(p => { bill += Number(p.grandTotal || 0); });

    STORE.customers.forEach(cu => {
      const match = (c.customerId && cu.id === c.customerId) ||
                    (c.customerPhone && cu.phone === c.customerPhone);
      if (!match) return;
      (cu.payments || []).forEach(pm => {
        paid += Math.max(0, Number(pm.amount || 0));
      });
    });

    c.packages.forEach(p => {
      const adv = getPackageAdvance(p);
      if (adv <= 0) return;
      let recorded = false;
      STORE.customers.forEach(cu => {
        if (recorded) return;
        (cu.payments || []).forEach(pm => {
          if (pm.packageId === p.id && pm.isAdvance) recorded = true;
        });
      });
      if (!recorded) paid += adv;
    });

    const due = Math.max(0, bill - paid);
    if (bill > 0) {
      rows.push({
        customerId: c.customerId,
        customerName: c.customerName,
        customerPhone: c.customerPhone,
        bill, paid, due,
        pkgCount: c.packages.length
      });
    }
  });

  rows.sort((a, b) => b.due - a.due);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">No active packages yet</td></tr>';
    return;
  }

  let totalBill = 0, totalPaid = 0, totalDue = 0;
  rows.forEach(r => { totalBill += r.bill; totalPaid += r.paid; totalDue += r.due; });

  tbody.innerHTML = rows.map(r => `
    <tr style="cursor:pointer" onclick="openCustomerLedger(${r.customerId || 'null'}, '${esc(r.customerPhone)}')">
      <td>
        <div class="cell-main" style="color:var(--primary);font-weight:800">${esc(r.customerName)}</div>
        ${r.customerPhone ? `<div class="cell-sub">📞 ${esc(r.customerPhone)}</div>` : ''}
      </td>
      <td><span class="pill quoted">${r.pkgCount} pkg</span></td>
      <td style="font-weight:700">${fmt(r.bill)}</td>
      <td style="color:var(--green);font-weight:700">${fmt(r.paid)}</td>
      <td style="color:${r.due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:800">${fmt(r.due)}</td>
      <td>
        ${r.due > 0
          ? `<span class="status-badge warning">⏳ Due</span>`
          : `<span class="status-badge active">✓ Clear</span>`}
      </td>
    </tr>
  `).join('') + `
    <tr style="background:var(--bg-2);font-weight:900">
      <td colspan="2" style="text-align:right;color:var(--text-2)">TOTAL</td>
      <td>${fmt(totalBill)}</td>
      <td style="color:var(--green)">${fmt(totalPaid)}</td>
      <td style="color:var(--red)">${fmt(totalDue)}</td>
      <td></td>
    </tr>
  `;
}

/* ==================== VENDOR DUE (Dynamic) ==================== */
function renderAccountsVendorDue() {
  const tbody = document.getElementById('accVendorDueTable');
  if (!tbody) return;

  const vendorBillMap = {};
  const packages = STORE.packages || [];

  packages.forEach(p => {
    const packageBills = getPackageVendorBillMap(p);
    Object.entries(packageBills).forEach(([vendorId, amount]) => {
      vendorBillMap[vendorId] = (vendorBillMap[vendorId] || 0) + Number(amount || 0);
    });
  });

  const rows = [];
  STORE.vendors.forEach(v => {
    let paid = 0;
    (v.payments || []).forEach(pm => { paid += Number(pm.amount || 0); });
    const bill = vendorBillMap[String(v.id)] || 0;
    const due = Math.max(0, bill - paid);
    if (bill > 0 || paid > 0) {
      rows.push({
        vendorId: v.id,
        vendorName: v.name,
        vendorType: v.type || 'other',
        bill, paid, due
      });
    }
  });

  rows.sort((a, b) => b.due - a.due);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-3)">No vendor bills yet</td></tr>';
    return;
  }

  const typeIcons = { hotel: '🕌', transport: '▣', visa: '▤', ziyarah: '★', service: '▦', other: '📦' };

  let totalBill = 0, totalPaid = 0, totalDue = 0;
  rows.forEach(r => { totalBill += r.bill; totalPaid += r.paid; totalDue += r.due; });

  tbody.innerHTML = rows.map(r => `
    <tr style="cursor:pointer" onclick="openVendorLedger(${r.vendorId})">
      <td>
        <div class="cell-main" style="color:var(--primary);font-weight:800">${typeIcons[r.vendorType] || '🏢'} ${esc(r.vendorName)}</div>
        <div class="cell-sub">${esc(r.vendorType || '').toUpperCase()}</div>
      </td>
      <td style="font-weight:700">${fmt(r.bill)}</td>
      <td style="color:var(--green);font-weight:700">${fmt(r.paid)}</td>
      <td style="color:${r.due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:800">${fmt(r.due)}</td>
      <td>
        ${r.due > 0
          ? `<span class="status-badge warning">⏳ Pending</span>`
          : `<span class="status-badge active">✓ Clear</span>`}
      </td>
    </tr>
  `).join('') + `
    <tr style="background:var(--bg-2);font-weight:900">
      <td style="text-align:right;color:var(--text-2)">TOTAL</td>
      <td>${fmt(totalBill)}</td>
      <td style="color:var(--green)">${fmt(totalPaid)}</td>
      <td style="color:var(--red)">${fmt(totalDue)}</td>
      <td></td>
    </tr>
  `;
}

/* ==================== REFUND HISTORY ==================== */
function renderAccountsRefundHistory() {
  const tbody = document.getElementById('accRefundTable');
  if (!tbody) return;

  const list = refundsCache.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">No refunds yet</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr style="cursor:pointer" onclick="openRefundDetails('${r.id}')">
      <td><div class="cell-main" style="color:var(--primary);font-weight:800">${esc(r.customerName)}</div></td>
      <td>${esc(r.packageName || '—')}</td>
      <td style="color:var(--red);font-weight:800">- ${fmt(r.amount)}</td>
      <td>${esc(r.date || '—')}</td>
      <td><span class="pill cancelled">${esc(r.reason || 'Refund')}</span></td>
      <td>
        <button class="btn btn-sm btn-ghost btn-icon" onclick="event.stopPropagation();deleteRefund('${r.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

/* ==================== OPEN REFUND MODAL ==================== */
function openRefundModal(preselectedCustomerId = null, preselectedPackageId = null) {
  const customers = STORE.customers.slice();
  const packages = STORE.packages.filter(p => p.status !== 'Cancelled');

  const custOpts = customers.map(c =>
    `<option value="${c.id}" ${preselectedCustomerId === c.id ? 'selected' : ''}>${esc(c.customerName)} · ${esc(c.phone || '')}</option>`
  ).join('');

  const pkgOpts = packages.map(p =>
    `<option value="${p.id}" ${preselectedPackageId === p.id ? 'selected' : ''}>${esc(p.name || 'Untitled')} · ${esc(p.refNo || '')} · ${fmt(p.grandTotal)}</option>`
  ).join('');

  const html = `
    <div class="modal-bg act" id="refundModal">
      <div class="modal narrow">
        <div class="modal-head">
          <h2>♻️ Add Refund</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="field" style="grid-column:1/-1">
              <label>Customer *</label>
              <select id="refundCustomer" onchange="updateRefundSummary()">
                <option value="">-- Choose Customer --</option>${custOpts}
              </select>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Package (optional)</label>
              <select id="refundPackage" onchange="updateRefundSummary()">
                <option value="">-- No specific package --</option>${pkgOpts}
              </select>
            </div>
            <div class="field">
              <label>Amount (৳) *</label>
              <input type="number" id="refundAmount" min="0" oninput="updateRefundSummary()">
            </div>
            <div class="field">
              <label>Date</label>
              <input type="date" id="refundDate">
            </div>
            <div class="field">
              <label>Method</label>
              <select id="refundMethod">
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>bKash</option>
                <option>Nagad</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
            <div class="field">
              <label>Reason</label>
              <select id="refundReason">
                <option value="Cancellation">Package Cancellation</option>
                <option value="Overpayment">Overpayment</option>
                <option value="Service Not Provided">Service Not Provided</option>
                <option value="Partial Refund">Partial Refund</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Notes</label>
              <input type="text" id="refundNotes">
            </div>
          </div>
          <div style="margin-top:14px;padding:14px;background:linear-gradient(135deg,var(--red-bg),var(--card));border-radius:10px;border-left:3px solid var(--red);font-size:12.5px;line-height:2">
            <div>💡 <b>Package Bill:</b> <span id="refundPkgBill" style="font-weight:800">৳0</span></div>
            <div>✅ <b>Customer Paid:</b> <span id="refundCustPaid" style="color:var(--green);font-weight:800">৳0</span></div>
            <div>♻️ <b>Suggested Refund:</b> <span id="refundMax" style="color:var(--red);font-weight:800">৳0</span></div>
          </div>
        </div>
        <div class="modal-foot">
          <div></div>
          <div class="right-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Cancel</button>
            <button class="btn btn-danger" onclick="saveRefund()">♻️ Save Refund</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
  if ($('refundDate')) $('refundDate').value = today();
  updateRefundSummary();
}

function updateRefundSummary() {
  const custId = parseInt(document.getElementById('refundCustomer')?.value || 0);
  const pkgId = parseInt(document.getElementById('refundPackage')?.value || 0);

  let pkgBill = 0, custPaid = 0;

  if (pkgId) {
    const p = STORE.packages.find(x => x.id === pkgId);
    if (p) pkgBill = Number(p.grandTotal || 0);
  }

  if (custId) {
    const c = STORE.customers.find(x => x.id === custId);
    if (c) {
      (c.payments || []).forEach(pm => { custPaid += Math.max(0, Number(pm.amount || 0)); });
      STORE.packages.forEach(p => {
        if (p.customerId !== c.id && p.customerPhone !== c.phone) return;
        const adv = getPackageAdvance(p);
        if (adv <= 0) return;
        let recorded = false;
        (c.payments || []).forEach(pm => {
          if (pm.packageId === p.id && pm.isAdvance) recorded = true;
        });
        if (!recorded) custPaid += adv;
      });
    }
  }

  const el1 = document.getElementById('refundPkgBill');
  const el2 = document.getElementById('refundCustPaid');
  const el3 = document.getElementById('refundMax');
  if (el1) el1.textContent = fmt(pkgBill);
  if (el2) el2.textContent = fmt(custPaid);
  if (el3) el3.textContent = fmt(custPaid);
}

async function saveRefund() {
  const custId = parseInt(document.getElementById('refundCustomer')?.value || 0);
  const pkgId = parseInt(document.getElementById('refundPackage')?.value || 0);
  const amount = parseFloat(document.getElementById('refundAmount')?.value) || 0;
  const date = document.getElementById('refundDate')?.value || today();
  const method = document.getElementById('refundMethod')?.value || 'Cash';
  const reason = document.getElementById('refundReason')?.value || 'Cancellation';
  const notes = document.getElementById('refundNotes')?.value || '';

  if (!custId) { toast('Customer select করুন', 'error'); return; }
  if (amount <= 0) { toast('Amount দিন', 'error'); return; }

  const customer = STORE.customers.find(x => x.id === custId);
  const pkg = pkgId ? STORE.packages.find(x => x.id === pkgId) : null;

  showLoading('Saving refund...');
  try {
    const refund = {
      id: 'ref_' + Date.now(),
      customerId: custId,
      customerName: customer?.customerName || 'Unknown',
      packageId: pkgId || null,
      packageName: pkg?.name || '',
      refNo: pkg?.refNo || '',
      amount, date, method, reason, notes,
      createdAt: Date.now()
    };

    refundsCache.push(refund);
    await saveRefunds();

    if (pkg) {
      pkg.status = 'Cancelled';
      pkg.refunded = true;
      pkg.refundAmount = (pkg.refundAmount || 0) + amount;
      pkg.updatedAt = Date.now();
      await dbSave(STORES.packages, pkg);
      STORE.packages = await dbGetAll(STORES.packages);
    }

    hideLoading();
    document.getElementById('refundModal')?.remove();
    renderAccounts();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderPackages === 'function') renderPackages();

    if (typeof addNotification === 'function') {
      addNotification({
        type: 'refund_given',
        icon: '♻️',
        message: `♻️ Refund: <b>৳${amount.toLocaleString()}</b> to ${esc(customer?.customerName || 'customer')}`,
        link: 'accounts'
      });
    }
    toast('✅ Refund saved');
  } catch (e) {
    hideLoading();
    toast('Failed: ' + e.message, 'error');
  }
}

async function deleteRefund(id) {
  confirmDelete('Delete this refund entry?', async () => {
    refundsCache = refundsCache.filter(r => r.id !== id);
    await saveRefunds();
    renderAccounts();
    toast('Refund deleted', 'warning');
  });
}

/* ==================== CUSTOMER LEDGER ==================== */
function openCustomerLedger(customerId, customerPhone) {
  let customer = null;
  if (customerId) customer = STORE.customers.find(c => c.id === customerId);
  if (!customer && customerPhone) customer = STORE.customers.find(c => c.phone === customerPhone);

  if (!customer) {
    toast('Customer not found', 'error');
    return;
  }

  const pkgs = STORE.packages.filter(p =>
    (p.customerId && p.customerId === customer.id) ||
    (p.customerPhone && customer.phone && p.customerPhone === customer.phone)
  );

  const activePkgs = pkgs.filter(p => p.status !== 'Cancelled');

  let totalBill = 0, totalPaid = 0;
  activePkgs.forEach(p => { totalBill += Number(p.grandTotal || 0); });

  (customer.payments || []).forEach(pm => {
    totalPaid += Math.max(0, Number(pm.amount || 0));
  });

  activePkgs.forEach(p => {
    const adv = getPackageAdvance(p);
    if (adv <= 0) return;
    let recorded = false;
    (customer.payments || []).forEach(pm => {
      if (pm.packageId === p.id && pm.isAdvance) recorded = true;
    });
    if (!recorded) totalPaid += adv;
  });

  const totalDue = Math.max(0, totalBill - totalPaid);

  const customerRefunds = refundsCache.filter(r => r.customerId === customer.id);
  const totalRefund = customerRefunds.reduce((s, r) => s + Number(r.amount || 0), 0);

  const allPayments = [];
  (customer.payments || []).forEach(pm => {
    allPayments.push({
      type: 'payment',
      date: pm.date || '',
      amount: Number(pm.amount || 0),
      method: pm.method || 'Cash',
      reference: pm.reference || '',
      packageId: pm.packageId || null
    });
  });

  activePkgs.forEach(p => {
    const adv = getPackageAdvance(p);
    if (adv <= 0) return;
    let recorded = false;
    (customer.payments || []).forEach(pm => {
      if (pm.packageId === p.id && pm.isAdvance) recorded = true;
    });
    if (!recorded) {
      allPayments.push({
        type: 'advance',
        date: p.checkIn || p.start || today(),
        amount: adv,
        method: 'Advance',
        reference: p.refNo || '',
        packageId: p.id
      });
    }
  });

  customerRefunds.forEach(r => {
    allPayments.push({
      type: 'refund',
      date: r.date || '',
      amount: -Number(r.amount || 0),
      method: r.method || 'Cash',
      reference: r.reason || 'Refund',
      packageId: r.packageId || null
    });
  });

  allPayments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const paymentListHtml = allPayments.length
    ? allPayments.map(pm => {
        const isRefund = pm.type === 'refund';
        const isAdvance = pm.type === 'advance';
        const icon = isRefund ? '♻️' : (isAdvance ? '💰' : '🟢');
        const color = isRefund ? 'var(--red)' : 'var(--green)';
        const sign = isRefund ? '' : '+ ';
        const bg = isRefund ? 'var(--red-bg)' : 'var(--green-bg)';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:${bg};border-radius:10px;margin-bottom:6px;font-size:12.5px">
            <div>
              <div style="font-weight:700">${icon} ${esc(pm.method)}${pm.reference ? ' · ' + esc(pm.reference) : ''}</div>
              <div style="font-size:10.5px;color:var(--text-3)">${esc(pm.date || '—')}${isAdvance ? ' · Advance' : ''}</div>
            </div>
            <div style="font-weight:800;color:${color};font-size:14px">${sign}${fmt(Math.abs(pm.amount))}</div>
          </div>
        `;
      }).join('')
    : '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px">No transactions yet</div>';

  const pkgListHtml = pkgs.length
    ? pkgs.map(p => {
        const cls = (p.status || 'draft').toLowerCase().replace(/\s+/g, '-');
        return `
          <div style="padding:10px 14px;background:var(--bg-2);border-radius:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:12.5px" onclick="closeModal('customerLedgerModal');setTimeout(()=>viewPackage(${p.id}),200)">
            <div>
              <div style="font-weight:700">📦 ${esc(p.name || 'Untitled')}</div>
              <div style="font-size:10.5px;color:var(--text-3)">${esc(p.refNo || '')} · ${esc(p.checkIn || p.start || '—')}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:800;color:var(--primary)">${fmt(p.grandTotal)}</div>
              <span class="pill ${cls}" style="font-size:9px">${esc(p.status || 'Draft')}</span>
            </div>
          </div>
        `;
      }).join('')
    : '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px">No packages</div>';

  const html = `
    <div class="modal-bg act" id="customerLedgerModal">
      <div class="modal wide">
        <div class="modal-head">
          <h2>👤 ${esc(customer.customerName)} — Ledger</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px">
            <div style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid var(--blue);text-align:center">
              <div style="font-size:10px;color:var(--blue);text-transform:uppercase;font-weight:800;margin-bottom:4px">Total Bill</div>
              <div style="font-size:18px;font-weight:900;color:var(--blue)">${fmt(totalBill)}</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:var(--green-bg);border:1px solid var(--green);text-align:center">
              <div style="font-size:10px;color:var(--green);text-transform:uppercase;font-weight:800;margin-bottom:4px">Total Paid</div>
              <div style="font-size:18px;font-weight:900;color:var(--green)">${fmt(totalPaid)}</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:${totalDue > 0 ? 'var(--red-bg)' : 'var(--green-bg)'};border:1px solid ${totalDue > 0 ? 'var(--red)' : 'var(--green)'};text-align:center">
              <div style="font-size:10px;color:${totalDue > 0 ? 'var(--red)' : 'var(--green)'};text-transform:uppercase;font-weight:800;margin-bottom:4px">Due</div>
              <div style="font-size:18px;font-weight:900;color:${totalDue > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(totalDue)}</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:var(--amber-bg);border:1px solid var(--amber);text-align:center">
              <div style="font-size:10px;color:var(--amber);text-transform:uppercase;font-weight:800;margin-bottom:4px">Refunded</div>
              <div style="font-size:18px;font-weight:900;color:var(--amber)">${fmt(totalRefund)}</div>
            </div>
          </div>

          <div style="padding:14px;background:var(--bg-2);border-radius:12px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px">
            ${customer.phone ? `<div><b>📞 Phone:</b> ${esc(customer.phone)}</div>` : ''}
            ${customer.email ? `<div><b>✉️ Email:</b> ${esc(customer.email)}</div>` : ''}
            ${customer.passport ? `<div><b>📄 Passport:</b> ${esc(customer.passport)}</div>` : ''}
            ${customer.nationality ? `<div><b>🌍 Nationality:</b> ${esc(customer.nationality)}</div>` : ''}
          </div>

          <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin-bottom:10px">📦 Packages (${pkgs.length})</h4>
          <div style="margin-bottom:20px">${pkgListHtml}</div>

          <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin-bottom:10px">📜 Transaction History (${allPayments.length})</h4>
          <div>${paymentListHtml}</div>

        </div>
        <div class="modal-foot">
          <div class="left-actions">
            ${totalDue > 0 && customer.phone ? `<button class="btn btn-green btn-sm" onclick="sendWhatsAppReminder('${esc(customer.phone)}','${esc(customer.customerName)}',${totalDue})">📱 WhatsApp Reminder</button>` : ''}
          </div>
          <div class="right-actions">
            <button class="btn btn-primary btn-sm" onclick="closeModal('customerLedgerModal');setTimeout(()=>openPaymentModal('customer', ${customer.id}),200)">💰 Add Payment</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ==================== VENDOR LEDGER ==================== */
function openVendorLedger(vendorId) {
  const vendor = STORE.vendors.find(v => v.id === vendorId);
  if (!vendor) {
    toast('Vendor not found', 'error');
    return;
  }

  const allPayments = [];
  let totalPaid = 0;
  (vendor.payments || []).forEach(pm => {
    const amt = Number(pm.amount || 0);
    totalPaid += amt;
    allPayments.push({
      date: pm.date || '',
      amount: amt,
      method: pm.method || 'Cash',
      reference: pm.reference || '',
      packageId: pm.packageId || null,
      category: pm.category || '',
      allocationName: pm.allocationName || '',
      itemName: pm.itemName || ''
    });
  });
  allPayments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const itemLedgerRows = getVendorItemLedger(vendorId);
  const totalBill = itemLedgerRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);

  const totalDue = Math.max(0, totalBill - totalPaid);
  const typeIcons = { hotel: '🕌', transport: '▣', visa: '▤', ziyarah: '★', service: '▦', other: '📦' };

  const paymentListHtml = allPayments.length
    ? allPayments.map(pm => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--red-bg);border-radius:10px;margin-bottom:6px;font-size:12.5px">
          <div>
            <div style="font-weight:700">💸 ${esc(pm.method)}${pm.reference ? ' · ' + esc(pm.reference) : ''}</div>
            <div style="font-size:10.5px;color:var(--text-3)">${esc(pm.date || '—')}${pm.category ? ' · ' + esc(pm.category) : ''}${pm.allocationName ? ' · ' + esc(pm.allocationName) : ''}</div>
            ${pm.itemName ? `<div style="font-size:11px;color:var(--blue);margin-top:2px">📦 ${esc(pm.itemName)}</div>` : ''}
          </div>
          <div style="font-weight:800;color:var(--red);font-size:14px">- ${fmt(pm.amount)}</div>
        </div>
      `).join('')
    : '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px">No payments yet</div>';

    const itemLedgerHtml = itemLedgerRows.length ? `
      <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin:4px 0 10px">📊 Item-wise Bill / Paid / Due</h4>
      <div class="table-wrap" style="margin-bottom:20px"><table>
        <thead><tr><th>Package</th><th>Category / Item</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
        <tbody>${itemLedgerRows.map(row => `
          <tr>
            <td><div class="cell-main">${esc(row.packageName)}</div><div class="cell-sub">${esc(row.refNo)}</div></td>
            <td><div class="cell-main">${esc(row.category.toUpperCase())}</div><div class="cell-sub">${esc(row.itemName)}</div></td>
            <td>${fmt(row.cost)}</td>
            <td style="color:var(--green);font-weight:700">${fmt(row.paid)}</td>
            <td style="color:${row.due < 0 ? 'var(--blue)' : row.due > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700">${getVendorItemDueText(row)}</td>
          </tr>
        `).join('')}</tbody>
      </table></div>
    ` : '<div style="padding:8px 0 16px;color:var(--text-3);font-size:12px">No item-linked vendor bills yet</div>';

  const itemsHtml = (vendor.items || vendor.hotels || []).length
    ? (vendor.items || vendor.hotels).map(it => `
        <div style="padding:10px 14px;background:var(--bg-2);border-radius:10px;margin-bottom:6px;font-size:12px">
          <div style="font-weight:700">${esc(it.name || it.from || 'Item')}</div>
          ${it.city ? `<div style="font-size:10.5px;color:var(--text-3)">${esc(it.city)}${it.star ? ' · ' + it.star + '⭐' : ''}</div>` : ''}
        </div>
      `).join('')
    : '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px">No items</div>';

  const html = `
    <div class="modal-bg act" id="vendorLedgerModal">
      <div class="modal wide">
        <div class="modal-head">
          <h2>🏢 ${esc(vendor.name)} — Ledger</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
            <div style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid var(--blue);text-align:center">
              <div style="font-size:10px;color:var(--blue);text-transform:uppercase;font-weight:800;margin-bottom:4px">Total Bill</div>
              <div style="font-size:20px;font-weight:900;color:var(--blue)">${fmt(totalBill)}</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:var(--green-bg);border:1px solid var(--green);text-align:center">
              <div style="font-size:10px;color:var(--green);text-transform:uppercase;font-weight:800;margin-bottom:4px">Total Paid</div>
              <div style="font-size:20px;font-weight:900;color:var(--green)">${fmt(totalPaid)}</div>
            </div>
            <div style="padding:14px;border-radius:12px;background:${totalDue > 0 ? 'var(--amber-bg)' : 'var(--green-bg)'};border:1px solid ${totalDue > 0 ? 'var(--amber)' : 'var(--green)'};text-align:center">
              <div style="font-size:10px;color:${totalDue > 0 ? 'var(--amber)' : 'var(--green)'};text-transform:uppercase;font-weight:800;margin-bottom:4px">Due</div>
              <div style="font-size:20px;font-weight:900;color:${totalDue > 0 ? 'var(--amber)' : 'var(--green)'}">${fmt(totalDue)}</div>
            </div>
          </div>

          <div style="padding:14px;background:var(--bg-2);border-radius:12px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px">
            <div><b>Type:</b> ${typeIcons[vendor.type] || '🏢'} ${esc(vendor.type || 'other').toUpperCase()}</div>
            ${vendor.phone ? `<div><b>📞 Phone:</b> ${esc(vendor.phone)}</div>` : ''}
            ${vendor.email ? `<div><b>✉️ Email:</b> ${esc(vendor.email)}</div>` : ''}
            ${vendor.contact ? `<div><b>👤 Contact:</b> ${esc(vendor.contact)}</div>` : ''}
          </div>

          ${itemLedgerHtml}
          <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin-bottom:10px">💸 Payment History (${allPayments.length})</h4>
          <div style="margin-bottom:20px">${paymentListHtml}</div>

          <h4 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin-bottom:10px">📋 Items / Rates</h4>
          <div>${itemsHtml}</div>

        </div>
        <div class="modal-foot">
          <div class="left-actions">
            <button class="btn btn-secondary btn-sm" onclick="closeModal('vendorLedgerModal');setTimeout(()=>openVendorSetup(${vendor.id}),200)">✏️ Edit Vendor</button>
          </div>
          <div class="right-actions">
            <button class="btn btn-primary btn-sm" onclick="closeModal('vendorLedgerModal');setTimeout(()=>openPaymentModal('vendor', ${vendor.id}),200)">💸 Add Payment</button>
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ==================== REFUND DETAILS ==================== */
function openRefundDetails(refundId) {
  const r = refundsCache.find(x => x.id === refundId);
  if (!r) {
    toast('Refund not found', 'error');
    return;
  }

  const html = `
    <div class="modal-bg act" id="refundDetailModal">
      <div class="modal narrow">
        <div class="modal-head">
          <h2>♻️ Refund Details</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">

          <div style="padding:20px;background:linear-gradient(135deg,var(--red-bg),var(--card));border-radius:14px;margin-bottom:20px;border:1px solid var(--red);text-align:center">
            <div style="font-size:11px;color:var(--red);text-transform:uppercase;font-weight:800;margin-bottom:6px">Refund Amount</div>
            <div style="font-size:32px;font-weight:900;color:var(--red)">${fmt(r.amount)}</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--primary)">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Customer</div>
              <div style="font-size:13.5px;font-weight:700">${esc(r.customerName || '—')}</div>
            </div>
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--primary)">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Date</div>
              <div style="font-size:13.5px;font-weight:700">${esc(r.date || '—')}</div>
            </div>
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--amber)">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Method</div>
              <div style="font-size:13.5px;font-weight:700">${esc(r.method || 'Cash')}</div>
            </div>
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--red)">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Reason</div>
              <div style="font-size:13.5px;font-weight:700">${esc(r.reason || '—')}</div>
            </div>
            ${r.packageName ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--blue);grid-column:1/-1">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Package</div>
                <div style="font-size:13.5px;font-weight:700">📦 ${esc(r.packageName)}${r.refNo ? ' · ' + esc(r.refNo) : ''}</div>
              </div>
            ` : ''}
            ${r.notes ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--purple);grid-column:1/-1">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Notes</div>
                <div style="font-size:12.5px">${esc(r.notes)}</div>
              </div>
            ` : ''}
          </div>

        </div>
        <div class="modal-foot">
          <div class="left-actions">
            <button class="btn btn-danger btn-sm" onclick="closeModal('refundDetailModal');setTimeout(()=>deleteRefund('${r.id}'),200)">🗑️ Delete Refund</button>
          </div>
          <div class="right-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ==================== WHATSAPP REMINDER ==================== */
function sendWhatsAppReminder(phone, name, amount) {
  if (!phone) {
    toast('Phone number নেই', 'error');
    return;
  }

  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.startsWith('01')) cleanPhone = '88' + cleanPhone;
  else if (cleanPhone.startsWith('1') && cleanPhone.length === 10) cleanPhone = '880' + cleanPhone;

  const message = `আসসালামু আলাইকুম ${name},\n\nআপনার Umrah Package এর বাকি টাকা এখনো জমা হয়নি।\n\n💵 বাকি: ৳ ${Number(amount).toLocaleString('en-US')}\n\nঅনুগ্রহ করে দ্রুত পরিশোধ করুন।\n\nধন্যবাদ।`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/* ============================================================
   ⭐ INVOICE SYSTEM (v6 — Logo Guaranteed)
   ============================================================ */

let invoiceRowCounter = 0;

/* ---------- Logo path resolution (multiple fallbacks) ---------- */
const INVOICE_LOGO_CANDIDATES = [
  '/images/holiday-planner-logo.png',
  'images/holiday-planner-logo.png',
  './images/holiday-planner-logo.png',
  '/assets/images/holiday-planner-logo.png',
  '/logo.png',
  'logo.png'
];

/* প্রথম যে logo URL ব্রাউজারে লোড হয়, সেটাই ক্যাশে হবে */
let _resolvedLogoUrl = null;
let _logoBase64Cache = null;

function resolveInvoiceLogoUrl() {
  if (_resolvedLogoUrl) return _resolvedLogoUrl;
  // Base URL + প্রথম candidate (absolute) — default
  _resolvedLogoUrl = location.origin + INVOICE_LOGO_CANDIDATES[0];
  return _resolvedLogoUrl;
}

/* HTML-এর জন্য logo URL (প্রিভিউতে ব্যবহার) */
function getInvoiceLogoUrl() {
  return resolveInvoiceLogoUrl();
}

/* Base64 এ convert — print iframe-এ embed করার জন্য (CORS/pdf safe) */
async function getInvoiceLogoBase64() {
  if (_logoBase64Cache !== null) return _logoBase64Cache;
  const candidates = INVOICE_LOGO_CANDIDATES.map(p =>
    p.startsWith('http') ? p : (p.startsWith('/') ? location.origin + p : location.origin + '/' + p.replace(/^\.?\//, ''))
  );

  for (const url of candidates) {
    try {
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) continue;
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/')) continue;
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      _resolvedLogoUrl = url;
      _logoBase64Cache = b64;
      return b64;
    } catch (e) { /* try next */ }
  }
  _logoBase64Cache = ''; // fail — empty
  return '';
}

/* ---------- Service type definitions ---------- */
const INVOICE_ITEM_TYPES = {
  flight: {
    label: 'Flight', icon: '✈️',
    fields: [
      { key: 'name',   label: 'Passenger Name', ph: 'MR JOHN DOE', w: '2fr' },
      { key: 'ref',    label: 'Air Code',       ph: 'BG',          w: '1fr' },
      { key: 'detail', label: 'Ticket No',      ph: '997 1234567890', w: '2fr' },
      { key: 'route',  label: 'Sector',         ph: 'DAC-JED-DAC', w: '1.5fr' },
      { key: 'date',   label: 'Travel Date',    type: 'date',      w: '1.3fr' }
    ]
  },
  hotel: {
    label: 'Hotel', icon: '🏨',
    fields: [
      { key: 'name',   label: 'Guest Name',   ph: 'MR JOHN DOE',     w: '2fr' },
      { key: 'ref',    label: 'Hotel Name',   ph: 'Swissotel Makkah', w: '2fr' },
      { key: 'detail', label: 'Room / Nights', ph: 'Quad · 5 Nights', w: '1.5fr' },
      { key: 'date',   label: 'Check-in',     type: 'date',          w: '1.3fr' },
      { key: 'date2',  label: 'Check-out',    type: 'date',          w: '1.3fr' }
    ]
  },
  transfer: {
    label: 'Transfer', icon: '🚐',
    fields: [
      { key: 'name',   label: 'Passenger / Group', ph: 'MR JOHN DOE', w: '2fr' },
      { key: 'ref',    label: 'Vehicle',          ph: 'GMC / Hiace / Bus', w: '1.5fr' },
      { key: 'route',  label: 'Route',            ph: 'JED Airport - Makkah Hotel', w: '2fr' },
      { key: 'detail', label: 'Pax / Trips',      ph: '4 Pax · 1 Way', w: '1.2fr' },
      { key: 'date',   label: 'Date',             type: 'date', w: '1.3fr' }
    ]
  },
  package: {
    label: 'Package', icon: '📦',
    fields: [
      { key: 'name',   label: 'Passenger Name', ph: 'MR JOHN DOE', w: '2fr' },
      { key: 'ref',    label: 'Package Name',   ph: 'Umrah Economy 14 Days', w: '2fr', list: 'invPackageList' },
      { key: 'detail', label: 'Details',        ph: 'Visa + Flight + Hotel', w: '1.8fr' },
      { key: 'date',   label: 'Travel Date',    type: 'date', w: '1.3fr' }
    ]
  },
  visa: {
    label: 'Visa', icon: '🛂',
    fields: [
      { key: 'name',   label: 'Passenger Name', ph: 'MR JOHN DOE', w: '2fr' },
      { key: 'ref',    label: 'Visa Type',      ph: 'Umrah Visa', w: '1.5fr' },
      { key: 'detail', label: 'Passport No',    ph: 'A01234567', w: '1.5fr' },
      { key: 'date',   label: 'Date',           type: 'date', w: '1.3fr' }
    ]
  },
  other: {
    label: 'Other Service', icon: '🧩',
    fields: [
      { key: 'name',   label: 'Passenger / Client', ph: 'MR JOHN DOE', w: '2fr' },
      { key: 'ref',    label: 'Service',            ph: 'Ziyarah / Insurance', w: '2fr' },
      { key: 'detail', label: 'Details',            ph: 'Description', w: '2fr' },
      { key: 'date',   label: 'Date',               type: 'date', w: '1.3fr' }
    ]
  }
};

/* ---------- helpers ---------- */
function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let invoiceCustomerState = { customerId: '', packageIds: [], paid: 0 };

function getInvoiceCustomerPackages(customer) {
  if (!customer) return [];
  return (STORE.packages || []).filter(p =>
    p.status !== 'Cancelled' &&
    ((p.customerId && String(p.customerId) === String(customer.id)) ||
     (p.customerPhone && customer.phone && String(p.customerPhone) === String(customer.phone)))
  );
}

function getInvoiceCustomerPaid(customer, packages, ignoredPaymentId = '') {
  const payments = customer?.payments || [];
  const ledgerPaid = payments.reduce((sum, payment) =>
    payment.id === ignoredPaymentId ? sum : sum + Math.max(0, Number(payment.amount || 0)), 0);
  const unrecordedAdvances = packages.reduce((sum, pkg) => {
    const advance = Math.max(0, Number(pkg.advanceAmount || 0));
    const recorded = payments.some(payment =>
      String(payment.packageId) === String(pkg.id) && payment.isAdvance
    );
    return sum + (recorded ? 0 : advance);
  }, 0);
  return ledgerPaid + unrecordedAdvances;
}

function getInvoicePackageItemNames(items, category) {
  return (items || []).map(item => {
    if (category === 'Hotel') return item.name || item.hotelName || '';
    if (category === 'Flight') return [item.airline, item.flightNo, item.sector || item.route].filter(Boolean).join(' ');
    if (category === 'Transfer') return [item.from, item.to, item.vehicle].filter(Boolean).join(' - ');
    if (category === 'Visa') return item.name || item.type || item.visaType || 'Visa';
    if (category === 'Ziyarah') return item.name || item.route || item.vehicle || 'Ziyarah';
    return item.name || item.serviceName || item.title || '';
  }).filter(Boolean).join(', ');
}

function buildPackageInvoiceRows(customer, packages) {
  const rows = [];
  const categories = [
    { label: 'Hotel', amount: 'hotelCost', items: pkg => [...(pkg.makkahHotels || []), ...(pkg.madinahHotels || [])] },
    { label: 'Flight', amount: 'flightCost', items: pkg => pkg.flights || [] },
    { label: 'Transfer', amount: 'transportCost', items: pkg => pkg.transports || [] },
    { label: 'Visa', amount: 'visaCost', items: pkg => pkg.visas || [] },
    { label: 'Other Services', amount: 'serviceCost', items: pkg => pkg.services || [] },
    { label: 'Ziyarah', amount: 'ziyarahTransportCost', items: pkg => pkg.ziyarahTransport || [] }
  ];

  packages.forEach(pkg => {
    let componentTotal = 0;
    categories.forEach(category => {
      const amount = Number(pkg[category.amount] || 0);
      const items = category.items(pkg);
      componentTotal += amount;
      if (amount || items.length) {
        rows.push({
          type: 'package',
          name: customer.customerName || '',
          ref: `${pkg.name || 'Package'} · ${category.label}`,
          detail: getInvoicePackageItemNames(items, category.label) || `${items.length || 1} ${category.label.toLowerCase()} item(s)`,
          date: pkg.checkIn || pkg.start || '',
          amount
        });
      }
    });

    const adjustment = Number(pkg.grandTotal || 0) - componentTotal;
    if (Math.abs(adjustment) > 0.01) {
      const adjustmentDetails = [
        Number(pkg.vatAmount || 0) ? `VAT ${fmt(pkg.vatAmount)}` : '',
        Number(pkg.serviceFeeAmount || 0) ? `Service fee ${fmt(pkg.serviceFeeAmount)}` : '',
        Number(pkg.markupAmount || 0) ? `Markup ${fmt(pkg.markupAmount)}` : '',
        Number(pkg.discountAmount || 0) ? `Discount -${fmt(pkg.discountAmount)}` : ''
      ].filter(Boolean).join(', ');
      rows.push({
        type: 'package',
        name: customer.customerName || '',
        ref: `${pkg.name || 'Package'} · Adjustments`,
        detail: adjustmentDetails || 'Package price adjustment',
        date: pkg.checkIn || pkg.start || '',
        amount: adjustment
      });
    }

    if (!categories.some(category => Number(pkg[category.amount] || 0) || category.items(pkg).length) &&
        Math.abs(adjustment) <= 0.01) {
      rows.push({
        type: 'package',
        name: customer.customerName || '',
        ref: pkg.name || 'Package',
        detail: pkg.refNo || 'Package services',
        date: pkg.checkIn || pkg.start || '',
        amount: Number(pkg.grandTotal || 0)
      });
    }
  });
  return rows;
}

function updateInvoiceSummary() {
  const summary = $('invoiceCustomerSummary');
  if (!summary) return;
  const customerId = $('invCustomerSelect')?.value || '';
  const hasCustomer = customerId && String(invoiceCustomerState.customerId) === String(customerId);
  const total = [...document.querySelectorAll('#invoiceItemsList > .inv-row')]
    .reduce((sum, row) => sum + readInvoiceRow(row).amount, 0);
  const paidSoFar = hasCustomer ? invoiceCustomerState.paid : 0;
  const rawPaidNow = $('invPaid')?.value.trim() || '';
  const paidNow = rawPaidNow ? Number(rawPaidNow) : 0;
  const dueBefore = Math.max(0, total - paidSoFar);

  summary.style.display = hasCustomer ? 'block' : 'none';
  if (!hasCustomer) return;
  $('invGrossTotal').textContent = fmt(total);
  $('invPaidSoFar').textContent = fmt(paidSoFar);
  $('invDueBefore').textContent = fmt(dueBefore);
  $('invDueAfter').textContent = fmt(Math.max(0, dueBefore - paidNow));
  $('invPackageServices').textContent = invoiceCustomerState.services || '';
}

function loadInvoiceCustomer(custId, populateRows = true) {
  const customer = (STORE.customers || []).find(c => String(c.id) === String(custId));
  if (!customer) {
    invoiceCustomerState = { customerId: '', packageIds: [], paid: 0 };
    $('invPackageIds').value = '';
    $('invoiceCustomerSummary').style.display = 'none';
    return;
  }

  const packages = getInvoiceCustomerPackages(customer);
  invoiceCustomerState = {
    customerId: String(customer.id),
    packageIds: packages.map(pkg => pkg.id),
    paid: getInvoiceCustomerPaid(customer, packages),
    services: packages.map(pkg => `${pkg.name || 'Package'}: ${['Hotel', 'Flight', 'Transfer', 'Visa', 'Other Services', 'Ziyarah']
      .filter((_, index) => {
        const keys = ['hotelCost', 'flightCost', 'transportCost', 'visaCost', 'serviceCost', 'ziyarahTransportCost'];
        const arrays = [pkg.makkahHotels?.length || pkg.madinahHotels?.length, pkg.flights?.length, pkg.transports?.length, pkg.visas?.length, pkg.services?.length, pkg.ziyarahTransport?.length];
        return Number(pkg[keys[index]] || 0) || arrays[index];
      }).join(', ')}`).join(' · ')
  };
  $('invPackageIds').value = JSON.stringify(invoiceCustomerState.packageIds);
  $('invCustomerName').value = customer.customerName || '';

  if (populateRows) {
    $('invoiceItemsList').innerHTML = '';
    invoiceRowCounter = 0;
    const rows = buildPackageInvoiceRows(customer, packages);
    if (rows.length) rows.forEach(row => addInvoiceItemRow('package', row));
    else addInvoiceItemRow('flight');
    $('invServiceType').value = packages.length ? 'Umrah Package' : '';
  }
  updateInvoiceSummary();
}

/* ১. ইনভয়েস মডাল ওপেন করা (নতুন বা এডিট) */
function openCreateInvoiceModal(existing) {
  const inv = existing && existing.invoiceData ? existing : null;
  const d = inv ? inv.invoiceData : {};

  $('invId').value = inv ? inv.id : '';
  $('invDate').value = d.date || today();
  $('invCustomerName').value = d.customerName || '';
  $('invServiceType').value = d.serviceType || '';
  $('invIssuedBy').value = d.issuedBy || window.__cachedSettings?.userName || '';
  if ($('invClientRef')) $('invClientRef').value = d.clientRef || '';
  if ($('invPaid')) $('invPaid').value = '';
  if ($('invPaymentMethod')) $('invPaymentMethod').value = d.paymentMethod || 'Cash';
  if ($('invPaymentId')) $('invPaymentId').value = '';

  const select = $('invCustomerSelect');
  select.innerHTML = '<option value="">-- Select Existing Customer --</option>' +
    (STORE.customers || []).map(c => `<option value="${c.id}">${esc(c.customerName)}${c.phone ? ` (${esc(c.phone)})` : ''}</option>`).join('');
  select.value = d.customerId || '';

  /* Package name suggestions */
  let dl = document.getElementById('invPackageList');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'invPackageList';
    document.body.appendChild(dl);
  }
  dl.innerHTML = (STORE.packages || []).map(p => `<option value="${escapeAttr(p.name || '')}">`).join('');

  $('invoiceItemsList').innerHTML = '';
  invoiceRowCounter = 0;
  if (d.rows && d.rows.length) {
    d.rows.forEach(r => addInvoiceItemRow(r.type || 'flight', r));
  } else {
    if (select.value) loadInvoiceCustomer(select.value);
    else addInvoiceItemRow('flight');
  }
  if (select.value) {
    loadInvoiceCustomer(select.value, false);
    if (inv && d.paymentTrackingVersion !== 2) {
      invoiceCustomerState.paid = Math.max(invoiceCustomerState.paid, Number(d.paid) || 0);
      updateInvoiceSummary();
    }
  }
  else {
    invoiceCustomerState = { customerId: '', packageIds: [], paid: 0 };
    $('invPackageIds').value = '';
    updateInvoiceSummary();
  }

  const title = document.querySelector('#invoiceSetupModal .modal-head h2');
  if (title) title.textContent = inv ? `🧾 Edit Invoice · ${d.invoiceNo}` : '🧾 Create Invoice';

  openModal('invoiceSetupModal');
}

/* ২. কাস্টমার সিলেক্ট করলে নাম বসানো */
function onInvoiceCustomerChange(custId) {
  $('invPaymentId').value = '';
  if (custId) {
    loadInvoiceCustomer(custId);
  } else {
    invoiceCustomerState = { customerId: '', packageIds: [], paid: 0 };
    $('invPackageIds').value = '';
    $('invCustomerName').value = '';
    $('invServiceType').value = '';
    $('invoiceItemsList').innerHTML = '';
    invoiceRowCounter = 0;
    addInvoiceItemRow('flight');
    $('invoiceCustomerSummary').style.display = 'none';
  }
}

/* ৩. নতুন সার্ভিস রো যোগ করা */
function addInvoiceItemRow(type, values) {
  type = INVOICE_ITEM_TYPES[type] ? type : 'flight';
  values = values || {};
  invoiceRowCounter++;
  const rowId = 'invRow_' + invoiceRowCounter;

  const html = `<div id="${rowId}" class="inv-row" data-type="${type}" style="background:var(--bg-2); padding:10px; border-radius:8px; border:1px solid var(--border);"></div>`;
  $('invoiceItemsList').insertAdjacentHTML('beforeend', html);
  renderInvoiceRow(rowId, type, values);
  updateInvoiceSummary();
}

function renderInvoiceRow(rowId, type, values) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const cfg = INVOICE_ITEM_TYPES[type];
  row.dataset.type = type;

  const typeOptions = Object.entries(INVOICE_ITEM_TYPES).map(([k, c]) =>
    `<option value="${k}" ${k === type ? 'selected' : ''}>${c.icon} ${c.label}</option>`
  ).join('');

  const cols = ['1.2fr', ...cfg.fields.map(f => f.w), '1fr', 'auto'].join(' ');

  const fieldsHtml = cfg.fields.map(f => `
    <div class="field" style="margin:0">
      <label style="font-size:10px">${f.label}</label>
      <input type="${f.type || 'text'}" class="inv-${f.key}" ${f.list ? `list="${f.list}"` : ''} placeholder="${escapeAttr(f.ph || '')}" value="${escapeAttr(values[f.key] || '')}">
    </div>
  `).join('');

  row.innerHTML = `
    <div style="display:grid; grid-template-columns:${cols}; gap:8px; align-items:end;">
      <div class="field" style="margin:0">
        <label style="font-size:10px">Service</label>
        <select class="inv-type" onchange="changeInvoiceRowType('${rowId}', this.value)">${typeOptions}</select>
      </div>
      ${fieldsHtml}
      <div class="field" style="margin:0">
        <label style="font-size:10px">Amount (৳)</label>
        <input type="number" class="inv-amount" placeholder="0" value="${values.amount ? escapeAttr(values.amount) : ''}" oninput="updateInvoiceSummary()">
      </div>
      <button class="btn btn-danger btn-sm" style="height:36px; margin-bottom:1px;" onclick="document.getElementById('${rowId}').remove();updateInvoiceSummary()">✕</button>
    </div>
  `;
}

function readInvoiceRow(row) {
  const out = { type: row.dataset.type || 'flight' };
  ['name', 'ref', 'detail', 'route', 'date', 'date2'].forEach(k => {
    const el = row.querySelector('.inv-' + k);
    if (el) out[k] = el.value.trim();
  });
  out.amount = Number(row.querySelector('.inv-amount')?.value) || 0;
  return out;
}

function changeInvoiceRowType(rowId, newType) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const values = readInvoiceRow(row);
  renderInvoiceRow(rowId, newType, values);
  updateInvoiceSummary();
}

/* ৪. সেভ (Documents এ) এবং প্রিভিউ তৈরি */
let _invoiceSaving = false;
async function saveAndPrintInvoice() {
  if (_invoiceSaving) return;

  const customerName = $('invCustomerName').value.trim();
  if (!customerName) {
    toast('Customer name required', 'error');
    return;
  }

  const rows = [];
  document.querySelectorAll('#invoiceItemsList > .inv-row').forEach(div => {
    const r = readInvoiceRow(div);
    if (r.name || r.ref || r.detail || r.amount > 0) rows.push(r);
  });

  if (!rows.length) {
    toast('Please add at least one service item', 'error');
    return;
  }

  const editId = $('invId').value;
  const date = $('invDate').value || today();
  const usedTypes = [...new Set(rows.map(r => INVOICE_ITEM_TYPES[r.type]?.label || r.type))];
  const serviceType = $('invServiceType').value.trim() || usedTypes.join(', ');
  const issuedBy = $('invIssuedBy').value || 'Agent';
  const clientRef = $('invClientRef')?.value.trim() || '';
  const rawPaidNow = $('invPaid')?.value.trim() || '';
  const paidNow = rawPaidNow ? Number(rawPaidNow) : 0;
  const customerId = $('invCustomerSelect').value || '';
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (!Number.isFinite(total) || total < 0) {
    toast('Invoice total must be a valid non-negative amount', 'error');
    return;
  }
  if (!Number.isFinite(paidNow) || paidNow < 0) {
    toast('Payment amount must be zero or more', 'error');
    return;
  }
  if (paidNow > 0 && !customerId) {
    toast('Select an existing customer to save a payment', 'error');
    return;
  }

  _invoiceSaving = true;
  showLoading('Saving invoice...');
  let paymentSaved = false;
  try {
    if (typeof loadDocs === 'function') await loadDocs();
    const existing = editId ? (docsCache || []).find(x => x.id === editId) : null;
    if (editId && !existing) throw new Error('Invoice not found. Reload Documents and try again.');

    const user = window.firebaseAuth?.currentUser;
    const recordId = existing?.id || editId || ('inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    const invoiceNo = existing?.invoiceData?.invoiceNo || ('I' + Date.now().toString().slice(-6));
    const paymentId = paidNow > 0
      ? ($('invPaymentId').value || ('invpay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)))
      : '';
    if (paidNow > 0) {
      $('invPaymentId').value = paymentId;
      $('invId').value = recordId;
    }

    const customer = customerId
      ? (STORE.customers || []).find(c => String(c.id) === String(customerId))
      : null;
    if (customerId && !customer) throw new Error('Selected customer could not be found. Please reselect the customer.');

    const packages = customer ? getInvoiceCustomerPackages(customer) : [];
    const payments = customer?.payments || [];
    const alreadySavedPayment = payments.find(payment => payment.id === paymentId);
    let paidBefore = customer ? getInvoiceCustomerPaid(customer, packages, paymentId) : 0;
    let ledgerChanged = false;
    if (customer && existing?.invoiceData?.paymentTrackingVersion !== 2) {
      const legacyPaid = Math.max(0, Number(existing?.invoiceData?.paid) || 0);
      const legacyPaymentId = `invlegacy_${recordId}`;
      const hasLegacyPayment = payments.some(payment => payment.id === legacyPaymentId);
      const legacyDifference = Math.max(0, legacyPaid - paidBefore);
      if (legacyDifference > 0.01 && !hasLegacyPayment) {
        if (!customer.payments) customer.payments = [];
        customer.payments.push({
          id: legacyPaymentId,
          amount: legacyDifference,
          date: existing.invoiceData.date || today(),
          method: existing.invoiceData.paymentMethod || 'Other',
          reference: invoiceNo,
          notes: `Imported previous payment from invoice ${invoiceNo}`,
          invoiceId: recordId,
          packageId: null,
          isAdvance: false,
          isInvoiceOpeningBalance: true,
          createdAt: existing.createdAt || Date.now()
        });
        paidBefore += legacyDifference;
        ledgerChanged = true;
      }
    }
    const dueBefore = Math.max(0, total - paidBefore);
    if (paidNow > dueBefore + 0.01) {
      throw new Error(`Payment exceeds the current due of ${fmt(dueBefore)}.`);
    }

    let paid = paidBefore;
    if (paidNow > 0) {
      if (!customer.payments) customer.payments = [];
      const payment = {
        ...(alreadySavedPayment || {}),
        id: paymentId,
        amount: paidNow,
        date: today(),
        method: $('invPaymentMethod')?.value || 'Cash',
        reference: invoiceNo,
        notes: `Invoice ${invoiceNo}`,
        invoiceId: recordId,
        packageId: null,
        isAdvance: false,
        createdAt: alreadySavedPayment?.createdAt || Date.now()
      };
      const paymentIndex = customer.payments.findIndex(item => item.id === paymentId);
      if (paymentIndex >= 0) customer.payments[paymentIndex] = payment;
      else customer.payments.push(payment);
      customer.updatedAt = Date.now();
      ledgerChanged = true;
    }
    if (ledgerChanged) {
      customer.updatedAt = Date.now();
      await dbSave(STORES.customers, customer);
      paymentSaved = true;
      STORE.customers = await dbGetAll(STORES.customers);
      const savedCustomer = STORE.customers.find(c => String(c.id) === String(customerId));
      if (!savedCustomer) throw new Error('Customer ledger was updated, but the customer record could not be reloaded.');
      paid = getInvoiceCustomerPaid(savedCustomer, packages);
    }
    if (!customer && existing?.invoiceData?.paymentTrackingVersion !== 2) {
      paid = Math.max(0, Number(existing?.invoiceData?.paid) || 0);
    }

    const packageIds = customer
      ? packages.map(pkg => pkg.id)
      : (invoiceCustomerState.packageIds || []);
    const amountInWords = numberToWords(Math.round(total)) + ' TAKA ONLY';
    const data = {
      invoiceNo, date, customerId, packageIds, customerName, serviceType, issuedBy, clientRef,
      rows, total, paid, due: Math.max(0, total - paid), amountInWords,
      paymentMethod: paidNow > 0 ? ($('invPaymentMethod')?.value || 'Cash') : (existing?.invoiceData?.paymentMethod || ''),
      lastPaymentAmount: paidNow,
      paymentTrackingVersion: 2
    };

    let uploaderName = issuedBy;
    uploaderName = window.__cachedSettings?.userName || user?.displayName || user?.email?.split('@')[0] || issuedBy;

    const record = {
      ...(existing || {}),
      id: recordId,
      type: 'bill',
      title: `Invoice ${invoiceNo} · ${customerName}`,
      vendorName: '',
      packageName: rows.find(r => r.type === 'package')?.ref || '',
      amount: total,
      date,
      notes: serviceType,
      invoiceData: data,
      uploadedBy: existing?.uploadedBy || user?.uid || null,
      uploadedByName: existing?.uploadedByName || uploaderName,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    if (existing) {
      docsCache = docsCache.map(x => x.id === existing.id ? record : x);
    } else {
      docsCache.push(record);
    }
    await saveDocs();
    $('invId').value = record.id;
    $('invPaymentId').value = '';
    $('invPaid').value = '';
    if (customer) {
      const savedCustomer = STORE.customers.find(c => String(c.id) === String(customerId));
      invoiceCustomerState.paid = savedCustomer ? getInvoiceCustomerPaid(savedCustomer, packages) : paid;
      updateInvoiceSummary();
    }
    hideLoading();
    toast(existing ? '✅ Invoice updated in Documents' : '✅ Invoice saved to Documents → Customer Bill');
    if (document.getElementById('docList') && typeof renderDocuments === 'function') renderDocuments();
    generateInvoicePreview(data);
  } catch (e) {
    hideLoading();
    toast(paymentSaved
      ? `Payment was recorded, but invoice save failed: ${e.message}. Do not enter the payment again.`
      : 'Invoice save failed: ' + e.message, 'error');
  } finally {
    _invoiceSaving = false;
  }
}

/* Documents থেকে সেভ করা ইনভয়েস আবার দেখা / প্রিন্ট */
function viewSavedInvoice(docId) {
  const d = (docsCache || []).find(x => x.id === docId);
  if (!d || !d.invoiceData) { toast('Invoice not found', 'error'); return; }
  document.getElementById('docViewModal')?.remove();
  generateInvoicePreview(d.invoiceData);
}

function editSavedInvoice(docId) {
  const d = (docsCache || []).find(x => x.id === docId);
  if (!d || !d.invoiceData) { toast('Invoice not found', 'error'); return; }
  document.getElementById('docViewModal')?.remove();
  openCreateInvoiceModal(d);
}

/* ৫. সংখ্যাকে কথায় রূপান্তর */
function numberToWords(num) {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return 'ZERO';
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  let str = '';
  if (num > 999) { str += numberToWords(Math.floor(num / 1000)) + ' THOUSAND '; num %= 1000; }
  if (num > 99) { str += a[Math.floor(num / 100)] + 'HUNDRED '; num %= 100; }
  if (num > 0) {
    if (num < 20) str += a[num];
    else str += b[Math.floor(num / 10)] + ' ' + a[num % 10];
  }
  return str.replace(/\s+/g, ' ').trim();
}

/* ইনভয়েস HTML (প্রিভিউ ও প্রিন্ট দুটোতেই ব্যবহার) */
function buildInvoiceHtml(data, options = {}) {
  const cell = 'border:1px solid #000; padding:6px; font-size:12px;';
  const th = 'border:1px solid #000; padding:6px; font-size:11px; background:#f0f0f0;';
  const nfmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const logoUrl = options.logoUrl || getInvoiceLogoUrl();
  const logoSrc = options.logoBase64 || logoUrl;

  /* টাইপ অনুযায়ী আলাদা টেবিল */
  const groups = {};
  (data.rows || []).forEach(r => {
    const t = INVOICE_ITEM_TYPES[r.type] ? r.type : 'flight';
    (groups[t] = groups[t] || []).push(r);
  });

  const tablesHtml = Object.keys(INVOICE_ITEM_TYPES).filter(t => groups[t]).map(t => {
    const cfg = INVOICE_ITEM_TYPES[t];
    const fields = cfg.fields;
    const subtotal = groups[t].reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return `
      <div style="font-size:12px; font-weight:bold; margin:10px 0 4px; text-transform:uppercase;">${cfg.label} Details</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
        <thead>
          <tr>
            ${fields.map(f => `<th style="${th} text-align:left;">${esc(f.label.toUpperCase())}</th>`).join('')}
            <th style="${th} text-align:right;">AMOUNT IN BDT</th>
          </tr>
        </thead>
        <tbody>
          ${groups[t].map(r => `
            <tr>
              ${fields.map(f => `<td style="${cell}">${esc(r[f.key] || '')}</td>`).join('')}
              <td style="${cell} text-align:right;">${nfmt(r.amount)}</td>
            </tr>
          `).join('')}
          ${Object.keys(groups).length > 1 ? `
            <tr>
              <td colspan="${fields.length}" style="${cell} text-align:right; font-weight:bold;">${cfg.label} Subtotal</td>
              <td style="${cell} text-align:right; font-weight:bold;">${nfmt(subtotal)}</td>
            </tr>` : ''}
        </tbody>
      </table>
    `;
  }).join('');

  const paid = Number(data.paid) || 0;

  return `
    <div class="invoice-sheet" style="font-family: Arial, sans-serif; color:#000; background:#fff; width:100%; max-width:190mm; margin:0 auto; padding:20px; border:1px solid #000; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px;">
        <div style="width:200px;">
          <img src="${logoSrc}" style="max-width:100%; max-height:70px; object-fit:contain;" alt="Logo" onerror="this.style.display='none'">
        </div>
        <div style="text-align:right; font-size:12px; line-height:1.4;">
          <strong style="font-size:14px;">Bashati Condominium</strong><br>
          House # 15 (Flat No 10-C)<br>
          Road # 17, Banani, Dhaka -1213<br>
          Tel : +880 2 222274554<br>
          holidayplannerac@gmail.com
        </div>
      </div>

      <div style="text-align:center; font-size:18px; font-weight:bold; margin:15px 0; border-top:2px solid #000; border-bottom:2px solid #000; padding:5px;">INVOICE</div>

      <div style="display:grid; grid-template-columns:1.5fr 1.5fr 1fr; border:1px solid #000; margin-bottom:10px;">
        <div style="padding:10px; border-right:1px solid #000; font-size:12px;">
          <strong>To ${esc(data.customerName)}</strong>
        </div>
        <div style="padding:10px; border-right:1px solid #000; font-size:12px; line-height:1.6;">
          <strong>Invoice No.</strong> : ${esc(data.invoiceNo)}<br>
          <strong>Invoice Date</strong> : ${esc(data.date)}<br>
          <strong>Issue Date</strong> : ${esc(data.date)}<br>
          <strong>Due Date</strong> : ${esc(data.date)}<br>
          <strong>Issued By</strong> : ${esc(data.issuedBy)}
        </div>
        <div style="padding:10px; font-size:12px; line-height:1.6;">
          <strong>Client Ref</strong> : ${esc(data.clientRef || '')}<br>
          <strong>Service Type</strong> : ${esc(data.serviceType)}
        </div>
      </div>

      ${tablesHtml}

      <div style="border:1px solid #000; padding:8px; font-size:12px; display:flex; justify-content:space-between; gap:12px; margin:10px 0;">
        <div><strong>Amount in words :</strong> ${esc(data.amountInWords)}</div>
        <div style="text-align:right; white-space:nowrap; line-height:1.6;">
          <strong>Total</strong> ${nfmt(data.total)}
          ${paid > 0 ? `<br><strong>Paid</strong> ${nfmt(paid)}<br><strong>Due</strong> ${nfmt(Math.max(0, (Number(data.total) || 0) - paid))}` : ''}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:50px; font-size:12px; padding:0 20px;">
        <div style="text-align:center;"><div style="border-top:1px solid #000; width:150px; margin-bottom:5px;"></div>Prepared By</div>
        <div style="text-align:center;"><div style="border-top:1px solid #000; width:150px; margin-bottom:5px;"></div>Checked By</div>
        <div style="text-align:center; position:relative;">
          <div style="position:absolute; top:-40px; right:10px; width:80px; height:80px; border:2px solid #4a8ae6; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#4a8ae6; font-weight:900; font-size:10px; transform:rotate(-15deg); opacity:0.5; text-align:center;">HOLIDAY<br>PLANNER</div>
          <div style="border-top:1px solid #000; width:150px; margin-bottom:5px;"></div>Authorized Signature
        </div>
      </div>

      <div style="text-align:center; font-size:11px; margin-top:20px; font-weight:bold;">
        This is computer generated Invoice - Authorized signature not required.
      </div>
    </div>
  `;
}

/* ৬. ইনভয়েস প্রিভিউ */
let _currentInvoiceData = null;
function generateInvoicePreview(data) {
  closeModal('invoiceSetupModal');
  document.querySelectorAll('#invoicePreviewModal').forEach(el => el.remove());
  _currentInvoiceData = data;

  const html = `
    <div class="modal-bg act" id="invoicePreviewModal" style="background: rgba(0,0,0,0.7)">
      <div class="modal" style="max-width: 820px; padding: 0;">
        <div class="modal-head" style="background:#f8f9fa; border-bottom:1px solid #ddd; padding:10px 20px; border-radius: 12px 12px 0 0;">
          <h2 style="font-size:16px; margin:0;">🧾 Invoice Preview · ${esc(data.invoiceNo)}</h2>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-primary btn-sm" onclick="printCurrentInvoice()">🖨️ Print / Save PDF</button>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
        <div class="modal-body" style="background:#fff; padding: 20px;">
          ${buildInvoiceHtml(data)}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ৭. প্রিন্ট (iframe — logo base64 embed) */
async function printCurrentInvoice() {
  const data = _currentInvoiceData;
  if (!data) return;

  /* logo base64 — print-এ external URL fail হলেও inline থাকবে */
  let logoBase64 = '';
  try { logoBase64 = await getInvoiceLogoBase64(); } catch (e) { /* ignore */ }

  const html = buildInvoiceHtml(data, { logoBase64: logoBase64 || getInvoiceLogoUrl() });

  document.getElementById('invoicePrintFrame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'invoicePrintFrame';
  frame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Invoice ${esc(data.invoiceNo)} - ${esc(data.customerName)}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      html, body { margin:0; padding:0; background:#fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table tr { page-break-inside: avoid; break-inside: avoid; }
      img { max-width:100%; }
    </style>
  </head><body>${html}</body></html>`);
  doc.close();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try { frame.contentWindow.focus(); } catch (e) {}
    setTimeout(() => {
      try { frame.contentWindow.print(); } catch (e) {}
      setTimeout(() => frame.remove(), 1500);
    }, 200);
  };

  const img = doc.querySelector('img');
  if (img && !img.complete) {
    img.onload = doPrint;
    img.onerror = doPrint;
    setTimeout(doPrint, 2500);
  } else {
    setTimeout(doPrint, 200);
  }
}

/* ==================== PAYMENT ADVICE ==================== */
const PAYMENT_ADVICE_FIELDS = {
  invoiceNo: 'paInvoiceNo',
  adviceNo: 'paAdviceNo',
  date: 'paDate',
  class: 'paClass',
  travelDate: 'paTravelDate',
  carrier: 'paCarrier',
  issuedBy: 'paIssuedBy',
  sector: 'paSector',
  clientName: 'paClientName',
  contactPerson: 'paContactPerson',
  contactNo: 'paContactNo',
  address: 'paAddress',
  salesPerson: 'paSalesPerson',
  creditPeriod: 'paCreditPeriod',
  creditTo: 'paCreditTo',
  clientCategory: 'paClientCategory',
  fare: 'paFare',
  taxes: 'paTaxes',
  vatAit: 'paVatAit',
  discount: 'paDiscount',
  serviceCharges: 'paServiceCharges',
  netBill: 'paNetBill',
  invoiceAmount: 'paInvoiceAmount',
  note: 'paNote'
};

function openPaymentAdviceModal(existing) {
  const record = existing && existing.paymentAdviceData ? existing : null;
  const data = record ? record.paymentAdviceData : {};
  $('paId').value = record ? record.id : '';
  Object.entries(PAYMENT_ADVICE_FIELDS).forEach(([key, id]) => {
    const input = $(id);
    if (input) input.value = data[key] == null ? '' : data[key];
  });
  [1, 2, 3].forEach(i => {
    $(`paPaxName${i}`).value = data.paxNames?.[i - 1] || '';
    const ticketInput = $(`paTicketNo${i}`);
    if (ticketInput) ticketInput.value = data.ticketNos?.[i - 1] || '';
  });
  if (!record) {
    $('paDate').value = today();
    $('paAdviceNo').value = 'PA' + Date.now().toString().slice(-6);
    $('paIssuedBy').value = window.__cachedSettings?.userName || '';
  }
  const title = document.querySelector('#paymentAdviceSetupModal .modal-head h2');
  if (title) title.textContent = record ? `📄 Edit Payment Advice · ${data.adviceNo}` : '📄 Payment Advice / Credit Approval Form';
  openModal('paymentAdviceSetupModal');
}

let _paymentAdviceSaving = false;
async function savePaymentAdvice() {
  if (_paymentAdviceSaving) return;
  const adviceNo = $('paAdviceNo').value.trim();
  const paxNames = [1, 2, 3].map(i => $(`paPaxName${i}`).value.trim());
  if (!adviceNo || !paxNames.some(Boolean)) {
    toast('Payment Advice No. and at least one Pax Name are required', 'error');
    return;
  }

  const data = { adviceNo, paxNames, ticketNos: [1, 2].map(i => $(`paTicketNo${i}`).value.trim()) };
  Object.entries(PAYMENT_ADVICE_FIELDS).forEach(([key, id]) => {
    const input = $(id);
    data[key] = input.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value.trim();
  });
  data.date = data.date || today();
  const paxName = paxNames.find(Boolean);
  const amount = data.invoiceAmount !== '' ? Number(data.invoiceAmount) : Number(data.netBill) || 0;
  const editId = $('paId').value;
  _paymentAdviceSaving = true;
  showLoading('Saving Payment Advice...');
  try {
    if (typeof loadDocs === 'function') await loadDocs();
    const existing = editId ? (docsCache || []).find(x => x.id === editId && x.paymentAdviceData) : null;
    if (editId && !existing) {
      toast('Payment Advice not found', 'error');
      return;
    }

    const user = window.firebaseAuth?.currentUser;
    const record = {
      ...(existing || {}),
      id: existing?.id || ('pa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      type: 'paymentAdvice',
      title: `Payment Advice ${adviceNo} · ${paxName}`,
      vendorName: '',
      packageName: '',
      amount,
      date: data.date,
      notes: data.note || data.creditPeriod || '',
      paymentAdviceData: data,
      uploadedBy: existing?.uploadedBy || user?.uid || null,
      uploadedByName: existing?.uploadedByName || data.issuedBy || user?.displayName || user?.email?.split('@')[0] || 'Unknown',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    if (existing) docsCache = docsCache.map(x => x.id === existing.id ? record : x);
    else docsCache.push(record);
    await saveDocs();
    $('paId').value = record.id;
    toast(existing ? '✅ Payment Advice updated in Documents' : '✅ Payment Advice saved to Documents');
    if (document.getElementById('docList') && typeof renderDocuments === 'function') renderDocuments();
    generatePaymentAdvicePreview(data);
  } catch (e) {
    toast('Payment Advice save failed: ' + e.message, 'error');
  } finally {
    hideLoading();
    _paymentAdviceSaving = false;
  }
}

function viewSavedPaymentAdvice(docId) {
  const record = (docsCache || []).find(x => x.id === docId);
  if (!record || !record.paymentAdviceData) { toast('Payment Advice not found', 'error'); return; }
  document.getElementById('docViewModal')?.remove();
  generatePaymentAdvicePreview(record.paymentAdviceData);
}

function editSavedPaymentAdvice(docId) {
  const record = (docsCache || []).find(x => x.id === docId);
  if (!record || !record.paymentAdviceData) { toast('Payment Advice not found', 'error'); return; }
  document.getElementById('docViewModal')?.remove();
  openPaymentAdviceModal(record);
}

function buildPaymentAdviceHtml(data, options = {}) {
  const logoSrc = options.logoBase64 || options.logoUrl || getInvoiceLogoUrl();
  const escText = value => esc(value || '');
  const amount = value => value === '' || value == null ? '' : Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const border = 'border:1px solid #000;padding:6px 8px;font-size:12px;';
  const line = (label, value, height = 26) => `<tr><td style="${border}width:31%;font-weight:bold;height:${height}px;">${label}</td><td style="${border}">${escText(value)}</td></tr>`;
  const checked = (value, option) => value === option ? '[X] ' : '[ ] ';
  const summary = [
    ['Fare', data.fare], ['Taxes', data.taxes], ['VAT & AIT', data.vatAit],
    ['Discount', data.discount], ['Service Charges', data.serviceCharges],
    ['Net Bill', data.netBill], ['Invoice Amount', data.invoiceAmount]
  ];
  return `
    <div style="font-family:Arial,sans-serif;color:#000;background:#fff;width:100%;max-width:194mm;min-height:277mm;margin:0 auto;padding:5mm;box-sizing:border-box;font-size:12px;display:flex;flex-direction:column;">
      <div style="text-align:center;margin-bottom:12px;">
        <img src="${logoSrc}" alt="Holiday Planner" style="max-width:82%;max-height:78px;object-fit:contain;" onerror="this.style.display='none'">
        <div style="font-size:11px;line-height:1.4;margin-top:4px;">
          Bashati Condominium, House # 15 (Flat No C/9-10) Road # 17, Banani, Dhaka-1213, Bangladesh<br>
          Tel : +8802-222274554, 9820338, Email: holidayplanner2017@gmail.com
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr><td style="${border}width:50%;"><strong>Invoice No:</strong> ${escText(data.invoiceNo)}</td><td style="${border}text-align:right;"><strong>Payment Advice No:</strong> ${escText(data.adviceNo)}</td></tr>
      </table>
      <div style="text-align:center;border:1px solid #000;padding:8px;font-weight:bold;font-size:16px;margin-bottom:10px;">PAYMENT ADVICE / CREDIT APPROVAL FORM</div>
      <div style="text-align:right;margin-bottom:8px;font-size:12px;"><strong>Date:</strong> ${escText(data.date)}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tr>
          <td style="width:62%;vertical-align:top;padding-right:5px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="${border}width:22%;font-weight:bold;">Pax Name:</td><td style="${border}height:26px;">${escText(data.paxNames?.[0])}</td></tr>
              <tr><td style="${border}"></td><td style="${border}height:26px;">${escText(data.paxNames?.[1])}</td></tr>
              <tr><td style="${border}"></td><td style="${border}height:26px;">${escText(data.paxNames?.[2])}</td></tr>
              <tr><td style="${border}font-weight:bold;">Ticket No:</td><td style="${border}height:26px;">${escText(data.ticketNos?.[0])}</td></tr>
              <tr><td style="${border}"></td><td style="${border}height:26px;">${escText(data.ticketNos?.[1])}</td></tr>
            </table>
          </td>
          <td style="vertical-align:top;">
            <table style="width:100%;border-collapse:collapse;">
              ${line('Class:', data.class)}
              ${line('Travel Date:', data.travelDate)}
              ${line('Carrier:', data.carrier)}
              ${line('Issued By:', data.issuedBy)}
            </table>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <tr>
          <td style="width:58%;vertical-align:top;padding-right:8px;">
            <table style="width:100%;border-collapse:collapse;">
              ${line('Sector:', data.sector)}
              ${line('Client Name:', data.clientName)}
              ${line('Contact Person:', data.contactPerson)}
              ${line('Contact No.:', data.contactNo)}
              ${line('Address:', data.address, 42)}
              ${line('Sales Person:', data.salesPerson)}
            </table>
            <table style="width:100%;border-collapse:collapse;margin-top:4px;">
              <tr><td style="${border}width:31%;font-weight:bold;">Credit Period:</td><td style="${border}font-size:10px;">${checked(data.creditPeriod, '15 Days')}15 Days &nbsp; ${checked(data.creditPeriod, '30 Days')}30 Days &nbsp; ${checked(data.creditPeriod, 'Paid Mr-')}Paid Mr- ${escText(data.creditTo)}</td></tr>
              <tr><td style="${border}font-weight:bold;">Client Category:</td><td style="${border}font-size:10px;">${checked(data.clientCategory, 'Personal')}Personal &nbsp; ${checked(data.clientCategory, 'Corp.')}Corp. &nbsp; ${checked(data.clientCategory, 'In-house')}In-house &nbsp; ${checked(data.clientCategory, 'General')}General</td></tr>
            </table>
            <div style="display:flex;margin-top:6px;min-height:78px;">
              <strong style="padding:5px 6px 0 0;">Note:</strong>
              <div style="border:1px solid #000;flex:1;padding:5px;">${escText(data.note)}</div>
            </div>
            <div style="font-weight:bold;margin-top:12px;">Signature:</div>
          </td>
          <td style="vertical-align:top;">
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr><th style="${border}text-align:left;">Fare:</th><th style="${border}text-align:center;width:34%;">Amount</th></tr></thead>
              <tbody>${summary.map(([label, value]) => `<tr><td style="${border}${label === 'Net Bill' || label === 'Invoice Amount' ? 'font-weight:bold;text-align:center;' : ''}">${label === 'Fare' ? '' : label === 'Taxes' ? 'Taxes:' : label === 'VAT & AIT' ? 'VAT & AIT' : label}</td><td style="${border}height:${label === 'Fare' || label === 'Taxes' ? 48 : 30}px;text-align:right;${label === 'Invoice Amount' ? 'font-weight:bold;' : ''}">${amount(value)}</td></tr>`).join('')}</tbody>
            </table>
          </td>
        </tr>
      </table>
      <div style="margin-top:auto;padding:0 8px 0;">
        <div style="display:flex;justify-content:space-between;">
          <div style="width:20%;border-top:1px solid #000;"></div>
          <div style="width:20%;border-top:1px solid #000;"></div>
          <div style="width:20%;border-top:1px solid #000;"></div>
        </div>
      </div>
    </div>
  `;
}

let _currentPaymentAdviceData = null;
function generatePaymentAdvicePreview(data) {
  closeModal('paymentAdviceSetupModal');
  document.getElementById('paymentAdvicePreviewModal')?.remove();
  _currentPaymentAdviceData = data;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', `
    <div class="modal-bg act" id="paymentAdvicePreviewModal" style="background:rgba(0,0,0,.7)">
      <div class="modal" style="max-width:1000px;max-height:95vh;padding:0">
        <div class="modal-head" style="background:#f8f9fa;border-bottom:1px solid #ddd;padding:10px 20px;">
          <h2 style="font-size:16px;margin:0;">📄 Payment Advice · ${esc(data.adviceNo)}</h2>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-primary btn-sm" onclick="printCurrentPaymentAdvice()">🖨️ Print / Save PDF</button>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
        <div class="modal-body" style="background:#f1f3f5;padding:20px;max-height:calc(95vh - 64px);overflow:auto;">${buildPaymentAdviceHtml(data)}</div>
      </div>
    </div>
  `);
}

async function printCurrentPaymentAdvice() {
  const data = _currentPaymentAdviceData;
  if (!data) return;
  const logoBase64 = await getInvoiceLogoBase64();
  const html = buildPaymentAdviceHtml(data, { logoBase64: logoBase64 || getInvoiceLogoUrl() });
  document.getElementById('paymentAdvicePrintFrame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'paymentAdvicePrintFrame';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Advice ${esc(data.adviceNo)}</title>
    <style>@page{size:A4 portrait;margin:8mm}html,body{margin:0;padding:0;background:#fff;color:#000}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}table{break-inside:avoid}img{max-width:100%;filter:grayscale(1) contrast(1.25)}</style>
    </head><body>${html}</body></html>`);
  doc.close();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    frame.contentWindow.focus();
    setTimeout(() => {
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1500);
    }, 200);
  };
  const img = doc.querySelector('img');
  if (img && !img.complete) {
    img.onload = doPrint;
    img.onerror = doPrint;
    setTimeout(doPrint, 2500);
  } else {
    setTimeout(doPrint, 200);
  }
}
