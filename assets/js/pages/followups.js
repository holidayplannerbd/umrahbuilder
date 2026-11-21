/* ============================================================
   UMRAH BUILDER — FOLLOWUPS (v5 — Kanban Pipeline)
   ⭐ Drag-drop kanban + Avatar team + Card design
   ============================================================ */

let followViewMode = 'kanban';       // 'kanban' | 'list'
let followKanbanSortable = null;

/* ==================== LOAD TEAM MEMBERS ==================== */
async function loadTeamMembers() {
  try {
    if (typeof dbGetAllUserProfiles === 'function') {
      const profiles = await dbGetAllUserProfiles();
      const list = [];
      Object.values(profiles || {}).forEach(p => {
        if (p.uid) {
          list.push({
            id: p.uid,
            name: p.name || p.email?.split('@')[0] || 'User',
            role: p.role || 'staff',
            photo: p.photo || ''
          });
        }
      });
      if (list.length) TEAM_MEMBERS = list;
    }
  } catch (e) {
    console.warn('loadTeamMembers failed:', e);
  }
}

/* ==================== SWITCH TAB ==================== */
function switchFollowTab(tab) {
  currentFollowTab = tab;
  const pkgTab = $('followTabPackage');
  const leadTab = $('followTabLead');

  if (pkgTab) {
    pkgTab.classList.toggle('btn-secondary', tab === 'package');
    pkgTab.classList.toggle('btn-ghost', tab !== 'package');
  }
  if (leadTab) {
    leadTab.classList.toggle('btn-secondary', tab === 'lead');
    leadTab.classList.toggle('btn-ghost', tab !== 'lead');
  }

  /* Show/hide kanban vs package list */
  const kanban = $('fkKanban');
  const list = $('fkList');
  const filters = $('fkFilters');

  if (tab === 'package') {
    if (kanban) kanban.style.display = 'none';
    if (list) {
      list.style.display = 'block';
      list.innerHTML = '<div style="padding:20px;color:var(--text-3);text-align:center">Loading packages...</div>';
    }
    if (filters) filters.style.display = 'none';
    renderPackageFollowTab();
  } else {
    if (kanban) kanban.style.display = followViewMode === 'kanban' ? 'flex' : 'none';
    if (list) list.style.display = followViewMode === 'list' ? 'block' : 'none';
    if (filters) filters.style.display = 'flex';
    renderFollowups();
  }
}

/* ==================== SWITCH VIEW MODE ==================== */
function switchFollowView(mode) {
  followViewMode = mode;
  document.querySelectorAll('.fk-view-btn').forEach(b => b.classList.remove('act'));
  const btn = mode === 'kanban' ? $('fkViewKanban') : $('fkViewList');
  if (btn) btn.classList.add('act');

  const kanban = $('fkKanban');
  const list = $('fkList');
  if (kanban) kanban.style.display = mode === 'kanban' ? 'flex' : 'none';
  if (list) list.style.display = mode === 'list' ? 'block' : 'none';

  renderFollowups();
}

/* ==================== OPEN FOLLOW SETUP ==================== */
function openFollowSetup(editId = null, presetStatus = null) {
  const teamSelect = $('followAssigned');
  if (teamSelect) {
    teamSelect.innerHTML = '<option value="">-- Unassigned --</option>' +
      TEAM_MEMBERS.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  }

  const sourceSelect = $('followSource');
  if (sourceSelect) {
    sourceSelect.innerHTML = '<option value="">-- Select Source --</option>' +
      LEAD_SOURCES.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
  }

  const lostSelect = $('followLostReason');
  if (lostSelect) {
    lostSelect.innerHTML = '<option value="">-- Not Lost --</option>' +
      LOST_REASONS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  }

  if (editId) {
    const f = STORE.followups.find(x => x.id === editId);
    if (f) {
      $('followModalTitle').textContent = '✏️ Edit Follow-up';
      $('followEditId').value = editId;
      $('followType').value = f.type || 'lead';
      $('followName').value = f.name || '';
      $('followPhone').value = f.phone || '';
      $('followEmail').value = f.email || '';
      $('followDate').value = f.date || '';
      $('followNextDate').value = f.nextDate || '';
      $('followTime').value = f.time || '';
      $('followPriority').value = f.priority || 'medium';
      $('followStatus').value = f.status || 'new';
      $('followSubject').value = f.subject || '';
      $('followNotes').value = f.notes || '';
      $('followEstValue').value = f.estimatedValue || '';

      if ($('followAssigned')) $('followAssigned').value = f.assignedTo || '';
      if ($('followSource')) $('followSource').value = f.source || '';
      if ($('followLostReason')) $('followLostReason').value = f.lostReason || '';
      if ($('followTags')) $('followTags').value = (f.tags || []).join(', ');
    }
  } else {
    $('followModalTitle').textContent = '🔔 Add Follow-up';
    $('followEditId').value = '';
    ['followName', 'followPhone', 'followEmail', 'followSubject', 'followNotes', 'followTime',
     'followNextDate', 'followEstValue', 'followTags'].forEach(id => setVal(id, ''));
    setVal('followType', 'lead');
    setVal('followDate', today());
    setVal('followPriority', 'medium');
    setVal('followStatus', presetStatus || 'new');
    if ($('followAssigned')) $('followAssigned').value = '';
    if ($('followSource')) $('followSource').value = '';
    if ($('followLostReason')) $('followLostReason').value = '';
  }
  clearAllErrors();
  openModal('followSetupModal');
}

