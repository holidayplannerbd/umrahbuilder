/* ============================================================
   UMRAH BUILDER — PAGES / FINANCIAL
   Financial detail modal + print
   ============================================================ */

/* ==================== OPEN FINANCIAL DETAIL ==================== */
function openFinancialDetail(pkgId) {
  const p = STORE.packages.find(x => x.id === pkgId);
  if (!p) return;

  const customerSell = p.grandTotal || 0;
  const vendorCost = (p.vendorHotelCost || 0) + (p.vendorFlightCost || 0) +
                    (p.vendorTransportCost || 0) + (p.vendorServiceCost || 0) +
                    (p.vendorZiyarahCost || 0) + (p.vendorVisaCost || 0);
  const profit = customerSell - vendorCost - (p.vatAmount || 0) - (p.serviceFeeAmount || 0);
  const margin = customerSell > 0 ? ((profit / customerSell) * 100).toFixed(1) : '0.0';

  /* Customer payments */
  let received = getPackageAdvance(p);
  const customerPayments = [];
  STORE.customers.forEach(c => {
    (c.payments || []).forEach(pm => {
      if (pm.packageId === p.id) {
        received += Math.max(0, Number(pm.amount || 0));
        customerPayments.push({ ...pm, customerName: c.customerName });
      }
    });
  });
  const customerDue = Math.max(0, customerSell - received);

  /* Vendor payments */
  let vendorPaid = 0;
  const vendorPayments = [];
  STORE.vendors.forEach(v => {
    (v.payments || []).forEach(pm => {
      if (pm.packageId === p.id) {
        vendorPaid += (pm.amount || 0);
        vendorPayments.push({ ...pm, vendorName: v.name });
      }
    });
  });
  const vendorDue = Math.max(0, vendorCost - vendorPaid);

  const pkgDate = p.checkIn || p.start || (p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '—');
  const createdDate = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '—';
  const cls = (p.status || 'draft').toLowerCase().replace(/\s+/g, '-');

  const html = `
    <div style="padding:20px;background:linear-gradient(135deg,var(--primary-bg),var(--card));border-radius:14px;margin-bottom:20px;border:1px solid var(--primary-light)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="font-size:20px;font-weight:800;margin-bottom:4px">${esc(p.name)}</h3>
          <div style="font-size:12px;color:var(--text-3);font-weight:600">Ref: ${esc(p.refNo || '—')}</div>
        </div>
        <span class="pill ${cls}"><span class="dot"></span>${esc(p.status || 'Draft')}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <div style="padding:8px 12px;background:var(--card);border-radius:8px">
          <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:800">Package Date</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px">${esc(pkgDate)}</div>
        </div>
        <div style="padding:8px 12px;background:var(--card);border-radius:8px">
          <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;font-weight:800">Created</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px">${esc(createdDate)}</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="padding:16px;border-radius:14px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff">
        <div style="font-size:11px;opacity:.9;text-transform:uppercase;font-weight:800;margin-bottom:10px">👤 Customer Financial</div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px"><span>Sell:</span><b>${fmt(customerSell)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px"><span>Paid:</span><b>${fmt(received)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding-top:8px;border-top:1px solid rgba(255,255,255,.3)"><span>Due:</span><b>${fmt(customerDue)}</b></div>
      </div>
      <div style="padding:16px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff">
        <div style="font-size:11px;opacity:.9;text-transform:uppercase;font-weight:800;margin-bottom:10px">🏢 Vendor Financial</div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px"><span>Cost:</span><b>${fmt(vendorCost)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px"><span>Paid:</span><b>${fmt(vendorPaid)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding-top:8px;border-top:1px solid rgba(255,255,255,.3)"><span>Due:</span><b>${fmt(vendorDue)}</b></div>
      </div>
    </div>

    <div style="padding:20px;background:var(--bg-2);border-radius:14px;margin-bottom:20px;border:1px solid var(--border)">
      <div style="font-size:12px;font-weight:900;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">💰 Package Breakdown</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px">
        <div style="display:flex;justify-content:space-between;padding:6px 0"><span>🕌 Hotel</span><b>${fmt(p.hotelCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:var(--blue)"><span>↳ Vendor</span><b>${fmt(p.vendorHotelCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0"><span>✈ Flight</span><b>${fmt(p.flightCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:var(--blue)"><span>↳ Vendor</span><b>${fmt(p.vendorFlightCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0"><span>▣ Transport</span><b>${fmt(p.transportCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:var(--blue)"><span>↳ Vendor</span><b>${fmt(p.vendorTransportCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0"><span>▤ Visa</span><b>${fmt(p.visaCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:var(--blue)"><span>↳ Vendor</span><b>${fmt(p.vendorVisaCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0"><span>★ Ziyarah</span><b>${fmt(p.ziyarahTransportCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:var(--blue)"><span>↳ Vendor</span><b>${fmt(p.vendorZiyarahCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0"><span>▦ Service</span><b>${fmt(p.serviceCost || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:var(--blue)"><span>↳ Vendor</span><b>${fmt(p.vendorServiceCost || 0)}</b></div>
      </div>
      <div style="height:1px;background:var(--border);margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>VAT (${p.vatPercent || 0}%)</span><b style="color:var(--amber)">${fmt(p.vatAmount || 0)}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span>Service Fee</span><b>${fmt(p.serviceFeeAmount || 0)}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:15px;padding:8px 0;border-top:2px solid var(--border-2);margin-top:6px"><span style="font-weight:800">GRAND TOTAL</span><b style="color:var(--primary);font-size:18px">${fmt(customerSell)}</b></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="padding:14px;border-radius:12px;text-align:center;background:var(--green-bg);border:1px solid var(--green)">
        <div style="font-size:10px;color:var(--green);text-transform:uppercase;font-weight:800;margin-bottom:4px">Profit</div>
        <div style="font-size:18px;font-weight:900;color:var(--green)">${fmt(profit)}</div>
      </div>
      <div style="padding:14px;border-radius:12px;text-align:center;background:var(--amber-bg);border:1px solid var(--amber)">
        <div style="font-size:10px;color:var(--amber);text-transform:uppercase;font-weight:800;margin-bottom:4px">Margin</div>
        <div style="font-size:18px;font-weight:900;color:var(--amber)">${margin}%</div>
      </div>
      <div style="padding:14px;border-radius:12px;text-align:center;background:var(--blue-bg);border:1px solid var(--blue)">
        <div style="font-size:10px;color:var(--blue);text-transform:uppercase;font-weight:800;margin-bottom:4px">Per Person</div>
        <div style="font-size:18px;font-weight:900;color:var(--blue)">${fmt(p.perPerson || 0)}</div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <h4 style="font-size:12px;font-weight:900;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💰 Customer Payments (${customerPayments.length})</h4>
      ${customerPayments.length ? customerPayments.map(pm => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-2);border-radius:10px;margin-bottom:6px;font-size:12.5px">
          <div>
            <div style="font-weight:700">${esc(pm.customerName || '—')}</div>
            <div style="font-size:10.5px;color:var(--text-3)">${esc(pm.date || '—')} · ${esc(pm.method || 'Cash')}${pm.reference ? ' · ' + esc(pm.reference) : ''}</div>
          </div>
          <div style="font-weight:800;color:var(--green);font-size:14px">+ ${fmt(pm.amount)}</div>
        </div>
      `).join('') : '<div style="padding:10px;background:var(--bg-2);border-radius:10px;font-size:12px;color:var(--text-3);text-align:center">No payments</div>'}
    </div>

    <div>
      <h4 style="font-size:12px;font-weight:900;color:var(--red);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💸 Vendor Payments (${vendorPayments.length})</h4>
      ${vendorPayments.length ? vendorPayments.map(pm => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-2);border-radius:10px;margin-bottom:6px;font-size:12.5px">
          <div>
            <div style="font-weight:700">${esc(pm.vendorName || '—')} <span style="color:var(--text-3);font-size:11px">(${esc(pm.category || '')})</span></div>
            <div style="font-size:10.5px;color:var(--text-3)">${esc(pm.date || '—')} · ${esc(pm.method || 'Cash')}${pm.allocationName ? ' · ' + esc(pm.allocationName) : ''}</div>
          </div>
          <div style="font-weight:800;color:var(--red);font-size:14px">- ${fmt(pm.amount)}</div>
        </div>
      `).join('') : '<div style="padding:10px;background:var(--bg-2);border-radius:10px;font-size:12px;color:var(--text-3);text-align:center">No payments</div>'}
    </div>
  `;

  $('finDetailTitle').textContent = '📊 ' + (p.name || 'Package Details');
  $('finDetailBody').innerHTML = html;
  $('finDetailBody').dataset.pkgId = pkgId;
  openModal('financialDetailModal');
}

/* ==================== PRINT FINANCIAL DETAIL ==================== */
function printFinancialDetail() {
  window.print();
}