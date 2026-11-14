/* ============================================================
   UMRAH BUILDER — CHATBOT / ACCOUNTS ASSISTANT (Staff Only)
   Live Financial Data — Customer Due, Vendor Due, Cash, Refund
   ============================================================ */

/* ==================== TOGGLE (Staff Version) ==================== */
function toggleAccountsChatbot() {
  const panel = document.getElementById('accountsChatbotPanel');
  if (!panel) return;
  panel.classList.toggle('act');
  if (panel.classList.contains('act')) {
    setTimeout(() => document.getElementById('accountsChatbotInput')?.focus(), 300);
  }
}

/* ==================== RESET ==================== */
function accountsChatbotReset() {
  const wrap = document.getElementById('accountsChatbotMessages');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="chatbot-msg bot">
      <div class="chatbot-bubble">
        আসসালামু আলাইকুম! 👋<br>
        আমি আপনার <b>Accounts Assistant</b>।<br><br>
        <b>Try করুন:</b><br>
        <i>"customer due"</i> / <i>"কাস্টমার বাকি"</i><br>
        <i>"vendor due"</i> / <i>"ভেন্ডর বাকি"</i><br>
        <i>"cash in hand"</i> / <i>"হাতে কত"</i><br>
        <i>"total sale"</i> / <i>"মোট বিক্রি"</i>
      </div>
    </div>
    <div class="chatbot-quick-actions">
      <button class="chatbot-quick-btn" onclick="accChatAsk('customer_due')">📋 Customer Due</button>
      <button class="chatbot-quick-btn" onclick="accChatAsk('vendor_due')">💸 Vendor Due</button>
      <button class="chatbot-quick-btn" onclick="accChatAsk('cash')">💰 Cash</button>
      <button class="chatbot-quick-btn" onclick="accChatAsk('refund')">♻️ Refund</button>
      <button class="chatbot-quick-btn" onclick="accChatAsk('help')">❓ Help</button>
    </div>
  `;
}

/* ==================== ADD MESSAGE ==================== */
function accChatAddMsg(html, sender = 'bot') {
  const wrap = document.getElementById('accountsChatbotMessages');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'chatbot-msg ' + sender;
  div.innerHTML = sender === 'user'
    ? `<div class="chatbot-bubble">${esc(html)}</div>`
    : html;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

/* ==================== SEND ==================== */
function accountsChatbotSend() {
  const input = document.getElementById('accountsChatbotInput');
  const text = (input.value || '').trim();
  if (!text) return;
  accChatAddMsg(text, 'user');
  input.value = '';
  setTimeout(() => accChatProcess(text.toLowerCase()), 300);
}

/* ==================== QUICK ASK ==================== */
function accChatAsk(cmd) {
  const map = {
    customer_due: 'customer due',
    vendor_due: 'vendor due',
    cash: 'cash in hand',
    refund: 'refund list',
    help: 'help'
  };
  accountsChatbotSendText(map[cmd] || cmd);
}

function accountsChatbotSendText(text) {
  accChatAddMsg(text, 'user');
  setTimeout(() => accChatProcess(text.toLowerCase()), 300);
}

/* ==================== PROCESS QUERY ==================== */
function accChatProcess(text) {
  /* Help */
  if (/help|সাহায্য|হেল্প/i.test(text)) {
    accChatAddMsg(`
      <div class="chatbot-bubble">
        <b>🤖 আমি যা করতে পারি:</b><br><br>
        <b>1. Customer Due:</b><br>
        <i>"customer due"</i> / <i>"কাস্টমার বাকি"</i><br><br>

        <b>2. Vendor Due:</b><br>
        <i>"vendor due"</i> / <i>"ভেন্ডর বাকি"</i><br><br>

        <b>3. Cash in Hand:</b><br>
        <i>"cash in hand"</i> / <i>"হাতে কত"</i><br><br>

        <b>4. Total Sale:</b><br>
        <i>"total sale"</i> / <i>"মোট বিক্রি"</i><br><br>

        <b>5. Refund List:</b><br>
        <i>"refund list"</i> / <i>"রিফান্ড"</i><br><br>

        <b>6. Net Profit:</b><br>
        <i>"net profit"</i> / <i>"লাভ"</i><br><br>

        <b>7. Specific:</b><br>
        <i>"rahman due"</i> · <i>"swissotel due"</i>
      </div>
    `);
    return;
  }

  /* Customer Due */
  if (/customer\s*due|কাস্টমার\s*বাকি|কে\s*কত\s*বাকি/i.test(text)) {
    accChatCustomerDue();
    return;
  }

  /* Vendor Due */
  if (/vendor\s*due|ভেন্ডর\s*বাকি|vendor\s*bill/i.test(text)) {
    accChatVendorDue();
    return;
  }

  /* Cash in Hand */
  if (/cash\s*in\s*hand|হাতে\s*কত|cash\s*balance/i.test(text)) {
    accChatCashInHand();
    return;
  }

  /* Total Sale */
  if (/total\s*sale|মোট\s*বিক্রি|total\s*revenue/i.test(text)) {
    accChatTotalSale();
    return;
  }

  /* Refund */
  if (/refund|রিফান্ড|ফেরত/i.test(text)) {
    accChatRefundList();
    return;
  }

  /* Net Profit */
  if (/net\s*profit|লাভ|profit|margin/i.test(text)) {
    accChatNetProfit();
    return;
  }

  /* Specific customer due — "rahman due" */
  const custMatch = text.match(/^([a-z\u0980-\u09FF\s]+)\s*(due|বাকি)$/i);
  if (custMatch) {
    const name = custMatch[1].trim();
    if (accChatSpecificCustomer(name)) return;
  }

  /* Fallback */
  accChatAddMsg(`
    <div class="chatbot-bubble">
      আমি ঠিক বুঝতে পারিনি 🤔<br><br>
      Try করুন:
      <div class="chatbot-options">
        <button class="chatbot-option-btn" onclick="accChatAsk('customer_due')">Customer Due</button>
        <button class="chatbot-option-btn" onclick="accChatAsk('vendor_due')">Vendor Due</button>
        <button class="chatbot-option-btn" onclick="accChatAsk('cash')">Cash</button>
        <button class="chatbot-option-btn" onclick="accChatAsk('help')">Help</button>
      </div>
    </div>
  `);
}

/* ==================== CUSTOMER DUE ==================== */
function accChatCustomerDue() {
  if (typeof renderAccountsCustomerDue === 'function') {
    /* Group by customer */
    const map = {};
    STORE.packages.forEach(p => {
      if (p.status === 'Cancelled') return;
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
      if (due > 0) {
        rows.push({
          name: c.customerName,
          phone: c.customerPhone,
          due
        });
      }
    });

    rows.sort((a, b) => b.due - a.due);
    const total = rows.reduce((s, r) => s + r.due, 0);

    if (!rows.length) {
      accChatAddMsg(`<div class="chatbot-bubble">✅ সব Customer Clear! কোনো বাকি নেই।</div>`);
      return;
    }

    accChatAddMsg(`
      <div class="chatbot-bubble" style="max-width:100%">
        <b>📋 Customer Due List</b>
        <div style="font-size:11.5px;color:var(--text-3);margin-bottom:10px">${rows.length} জন customer এর বাকি আছে</div>
        ${rows.map((r, i) => `
          <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--red-bg);border-radius:8px;margin-bottom:5px;font-size:12.5px">
            <div>
              <div style="font-weight:700">${i + 1}. ${esc(r.name)}</div>
              ${r.phone ? `<div style="font-size:10.5px;color:var(--text-3)">📞 ${esc(r.phone)}</div>` : ''}
            </div>
            <div style="font-weight:900;color:var(--red);align-self:center">${fmt(r.due)}</div>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,var(--red-bg),var(--card));border-radius:10px;margin-top:8px;border:2px solid var(--red)">
          <b>Total Due:</b>
          <b style="color:var(--red);font-size:15px">${fmt(total)}</b>
        </div>
      </div>
    `);
  }
}

