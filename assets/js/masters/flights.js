/* ============================================================
   UMRAH BUILDER — MASTERS / FLIGHTS (v2 — Combined Pricing)
   ============================================================ */

function toggleFlightForms() {
  const type = $('fsTripType')?.value || 'round_trip';
  const returnSec = $('returnFlightSection');
  if (returnSec) returnSec.style.display = type === 'round_trip' ? 'block' : 'none';
  
  const lbl = $('fsGoingLabel');
  if (lbl) lbl.textContent = type === 'round_trip' ? 'Going Flight' : 'Flight';
}

function openFlightSetup(editId = null) {
  if (editId) {
    const f = STORE.flights.find(x => x.id === editId);
    if (f) {
      $('flightModalTitle').textContent = '✏️ Edit Flight';
      $('fsEditId').value = editId;
      $('fsTripType').value = f.tripType || 'round_trip';
      
      $('fsFrom').value = f.from || '';
      $('fsTo').value = f.to || '';
      $('fsAirline').value = f.airline || '';
      
      $('fsReturnFrom').value = f.returnFrom || '';
      $('fsReturnTo').value = f.returnTo || '';
      $('fsReturnAirline').value = f.returnAirline || '';
      
      $('fsFareAdult').value = f.fareAdult || '';
      $('fsCostAdult').value = f.costAdult || '';
      $('fsFareChild').value = f.fareChild || '';
      $('fsCostChild').value = f.costChild || '';
      $('fsFareInfant').value = f.fareInfant || '';
      $('fsCostInfant').value = f.costInfant || '';
    }
  } else {
    $('flightModalTitle').textContent = '✈ Add Flight';
    $('fsEditId').value = '';
    $('fsTripType').value = 'round_trip';
    
    ['fsFrom','fsTo','fsAirline','fsReturnFrom','fsReturnTo','fsReturnAirline','fsFareAdult','fsCostAdult','fsFareChild','fsCostChild','fsFareInfant','fsCostInfant'].forEach(id => setVal(id, ''));
  }
  toggleFlightForms();
  clearAllErrors();
  openModal('flightSetupModal');
}

async function saveFlightSetup() {
  clearAllErrors();
  const from = $('fsFrom').value.trim();
  const to = $('fsTo').value.trim();
  const editId = $('fsEditId').value;
  const tripType = $('fsTripType')?.value || 'round_trip';

  let err = false;
  if (!from) { setError('fsFrom', 'From required'); err = true; }
  if (!to) { setError('fsTo', 'To required'); err = true; }
  if (err) { toast('Fill required fields', 'error'); return; }

  showLoading('Saving...');
  try {
    const data = {
      id: editId ? parseInt(editId) : Date.now(),
      tripType,
      from, to,
      airline: $('fsAirline').value.trim(),
      returnFrom: $('fsReturnFrom').value.trim(),
      returnTo: $('fsReturnTo').value.trim(),
      returnAirline: $('fsReturnAirline').value.trim(),
      
      // Combined Pricing
      fareAdult: parseFloat($('fsFareAdult').value) || 0,
      costAdult: parseFloat($('fsCostAdult').value) || 0,
      fareChild: parseFloat($('fsFareChild').value) || 0,
      costChild: parseFloat($('fsCostChild').value) || 0,
      fareInfant: parseFloat($('fsFareInfant').value) || 0,
      costInfant: parseFloat($('fsCostInfant').value) || 0,
      
      // Legacy fields for compatibility
      fare: parseFloat($('fsFareAdult').value) || 0,
      netPrice: parseFloat($('fsCostAdult').value) || 0,
      sellPrice: parseFloat($('fsFareAdult').value) || 0,
      
      createdAt: editId ? (STORE.flights.find(x => x.id === parseInt(editId))?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    await dbSave(STORES.flights, data);
    STORE.flights = await dbGetAll(STORES.flights);
    hideLoading();
    closeModal('flightSetupModal');
    renderFlightsTable();
    updateSidebarBadges();
    toast(editId ? '✅ Flight updated' : '✅ Flight saved');
  } catch (e) {
    hideLoading();
    toast('Save failed: ' + e.message, 'error');
  }
}

function deleteFlight(id) {
  const f = STORE.flights.find(x => x.id === id);
  if (!f) return;
  confirmDelete(`Delete flight "${f.from} → ${f.to}"?`, async () => {
    const idx = STORE.flights.findIndex(x => x.id === id);
    if (idx < 0) return;
    STORE.flights.splice(idx, 1);
    await dbDelete(STORES.flights, id);
    STORE.flights = await dbGetAll(STORES.flights);
    renderFlightsTable();
    updateSidebarBadges();
    toast('Flight deleted', 'warning');
  });
}

function renderFlightsTable() {
  const el = $('flightsTable');
  if (!el) return;
  const list = STORE.flights;

  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="ic">✈</div><div class="tx">No flights yet</div></div>';
    return;
  }

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Route</th><th>Type</th><th>Airline</th><th>Adult Sell</th><th>Child Sell</th><th>Infant Sell</th><th></th></tr></thead>
    <tbody>${list.map(f => {
      const routeLabel = f.tripType === 'round_trip' 
        ? `${esc(f.from)} → ${esc(f.to)} ⇄ ${esc(f.returnFrom || f.to)} → ${esc(f.returnTo || f.from)}`
        : `${esc(f.from)} → ${esc(f.to)}`;
        
      return `<tr>
        <td><div class="cell-main">${routeLabel}</div></td>
        <td><span class="pill ${f.tripType === 'round_trip' ? 'confirmed' : 'quoted'}">${f.tripType === 'round_trip' ? 'Round' : 'One Way'}</span></td>
        <td>${esc(f.airline) || '—'}</td>
        <td><strong>${fmt(f.fareAdult)}</strong></td>
        <td>${fmt(f.fareChild)}</td>
        <td>${fmt(f.fareInfant)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm btn-ghost btn-icon" onclick="openFlightSetup(${f.id})">✏️</button>
          <button class="btn btn-sm btn-ghost btn-icon" onclick="quickAddFlight(${f.id})">➕</button>
          <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteFlight(${f.id})">🗑️</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}