/* ============================================================
   UMRAH BUILDER — BUILDER / VISA
   Visa items add/remove/change + list render
   ============================================================ */

/* ==================== ADD VISA ITEM ==================== */
function addVisaItem() {
  visaItems.push({
    id: ++vC,
    visaId: null,
    name: '',
    priceAdult: 0,
    priceChild: 0,
    priceInfant: 0,
    price: 0,
    costAdult: 0,
    costChild: 0,
    costInfant: 0
  });
  renderVisasList();
  recalc();
}

/* ==================== REMOVE VISA ITEM ==================== */
function removeVisaItem(id) {
  visaItems = visaItems.filter(v => v.id !== id);
  renderVisasList();
  recalc();
}

/* ==================== ON VISA CHANGE ==================== */
function onVisaItemChange(itemId, visaId) {
  const v = visaItems.find(x => x.id === itemId);
  if (!v) return;

  if (!visaId) {
    v.paymentItemId = createPaymentItemId('visa');
    v.visaId = null;
    v.name = '';
    v.priceAdult = 0;
    v.priceChild = 0;
    v.priceInfant = 0;
    v.price = 0;
    v.costAdult = 0;
    v.costChild = 0;
    v.costInfant = 0;
    v.vendorId = '';
  } else {
    const dbV = STORE.visas.find(x => x.id === parseInt(visaId));
    if (!dbV) return;
    if (String(v.visaId || '') !== String(dbV.id)) {
      v.paymentItemId = createPaymentItemId('visa');
    }
    v.visaId = dbV.id;
    v.name = dbV.name;
    v.priceAdult = dbV.priceAdult || dbV.price || 0;
    v.priceChild = dbV.priceChild || 0;
    v.priceInfant = dbV.priceInfant || 0;
    v.price = v.priceAdult;
    v.costAdult = dbV.costAdult || 0;
    v.costChild = dbV.costChild || 0;
    v.costInfant = dbV.costInfant || 0;
    v.vendorId = dbV.vendorId || '';
  }
  renderVisasList();
  recalc();
}

/* ==================== RENDER VISAS LIST ==================== */
function renderVisasList() {
  const el = $('visasList');
  if (!el) return;

  if ($('visaCount')) $('visaCount').textContent = visaItems.length;
  if (!visaItems.length) {
    el.innerHTML = '<div class="empty-slot"><span class="ic">▤</span>No visa</div>';
    return;
  }

  const opts = STORE.visas.map(v =>
    `<option value="${v.id}">${esc(v.name)} — ${fmt(v.priceAdult || v.price || 0)}</option>`
  ).join('');

  el.innerHTML = visaItems.map((v, i) => {
    const totalPax = intVal('paxAdult', 0) +
                     intVal('paxChild', 0) +
                     intVal('paxInfant', 0);
    const sellTotal = (v.priceAdult || v.price || 0) * totalPax;
    const costTotal = (v.costAdult || 0) * totalPax;

    return `<div class="item-card">
      <div class="item-card-head">
        <span class="lbl">Visa ${i + 1}</span>
        <button class="remove-btn" onclick="removeVisaItem(${v.id})">✕</button>
      </div>
      <div class="field" style="margin-bottom:14px">
        <label>Select Visa</label>
        <select onchange="onVisaItemChange(${v.id},this.value)" data-selected="${v.visaId || ''}">
          <option value="">-- Choose Visa --</option>${opts}
        </select>
      </div>
      ${v.visaId ? renderPackageItemVendorSelect('visa', v) : ''}
      ${v.visaId ? `
        <div class="grid-2">
          <div class="field">
            <label>Sell Total</label>
            <input type="text" value="${fmt(sellTotal)}" readonly>
          </div>
          <div class="field">
            <label>Vendor Cost Total</label>
            <input type="text" value="${fmt(costTotal)}" readonly>
          </div>
        </div>
      ` : ''}
    </div>`;
  }).join('');

  visaItems.forEach(v => {
    if (v.visaId) {
      const sel = el.querySelector(`select[data-selected="${v.visaId}"]`);
      if (sel) sel.value = v.visaId;
    }
  });
}