/* ==================== VENDOR DUE ==================== */
function accChatVendorDue() {
  /* Calculate vendor bills */
  const vendorBillMap = {};
  const activePackages = STORE.packages.filter(p => p.status !== 'Cancelled');

  activePackages.forEach(p => {
    if (typeof getPackageHotelVendorBreakdown === 'function') {
      try {
        const hotelRows = getPackageHotelVendorBreakdown(p);
        hotelRows.forEach(r => {
          if (!r.vendorId) return;
          if (!vendorBillMap[r.vendorId]) vendorBillMap[r.vendorId] = 0;
          vendorBillMap[r.vendorId] += Number(r.cost || 0);
        });
      } catch (e) {}
    }
  });

  const rows = [];
  STORE.vendors.forEach(v => {
    let paid = 0;
    (v.payments || []).forEach(pm => { paid += Number(pm.amount || 0); });
    const bill = vendorBillMap[v.id] || 0;
    const due = Math.max(0, bill - paid);
    if (due > 0) {
      rows.push({
        name: v.name,
        type: v.type || 'other',
        due
      });
    }
  });

  rows.sort((a, b) => b.due - a.due);
  const total = rows.reduce((s, r) => s + r.due, 0);

  if (!rows.length) {
    accChatAddMsg(`<div class="chatbot-bubble">✅ সব Vendor Clear! কোনো বাকি নেই।</div>`);
    return;
  }

  const typeIcons = { hotel: '🕌', transport: '▣', visa: '▤', ziyarah: '★', service: '▦', other: '📦' };

  accChatAddMsg(`
    <div class="chatbot-bubble" style="max-width:100%">
      <b>💸 Vendor Due List</b>
      <div style="font-size:11.5px;color:var(--text-3);margin-bottom:10px">${rows.length} জন vendor কে দিতে হবে</div>
      ${rows.map((r, i) => `
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--amber-bg);border-radius:8px;margin-bottom:5px;font-size:12.5px">
          <div>
            <div style="font-weight:700">${i + 1}. ${typeIcons[r.type] || '🏢'} ${esc(r.name)}</div>
            <div style="font-size:10.5px;color:var(--text-3)">${esc(r.type).toUpperCase()}</div>
          </div>
          <div style="font-weight:900;color:var(--amber);align-self:center">${fmt(r.due)}</div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,var(--amber-bg),var(--card));border-radius:10px;margin-top:8px;border:2px solid var(--amber)">
        <b>Total Due:</b>
        <b style="color:var(--amber);font-size:15px">${fmt(total)}</b>
      </div>
    </div>
  `);
}

/* ==================== CASH IN HAND ==================== */
function accChatCashInHand() {
  const t = calcAccountsTotals();
  accChatAddMsg(`
    <div class="chatbot-bubble" style="max-width:100%">
      <b>💰 Cash in Hand</b>
      <div style="padding:14px;background:linear-gradient(135deg,var(--blue-bg),var(--card));border-radius:10px;margin-top:10px;border:2px solid var(--blue);text-align:center">
        <div style="font-size:32px;font-weight:900;color:var(--blue)">${fmt(t.cashInHand)}</div>
      </div>
      <div style="margin-top:12px;font-size:12px;line-height:1.8">
        <div>🟢 Customer Paid: <b>${fmt(t.customerPaid)}</b></div>
        <div>✅ Vendor Paid: <b>${fmt(t.vendorPaid)}</b></div>
        <div>♻️ Refund: <b>${fmt(t.totalRefund)}</b></div>
      </div>
    </div>
  `);
}

/* ==================== TOTAL SALE ==================== */
function accChatTotalSale() {
  const t = calcAccountsTotals();
  accChatAddMsg(`
    <div class="chatbot-bubble" style="max-width:100%">
      <b>💰 Total Sale</b>
      <div style="padding:14px;background:linear-gradient(135deg,var(--green-bg),var(--card));border-radius:10px;margin-top:10px;border:2px solid var(--green);text-align:center">
        <div style="font-size:28px;font-weight:900;color:var(--green)">${fmt(t.totalSale)}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">Active Packages থেকে</div>
      </div>
      <div style="margin-top:12px;font-size:12px;line-height:1.8">
        <div>📦 Active Packages: <b>${STORE.packages.filter(p => p.status !== 'Cancelled').length}</b></div>
        <div>💰 Customer Paid: <b style="color:var(--green)">${fmt(t.customerPaid)}</b></div>
        <div>🔴 Customer Due: <b style="color:var(--red)">${fmt(t.customerDue)}</b></div>
      </div>
    </div>
  `);
}

/* ==================== REFUND LIST ==================== */
async function accChatRefundList() {
  if (typeof loadRefunds === 'function') await loadRefunds();
  const list = (refundsCache || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!list.length) {
    accChatAddMsg(`<div class="chatbot-bubble">✅ কোনো Refund History নেই।</div>`);
    return;
  }

  const total = list.reduce((s, r) => s + Number(r.amount || 0), 0);

  accChatAddMsg(`
    <div class="chatbot-bubble" style="max-width:100%">
      <b>♻️ Refund History</b>
      <div style="font-size:11.5px;color:var(--text-3);margin-bottom:10px">${list.length} টি refund</div>
      ${list.slice(0, 10).map(r => `
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--red-bg);border-radius:8px;margin-bottom:5px;font-size:12.5px">
          <div>
            <div style="font-weight:700">${esc(r.customerName)}</div>
            <div style="font-size:10.5px;color:var(--text-3)">${esc(r.date || '—')} · ${esc(r.reason || 'Refund')}</div>
          </div>
          <div style="font-weight:900;color:var(--red);align-self:center">- ${fmt(r.amount)}</div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,var(--red-bg),var(--card));border-radius:10px;margin-top:8px;border:2px solid var(--red)">
        <b>Total Refund:</b>
        <b style="color:var(--red);font-size:15px">${fmt(total)}</b>
      </div>
    </div>
  `);
}