/* ==================== SAVE FOLLOW ==================== */
async function saveFollowSetup() {
  clearAllErrors();
  const name = strVal('followName');
  const phone = strVal('followPhone');
  const date = strVal('followDate');
  const editId = strVal('followEditId');

  let err = false;
  if (!name) { setError('followName', 'Name required'); err = true; }
  if (!phone) { setError('followPhone', 'Phone required'); err = true; }
  if (!date) { setError('followDate', 'Date required'); err = true; }
  if (err) { toast('Fill required fields', 'error'); return; }

  if (!editId) {
    const dup = STORE.followups.find(f =>
      f.phone && f.phone === phone && !f.completed
    );
    if (dup) {
      if (!confirm(`⚠️ Same phone already exists:\n\n👤 ${dup.name}\n📞 ${dup.phone}\n\nCreate anyway?`)) {
        return;
      }
    }
  }

  showLoading('Saving...');
  try {
    const existing = editId ? STORE.followups.find(x => x.id === parseInt(editId)) : null;
    const status = strVal('followStatus', 'new');

    const data = {
      id: editId ? parseInt(editId) : Date.now(),
      type: strVal('followType', 'lead'),
      name,
      phone,
      email: strVal('followEmail'),
      date,
      nextDate: strVal('followNextDate'),
      time: strVal('followTime'),
      priority: strVal('followPriority', 'medium'),
      status,
      assignedTo: strVal('followAssigned'),
      source: strVal('followSource'),
      estimatedValue: parseFloat(strVal('followEstValue')) || 0,
      tags: strVal('followTags').split(',').map(s => s.trim()).filter(Boolean),
      lostReason: status === 'lost' ? strVal('followLostReason') : '',
      subject: strVal('followSubject'),
      notes: strVal('followNotes'),
      completed: status === 'won' || status === 'lost' || existing?.completed || false,
      activities: existing?.activities || [],
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: existing?.createdBy || window.firebaseAuth?.currentUser?.uid || null
    };

    await dbSave(STORES.followups, data);
    STORE.followups = await dbGetAll(STORES.followups);
    hideLoading();
    closeModal('followSetupModal');
    renderFollowups();
    updateSidebarBadges();

    if (typeof addNotification === 'function' && !editId) {
      addNotification({
        type: 'lead_created',
        icon: '👤',
        message: `👤 New lead: <b>${esc(name)}</b>${data.assignedTo ? ' → ' + esc(getAssignedName(data.assignedTo)) : ''}`,
        link: 'followups'
      });
    }

    toast(editId ? '✅ Follow-up updated' : '✅ Follow-up saved');
  } catch (e) {
    hideLoading();
    toast('Save failed: ' + e.message, 'error');
  }
}

/* ==================== HELPERS ==================== */
function getAssignedName(uid) {
  if (!uid) return 'Unassigned';
  const m = TEAM_MEMBERS.find(x => String(x.id) === String(uid));
  return m?.name || 'Unknown';
}

function getAssignedPhoto(uid) {
  if (!uid) return '';
  const m = TEAM_MEMBERS.find(x => String(x.id) === String(uid));
  return m?.photo || '';
}

