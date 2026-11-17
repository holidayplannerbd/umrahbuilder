/* ============================================================
   UMRAH BUILDER — BUILDER / FLIGHT (v5 — Combined Pricing)
   ⭐ Round Trip: আলাদা রুট, কিন্তু Combined Price
   ⭐ Adult, Child, Infant এর আলাদা Selling & Vendor Cost
   ============================================================ */

/* ==================== ADD FLIGHT ITEM ==================== */
function addFlightItem() {
  flightItems.push({
    id: ++fC,
    flightId: null,
    from: '',
    to: '',
    airline: '',
    tripType: 'round_trip',
    returnFrom: '',
    returnTo: '',
    returnAirline: '',
    
    // ⭐ Combined Pricing Fields (Adult/Child/Infant)
    fareAdult: 0,
    costAdult: 0,
    fareChild: 0,
    costChild: 0,
    fareInfant: 0,
    costInfant: 0,
    
    // Calculated Totals
    totalSell: 0,
    totalNet: 0,
    profit: 0
  });
  renderFlightsList();
  recalc();
}

/* ==================== REMOVE ==================== */
function removeFlightItem(id) {
  flightItems = flightItems.filter(f => f.id !== id);
  renderFlightsList();
  recalc();
}

/* ==================== ON FLIGHT CHANGE ==================== */
function onFlightItemChange(itemId, flightId) {
  const f = flightItems.find(x => x.id === itemId);
  if (!f) return;

  if (!flightId) {
    Object.assign(f, {
      flightId: null, from: '', to: '', airline: '', tripType: 'round_trip',
      returnFrom: '', returnTo: '', returnAirline: '',
      fareAdult: 0, costAdult: 0,
      fareChild: 0, costChild: 0,
      fareInfant: 0, costInfant: 0,
      totalSell: 0, totalNet: 0, profit: 0
    });
  } else {
    const dbF = STORE.flights.find(x => x.id === parseInt(flightId));
    if (!dbF) return;
    
    f.flightId = dbF.id;
    f.from = dbF.from;
    f.to = dbF.to;
    f.airline = dbF.airline;
    f.tripType = dbF.tripType || 'round_trip';
    f.returnFrom = dbF.returnFrom || '';
    f.returnTo = dbF.returnTo || '';
    f.returnAirline = dbF.returnAirline || '';
    
    // Combined Pricing
    f.fareAdult = dbF.fareAdult || dbF.fare || 0;
    f.costAdult = dbF.costAdult || dbF.netPrice || 0;
    f.fareChild = dbF.fareChild || 0;
    f.costChild = dbF.costChild || 0;
    f.fareInfant = dbF.fareInfant || 0;
    f.costInfant = dbF.costInfant || 0;
  }
  
  recalcFlightTotals(f);
  renderFlightsList();
  recalc();
}

function updateFlightSellPrice(itemId, passengerType, value) {
  const f = flightItems.find(item => item.id === itemId);
  const field = {
    adult: 'fareAdult',
    child: 'fareChild',
    infant: 'fareInfant'
  }[passengerType];
  if (!f || !field) return;

  f[field] = Math.max(0, parseFloat(value) || 0);
  renderFlightsList();
  recalc();
}

/* ==================== CALCULATE TOTALS ==================== */
function recalcFlightTotals(f) {
  if (!f) return;
  
  const paxAdult = intVal('paxAdult', 0);
  const paxChild = intVal('paxChild', 0);
  const paxInfant = intVal('paxInfant', 0);

  // ⭐ Adult, Child, Infant এর আলাদা দাম যোগ হবে
  f.totalSell = 
    ((f.fareAdult || 0) * paxAdult) + 
    ((f.fareChild || 0) * paxChild) + 
    ((f.fareInfant || 0) * paxInfant);
    
  f.totalNet = 
    ((f.costAdult || f.fareAdult || 0) * paxAdult) +
    ((f.costChild || f.fareChild || 0) * paxChild) +
    ((f.costInfant || f.fareInfant || 0) * paxInfant);
    
  f.profit = f.totalSell - f.totalNet;
}