/* ==================== NET PROFIT ==================== */
function accChatNetProfit() {
  const t = calcAccountsTotals();
  accChatAddMsg(`
    <div class="chatbot-bubble" style="max-width:100%">
      <b>📈 Net Profit</b>
      <div style="padding:14px;background:linear-gradient(135deg,var(--green-bg),var(--card));border-radius:10px;margin-top:10px;border:2px solid var(--green);text-align:center">
        <div style="font-size:28px;font-weight:900;color:var(--green)">${fmt(t.netProfit)}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px">Margin: ${t.profitMargin.toFixed(1)}%</div>
      </div>
      <div style="margin-top:12px;font-size:12px;line-height:1.8">
        <div>💰 Total Sale: <b>${fmt(t.totalSale)}</b></div>
        <div>💸 Vendor Cost: <b style="color:var(--red)">- ${fmt(t.vendorBill)}</b></div>
        <div>♻️ Refund: <b style="color:var(--red)">- ${fmt(t.totalRefund)}</b></div>
      </div>
    </div>
  `);
}

/* ==================== SPECIFIC CUSTOMER ==================== */
function accChatSpecificCustomer(searchName) {
  const nameLower = searchName.toLowerCase();
  const map = {};
  STORE.packages.forEach(p => {
    if (p.status === 'Cancelled') return;
    if (!p.customerName || !p.customerName.toLowerCase().includes(nameLower)) return;
    const key = p.customerId || p.customerPhone || p.customerName;
    if (!map[key]) {
      map[key] = {
        customerId: p.customerId,
        customerName: p.customerName,
        customerPhone: p.customerPhone || '',
        packages: []
      };
    }
    map[key].packages.push(p);
  });

  const keys = Object.keys(map);
  if (!keys.length) return false;

  const c = map[keys[0]];
  let bill = 0, paid = 0;
  c.packages.forEach(p => { bill += Number(p.grandTotal || 0); });

  STORE.customers.forEach(cu => {
    const match = (c.customerId && cu.id === c.customerId) ||
                  (c.customerPhone && cu.phone === c.customerPhone);
    if (!match) return;
    (cu.payments || []).forEach(pm => { paid += Math.max(0, Number(pm.amount || 0)); });
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

  accChatAddMsg(`
    <div class="chatbot-bubble" style="max-width:100%">
      <b>👤 ${esc(c.customerName)}</b>
      ${c.customerPhone ? `<div style="font-size:11.5px;color:var(--text-3)">📞 ${esc(c.customerPhone)}</div>` : ''}
      <div style="margin-top:12px;font-size:12.5px;line-height:1.9">
        <div>📦 Packages: <b>${c.packages.length}</b></div>
        <div>💰 Total Bill: <b>${fmt(bill)}</b></div>
        <div>🟢 Paid: <b style="color:var(--green)">${fmt(paid)}</b></div>
        <div style="padding:8px 10px;background:${due > 0 ? 'var(--red-bg)' : 'var(--green-bg)'};border-radius:8px;margin-top:6px">
          <b>${due > 0 ? '🔴 Due' : '✅ Clear'}:</b>
          <b style="color:${due > 0 ? 'var(--red)' : 'var(--green)'};font-size:15px">${fmt(due)}</b>
        </div>
      </div>
    </div>
  `);

  return true;
}

/* ==================== OUTSIDE CLICK ==================== */
document.addEventListener('click', e => {
  const panel = document.getElementById('accountsChatbotPanel');
  const fab = document.getElementById('accountsChatbotFab');
  if (!panel || !fab) return;
  if (!panel.classList.contains('act')) return;
  if (panel.contains(e.target) || fab.contains(e.target)) return;

  const tag = (e.target.tagName || '').toLowerCase();
  if (['select', 'option', 'input', 'textarea', 'button', 'label'].includes(tag)) return;
  if (e.target.closest('.chatbot-messages')) return;
  if (e.target.closest('.chatbot-options')) return;

  panel.classList.remove('act');
});