/* ==================== DELETE ==================== */
function deleteFollowup(id) {
  const f = STORE.followups.find(x => x.id === id);
  if (!f) return;
  confirmDelete(`Delete follow-up for "${f.name}"?`, async () => {
    STORE.followups = STORE.followups.filter(x => x.id !== id);
    await dbDelete(STORES.followups, id);
    STORE.followups = await dbGetAll(STORES.followups);
    followBulkSelected.delete(id);
    renderFollowups();
    updateSidebarBadges();
    toast('Follow-up deleted', 'warning');
  });
}

/* ==================== STATUS UPDATE ==================== */
async function updateFollowStatus(id, newStatus) {
  const f = STORE.followups.find(x => x.id === id);
  if (!f) return;
  f.status = newStatus;
  if (newStatus === 'won' || newStatus === 'lost') f.completed = true;
  else f.completed = false;
  f.updatedAt = Date.now();
  await dbSave(STORES.followups, f);
  STORE.followups = await dbGetAll(STORES.followups);
  renderFollowups();
  updateSidebarBadges();
  toast(`✅ ${LEAD_STATUSES[newStatus]?.label || newStatus}`, 'success');
}

/* ==================== ACTIVITY LOG ==================== */
function openActivityLog(followupId) {
  const f = STORE.followups.find(x => x.id === followupId);
  if (!f) return;
  currentFollowupActivityId = followupId;

  const activities = (f.activities || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const typeIcons = { call: '📞', whatsapp: '💬', meeting: '🤝', email: '✉️', note: '📝', other: '📌' };

  const listHtml = activities.length
    ? activities.map(a => `
        <div style="padding:12px 14px;background:var(--bg-2);border-radius:10px;margin-bottom:8px;border-left:3px solid ${a.type === 'call' ? 'var(--blue)' : a.type === 'whatsapp' ? 'var(--green)' : a.type === 'meeting' ? 'var(--purple)' : 'var(--amber)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1">
              <div style="font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:6px">
                <span>${typeIcons[a.type] || '📌'}</span>
                <span>${esc(a.type.charAt(0).toUpperCase() + a.type.slice(1))}</span>
              </div>
              <div style="font-size:11.5px;color:var(--text-2);margin-top:4px;line-height:1.5">${esc(a.note)}</div>
              <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">
                📅 ${esc(a.date || '—')}${a.duration ? ' · ⏱️ ' + esc(a.duration) : ''} · 👤 ${esc(a.byName || 'Unknown')}
              </div>
            </div>
            <button class="btn btn-xs btn-ghost btn-icon" onclick="deleteActivity('${a.id}', event)" title="Delete">🗑️</button>
          </div>
        </div>
      `).join('')
    : '<div style="text-align:center;padding:30px;color:var(--text-3);font-size:12px">📋 No activities yet — log your first call!</div>';

  const html = `
    <div class="modal-bg act" id="activityLogModal" style="z-index:10000">
      <div class="modal narrow">
        <div class="modal-head">
          <h2>📋 Activity Log — ${esc(f.name)}</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div style="padding:14px;background:linear-gradient(135deg,var(--primary-bg),var(--card));border-radius:12px;margin-bottom:16px;border:1px solid var(--primary-light)">
            <div style="font-size:13px;font-weight:800">${esc(f.name)}</div>
            <div style="font-size:11.5px;color:var(--text-2);margin-top:2px">📞 ${esc(f.phone)}</div>
          </div>

          <div class="grid-2" style="margin-bottom:14px">
            <div class="field">
              <label>Type</label>
              <select id="actType">
                <option value="call">📞 Phone Call</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="meeting">🤝 Meeting</option>
                <option value="email">✉️ Email</option>
                <option value="note">📝 Note</option>
                <option value="other">📌 Other</option>
              </select>
            </div>
            <div class="field"><label>Date</label><input type="date" id="actDate"></div>
            <div class="field"><label>Duration (optional)</label><input type="text" id="actDuration" placeholder="e.g., 15 min"></div>
            <div class="field">
              <label>Outcome</label>
              <select id="actOutcome">
                <option value="">-- No change --</option>
                <option value="contacted">→ Contacted</option>
                <option value="interested">→ Interested</option>
                <option value="negotiating">→ Negotiating</option>
                <option value="won">→ Won</option>
                <option value="lost">→ Lost</option>
              </select>
            </div>
          </div>

          <div class="field" style="margin-bottom:14px">
            <label>Note *</label>
            <textarea id="actNote" rows="3" placeholder="What happened? Next action?" style="min-height:80px"></textarea>
          </div>

          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:20px" onclick="saveActivity()">
            ➕ Log Activity
          </button>

          <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-2);margin-bottom:10px">
            History (${activities.length})
          </div>
          <div>${listHtml}</div>
        </div>
        <div class="modal-foot">
          <div></div>
          <div class="right-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
  if ($('actDate')) $('actDate').value = today();
}

async function saveActivity() {
  const followupId = currentFollowupActivityId;
  if (!followupId) return;
  const f = STORE.followups.find(x => x.id === followupId);
  if (!f) return;

  const note = ($('actNote')?.value || '').trim();
  if (!note) { toast('Note required', 'error'); return; }

  const user = window.firebaseAuth?.currentUser;
  const profile = await dbGetUserProfile().catch(() => ({})) || {};
  const byName = profile.name || user?.displayName || user?.email?.split('@')[0] || 'Unknown';

  const activity = {
    id: 'act_' + Date.now(),
    type: $('actType')?.value || 'note',
    date: $('actDate')?.value || today(),
    duration: $('actDuration')?.value || '',
    note,
    outcome: $('actOutcome')?.value || '',
    by: user?.uid || null,
    byName,
    createdAt: Date.now()
  };

  if (!f.activities) f.activities = [];
  f.activities.push(activity);

  if (activity.outcome) {
    f.status = activity.outcome;
    if (activity.outcome === 'won' || activity.outcome === 'lost') f.completed = true;
    else f.completed = false;
  }

  f.updatedAt = Date.now();
  await dbSave(STORES.followups, f);
  STORE.followups = await dbGetAll(STORES.followups);

  document.getElementById('activityLogModal')?.remove();
  openActivityLog(followupId);
  renderFollowups();
  toast('✅ Activity logged');
}

async function deleteActivity(activityId, event) {
  if (event) event.stopPropagation();
  const followupId = currentFollowupActivityId;
  if (!followupId) return;
  const f = STORE.followups.find(x => x.id === followupId);
  if (!f) return;
  if (!confirm('Delete this activity?')) return;

  f.activities = (f.activities || []).filter(a => a.id !== activityId);
  f.updatedAt = Date.now();
  await dbSave(STORES.followups, f);
  STORE.followups = await dbGetAll(STORES.followups);
  document.getElementById('activityLogModal')?.remove();
  openActivityLog(followupId);
  toast('Activity deleted', 'warning');
}

/* ==================== FILTERS ==================== */
function followFilterAssignedChange(v) { followFilterAssigned = v || 'all'; renderFollowups(); }
function followFilterStatusChange(v) { followFilterStatus = v || 'all'; renderFollowups(); }
function followFilterPriorityChange(v) { followFilterPriority = v || 'all'; renderFollowups(); }
function followFilterDateChange(v) { followFilterDateRange = v || 'all'; renderFollowups(); }
function followSearchChange(v) { followSearchQuery = String(v || '').toLowerCase(); renderFollowups(); }

function clearFollowFilters() {
  followFilterAssigned = 'all';
  followFilterStatus = 'all';
  followFilterPriority = 'all';
  followFilterDateRange = 'all';
  followSearchQuery = '';
  ['followFilterAssigned', 'followFilterPriority', 'followFilterDate'].forEach(id => {
    const el = $(id);
    if (el) el.value = 'all';
  });
  const searchEl = $('followSearchInput');
  if (searchEl) searchEl.value = '';
  renderFollowups();
}

function getFilteredFollowups() {
  const todayStr = today();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  let list = STORE.followups.slice();

  if (followFilterAssigned !== 'all') {
    list = list.filter(f => String(f.assignedTo || '') === String(followFilterAssigned));
  }
  if (followFilterPriority !== 'all') {
    list = list.filter(f => (f.priority || 'medium') === followFilterPriority);
  }
  if (followFilterDateRange === 'today') {
    list = list.filter(f => f.date === todayStr && !f.completed);
  } else if (followFilterDateRange === 'week') {
    list = list.filter(f => f.date && f.date >= todayStr && f.date <= weekEndStr && !f.completed);
  } else if (followFilterDateRange === 'overdue') {
    list = list.filter(f => f.date && f.date < todayStr && !f.completed);
  }

  if (followSearchQuery) {
    const q = followSearchQuery;
    list = list.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.phone || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q) ||
      (f.subject || '').toLowerCase().includes(q) ||
      (f.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  return list;
}

/* ==================== MAIN RENDER ==================== */
function renderFollowups() {
  if (currentFollowTab === 'package') {
    renderPackageFollowTab();
    return;
  }

  /* Populate team dropdown */
  const assignedEl = $('followFilterAssigned');
  if (assignedEl && TEAM_MEMBERS.length) {
    const cur = assignedEl.value;
    assignedEl.innerHTML = '<option value="all">👥 All Team</option>' +
      TEAM_MEMBERS.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    assignedEl.value = cur || 'all';
  }

  /* Header sub */
  const allFollowups = STORE.followups || [];
  const activeCount = allFollowups.filter(f => !f.completed).length;
  const wonCount = allFollowups.filter(f => f.status === 'won').length;
  const totalValue = allFollowups.filter(f => !f.completed).reduce((s, f) => s + (Number(f.estimatedValue) || 0), 0);
  const subEl = $('fkHeaderSub');
  if (subEl) {
    subEl.innerHTML = `<span class="fk-live-dot"></span> ${activeCount} active · 💰 ৳${totalValue.toLocaleString()} · ✅ ${wonCount} won`;
  }

  const filtered = getFilteredFollowups();

  if (followViewMode === 'kanban') {
    renderKanban(filtered);
  } else {
    renderListView(filtered);
  }
}

/* ==================== KANBAN RENDER ==================== */
function renderKanban(filtered) {
  const el = $('fkKanban');
  if (!el) return;

  const todayStr = today();

  /* Group by status */
  const groups = {};
  Object.keys(LEAD_STATUSES).forEach(k => groups[k] = []);
  filtered.forEach(f => {
    const s = f.status || 'new';
    if (groups[s]) groups[s].push(f);
    else groups['new'].push(f);
  });

  el.innerHTML = Object.entries(LEAD_STATUSES).map(([key, cfg]) => {
    const leads = groups[key];
    return `
      <div class="fk-column" data-status="${key}">
        <div class="fk-column-head" style="background:${cfg.bg};border-color:${cfg.color}44">
          <div class="fk-column-head-left">
            <span class="fk-column-icon" style="color:${cfg.color}">${cfg.icon}</span>
            <span class="fk-column-title" style="color:${cfg.color}">${cfg.label}</span>
          </div>
          <span class="fk-column-count" style="background:${cfg.color};color:#fff">${leads.length}</span>
        </div>

        <div class="fk-column-body" data-status="${key}">
          ${leads.length ? leads.map(f => renderKanbanCard(f, todayStr)).join('') : '<div class="fk-empty-col">No leads</div>'}
        </div>

        <button class="fk-add-card" onclick="openFollowSetup(null, '${key}')">
          <span>➕</span> Add Card
        </button>
      </div>
    `;
  }).join('');

  /* Init drag-drop */
  initKanbanSortable();
}

function renderKanbanCard(f, todayStr) {
  const isOverdue = f.date < todayStr && !f.completed;
  const isToday = f.date === todayStr && !f.completed;
  const assignedName = getAssignedName(f.assignedTo);
  const assignedPhoto = getAssignedPhoto(f.assignedTo);
  const priorityLabel = { low: '🟢', medium: '🟡', high: '🔴' }[f.priority || 'medium'];
  const activityCount = (f.activities || []).length;
  const sourceLabel = f.source ? LEAD_SOURCES.find(s => s.id === f.source)?.label : '';

  return `
    <div class="fk-card" data-id="${f.id}" onclick="openFollowSetup(${f.id})">
      <div class="fk-card-head">
        <div class="fk-card-avatar ${assignedPhoto ? 'has-photo' : ''}">
          ${assignedPhoto
            ? `<img src="${assignedPhoto}" alt="">`
            : `<span>${(assignedName[0] || '?').toUpperCase()}</span>`}
        </div>
        <div class="fk-card-title-wrap">
          <div class="fk-card-name">${esc(f.name)}</div>
          <div class="fk-card-phone">📞 ${esc(f.phone)}</div>
        </div>
        <div class="fk-card-priority">${priorityLabel}</div>
      </div>

      ${f.subject ? `<div class="fk-card-subject">${esc(f.subject)}</div>` : ''}

      ${f.estimatedValue ? `
        <div class="fk-card-value">
          💰 ৳ ${Number(f.estimatedValue).toLocaleString()}
        </div>
      ` : ''}

      <div class="fk-card-meta">
        ${f.date ? `<span class="${isOverdue ? 'overdue' : isToday ? 'today' : ''}">📅 ${esc(f.date)}${isOverdue ? ' ⚠️' : isToday ? ' 🔥' : ''}</span>` : ''}
        ${sourceLabel ? `<span>${sourceLabel}</span>` : ''}
      </div>

      ${(f.tags || []).length ? `
        <div class="fk-card-tags">
          ${f.tags.slice(0, 3).map(t => `<span class="fk-tag">${esc(t)}</span>`).join('')}
          ${f.tags.length > 3 ? `<span class="fk-tag fk-tag-more">+${f.tags.length - 3}</span>` : ''}
        </div>
      ` : ''}

      <div class="fk-card-footer">
        <div class="fk-card-assignee" title="Assigned to ${esc(assignedName)}">
          <span class="fk-assignee-dot"></span>
          ${esc(assignedName)}
        </div>
        <div class="fk-card-actions" onclick="event.stopPropagation()">
          ${activityCount ? `<span class="fk-card-activity">📋 ${activityCount}</span>` : ''}
          <button class="fk-mini-btn green" onclick="followWhatsApp('${esc(f.phone)}','${esc(f.name)}', event)" title="WhatsApp">💬</button>
          <button class="fk-mini-btn blue" onclick="followCall('${esc(f.phone)}', event)" title="Call">📞</button>
          <button class="fk-mini-btn purple" onclick="openActivityLog(${f.id})" title="Log">📋</button>
          <button class="fk-mini-btn danger" onclick="deleteFollowup(${f.id})" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

/* ==================== KANBAN DRAG-DROP ==================== */
function initKanbanSortable() {
  if (typeof Sortable === 'undefined') return;

  document.querySelectorAll('.fk-column-body').forEach(body => {
    new Sortable(body, {
      group: 'follow-kanban',
      animation: 180,
      ghostClass: 'fk-ghost',
      dragClass: 'fk-dragging',
      handle: '.fk-card',
      onEnd: async (evt) => {
        const cardId = parseInt(evt.item.dataset.id);
        const newStatus = evt.to.dataset.status;
        const oldStatus = evt.from.dataset.status;

        if (!cardId || !newStatus || newStatus === oldStatus) return;

        const f = STORE.followups.find(x => x.id === cardId);
        if (!f) return;

        f.status = newStatus;
        f.completed = newStatus === 'won' || newStatus === 'lost';
        f.updatedAt = Date.now();

        try {
          await dbSave(STORES.followups, f);
          STORE.followups = await dbGetAll(STORES.followups);
          renderFollowups();
          updateSidebarBadges();
          toast(`✅ Moved to ${LEAD_STATUSES[newStatus]?.label || newStatus}`, 'success');
        } catch (e) {
          toast('Failed: ' + e.message, 'error');
          renderFollowups();
        }
      }
    });
  });
}

/* ==================== LIST VIEW ==================== */
function renderListView(filtered) {
  const el = $('fkList');
  if (!el) return;

  const todayStr = today();

  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="ic">🔔</div><div class="tx">No leads match your filters</div></div>';
    return;
  }

  el.innerHTML = filtered.map(f => {
    const status = LEAD_STATUSES[f.status || 'new'] || LEAD_STATUSES.new;
    const isOverdue = f.date < todayStr && !f.completed;
    const assignedName = getAssignedName(f.assignedTo);
    const assignedPhoto = getAssignedPhoto(f.assignedTo);
    const priorityLabel = { low: '🟢', medium: '🟡', high: '🔴' }[f.priority || 'medium'];

    return `
      <div class="follow-lead-card" onclick="openFollowSetup(${f.id})">
        <div class="followup-icon" style="background:${status.bg};color:${status.color};border:1.5px solid ${status.color}33">
          👤
        </div>
        <div class="follow-lead-info">
          <div class="follow-lead-head">
            <h4>${esc(f.name)}</h4>
            <span class="follow-status-badge" style="background:${status.bg};color:${status.color};border:1px solid ${status.color}44">
              ${status.icon} ${status.label}
            </span>
            ${isOverdue ? '<span class="follow-status-badge" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red)44">⚠️ Overdue</span>' : ''}
          </div>
          <div class="follow-lead-meta">
            <span>📞 ${esc(f.phone)}</span>
            ${f.estimatedValue ? `<span style="color:var(--green);font-weight:800">💰 ${fmt(f.estimatedValue)}</span>` : ''}
            <span>${priorityLabel} ${esc(f.priority || 'medium').toUpperCase()}</span>
          </div>
          <div class="follow-lead-meta2">
            <span style="display:flex;align-items:center;gap:5px">
              ${assignedPhoto ? `<img src="${assignedPhoto}" style="width:18px;height:18px;border-radius:50%;object-fit:cover">` : ''}
              <span style="font-weight:700;color:var(--text-2)">${esc(assignedName)}</span>
            </span>
            <span>📅 ${esc(f.date || '—')}</span>
          </div>
        </div>
        <div class="follow-lead-actions" onclick="event.stopPropagation()">
          <button class="follow-action-btn green" onclick="followWhatsApp('${esc(f.phone)}','${esc(f.name)}', event)">💬</button>
          <button class="follow-action-btn blue" onclick="followCall('${esc(f.phone)}', event)">📞</button>
          <button class="follow-action-btn purple" onclick="openActivityLog(${f.id})">📋</button>
          <button class="follow-action-btn" onclick="openFollowSetup(${f.id})">✏️</button>
          <button class="follow-action-btn red" onclick="deleteFollowup(${f.id})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ==================== PACKAGE FOLLOW TAB ==================== */
function renderPackageFollowTab() {
  const el = $('fkList');
  if (!el) return;

  const todayStr = today();
  const due = STORE.packages.filter(p =>
    p.followupDate && p.followupDate <= todayStr &&
    !['Confirmed', 'Paid', 'Travelled', 'Completed', 'Cancelled'].includes(p.status)
  ).sort((a, b) => (a.followupDate || '').localeCompare(b.followupDate || ''));

  if (!due.length) {
    el.innerHTML = '<div class="empty"><div class="ic">🔔</div><div class="tx">No pending package follow-ups</div></div>';
    return;
  }

  el.innerHTML = due.map(p => {
    const cls = (p.status || 'draft').toLowerCase().replace(/\s+/g, '-');
    const isOverdue = p.followupDate < todayStr;
    return `<div class="followup-row ${isOverdue ? 'overdue' : 'today'}" onclick="viewPackage(${p.id})">
      <div class="followup-icon" style="background:linear-gradient(135deg,#a855f7,#9333ea)">📦</div>
      <div class="followup-info">
        <h4>${esc(p.name) || 'Untitled'}</h4>
        <div class="meta">
          <span>👤 ${esc(p.customerName) || '—'}</span>
          <span>📞 ${esc(p.customerPhone) || '—'}</span>
          <span style="color:${isOverdue ? 'var(--red)' : 'var(--purple)'};font-weight:700">🔔 ${p.followupDate}</span>
        </div>
      </div>
      <span class="pkg-row-badge ${cls}">${esc(p.status || 'Draft')}</span>
      <span class="pkg-row-price">${fmt(p.grandTotal)}</span>
    </div>`;
  }).join('');
}

/* ==================== QUICK CONTACT ==================== */
function followWhatsApp(phone, name, event) {
  if (event) event.stopPropagation();
  if (!phone) { toast('No phone number', 'error'); return; }
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('01')) clean = '88' + clean;
  else if (clean.startsWith('1') && clean.length === 10) clean = '880' + clean;
  const msg = `আসসালামু আলাইকুম ${name},\n\nআপনার Umrah প্যাকেজ নিয়ে কথা বলতে চাই। কখন যোগাযোগ করতে পারি?`;
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
}

function followCall(phone, event) {
  if (event) event.stopPropagation();
  if (!phone) { toast('No phone number', 'error'); return; }
  window.location.href = `tel:${phone}`;
}

/* ==================== INIT ==================== */
window.addEventListener('load', () => {
  setTimeout(async () => {
    if (typeof loadTeamMembers === 'function') await loadTeamMembers();
    /* Show kanban by default on lead tab */
    if (typeof switchFollowTab === 'function') {
      const leadTab = $('followTabLead');
      if (leadTab) leadTab.classList.add('btn-secondary');
      const pkgTab = $('followTabPackage');
      if (pkgTab) pkgTab.classList.add('btn-ghost');
    }
  }, 2000);
});