/* ==================== RENDER FLIGHTS LIST ==================== */
function renderFlightsList() {
  const el = $('flightsList');
  if (!el) return;

  if ($('flightCount')) $('flightCount').textContent = flightItems.length;
  if (!flightItems.length) {
    el.innerHTML = '<div class="empty-slot"><span class="ic">✈</span>No flight</div>';
    return;
  }

  const opts = STORE.flights.map(f =>
    `<option value="${f.id}">${esc(f.from)} ${f.tripType === 'round_trip' ? '⇄' : '→'} ${esc(f.to)} — ${esc(f.airline || '')}</option>`
  ).join('');

  el.innerHTML = flightItems.map((f, i) => {
    recalcFlightTotals(f);

    const isRound = f.tripType === 'round_trip';
    const profitColor = f.profit >= 0 ? 'var(--green)' : 'var(--red)';
    const passengerPrices = [
      { type: 'adult', label: 'Adult', pax: intVal('paxAdult', 0), cost: f.costAdult, sell: f.fareAdult },
      { type: 'child', label: 'Child', pax: intVal('paxChild', 0), cost: f.costChild, sell: f.fareChild },
      { type: 'infant', label: 'Infant', pax: intVal('paxInfant', 0), cost: f.costInfant, sell: f.fareInfant }
    ];

    return `<div class="item-card">
      <div class="item-card-head">
        <span class="lbl">Flight ${i + 1}</span>
        <button class="remove-btn" onclick="removeFlightItem(${f.id})">✕</button>
      </div>
      
      <div class="field" style="margin-bottom:14px">
        <label>Select Flight</label>
        <select onchange="onFlightItemChange(${f.id},this.value)" data-selected="${f.flightId || ''}">
          <option value="">-- Choose Flight --</option>${opts}
        </select>
      </div>

      ${f.flightId ? `
        <div style="padding:10px 12px;background:var(--bg-2);border-radius:10px;margin-bottom:12px;font-size:11.5px;line-height:1.6">
          <b>${isRound ? '🔄 Round Trip' : '➡️ One Way'}</b><br>
          ${isRound 
            ? `Going: <b>${esc(f.from)} → ${esc(f.to)}</b><br>Return: <b>${esc(f.returnFrom || f.to)} → ${esc(f.returnTo || f.from)}</b>`
            : `${esc(f.from)} → ${esc(f.to)}`}
        </div>

        <div class="flight-pricing-grid">
          ${passengerPrices.map(p => `
            <div style="padding:10px 12px;background:var(--bg-2);border-radius:8px;min-width:0">
              <div style="font-size:11px;font-weight:800;margin-bottom:8px">${p.label} · ${p.pax}</div>
              <div style="font-size:10px;color:var(--blue);font-weight:700;margin-bottom:4px">Vendor / person: ${fmt(p.cost || 0)}</div>
              <label style="display:block;font-size:10px;color:var(--primary);font-weight:700;margin-bottom:4px">Sell / person</label>
              <input class="flight-sell-price" type="number" min="0" step="1" value="${p.sell || ''}" placeholder="0" onchange="updateFlightSellPrice(${f.id},'${p.type}',this.value)">
            </div>
          `).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px">
          <div style="padding:10px 12px;background:var(--blue-bg);border-radius:8px;text-align:center">
            <div style="font-size:9.5px;color:var(--blue);font-weight:800;text-transform:uppercase">Net (Vendor)</div>
            <div style="font-size:15px;font-weight:900;color:var(--blue);margin-top:2px">${fmt(f.totalNet)}</div>
          </div>
          <div style="padding:10px 12px;background:var(--primary-bg);border-radius:8px;text-align:center">
            <div style="font-size:9.5px;color:var(--primary);font-weight:800;text-transform:uppercase">Sell Total</div>
            <div style="font-size:15px;font-weight:900;color:var(--primary);margin-top:2px">${fmt(f.totalSell)}</div>
          </div>
          <div style="padding:10px 12px;background:${f.profit >= 0 ? 'var(--green-bg)' : 'var(--red-bg)'};border-radius:8px;text-align:center">
            <div style="font-size:9.5px;color:${profitColor};font-weight:800;text-transform:uppercase">Profit</div>
            <div style="font-size:15px;font-weight:900;color:${profitColor};margin-top:2px">${f.profit >= 0 ? '+' : ''}${fmt(f.profit)}</div>
          </div>
        </div>
      ` : ''}
    </div>`;
  }).join('');

  flightItems.forEach(f => {
    if (f.flightId) {
      const sel = el.querySelector(`select[data-selected="${f.flightId}"]`);
      if (sel) sel.value = f.flightId;
    }
  });
}