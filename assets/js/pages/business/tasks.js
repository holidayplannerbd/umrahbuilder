/* ============================================================
   UMRAH BUILDER — PAGES / BUSINESS / TASKS (v26 — Creator Edit Lock)
   ============================================================ */

const tasksState = {
  tasks: [],
  filterTab: 'all',
  filterUser: 'all',
  filterPriority: 'all',
  searchQuery: '',
  detailTaskId: null,
  editingTaskId: null,
  priority: 'medium',
  tickInterval: null,
  unsubscribe: null,
  activeTimers: {}
};

const DEFAULT_STEPS = [
  { key: 'plan',     label: 'Task Plan' },
  { key: 'data',     label: 'Data Entry/Update' },
  { key: 'verify',   label: 'Verify' },
  { key: 'review',   label: 'Review/Quality Check' },
  { key: 'approval', label: 'Approval' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'handover', label: 'Completion/Handover' },
  { key: 'close',    label: 'Close Task' }
];

let _editingSteps = null;
let _editingTaskId = null;

/* ==================== HELPER: ROLES ==================== */
function getTaskRoles(task) {
  const currentUser = window.firebaseAuth?.currentUser;
  if (!currentUser || !task) return { isCreator: false, isAssignee: false };

  const profiles = window.__userProfiles || {};
  const displayName = window.__cachedSettings?.userName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
  const currentEmail = currentUser.email || '';
  const currentUid = currentUser.uid || '';
  
  const normalize = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const currentKeys = new Set([currentUid, currentEmail, displayName, normalize(currentUid), normalize(currentEmail), normalize(displayName)].filter(Boolean).map(String));
  
  const matchesIdentity = value => {
    if (!value) return false;
    const raw = String(value);
    if (currentKeys.has(raw)) return true;
    return currentKeys.has(normalize(raw));
  };

  const isCreator = matchesIdentity(task.createdBy) || matchesIdentity(task.createdByName);
  
  let isAssignee = false;
  const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];

  if (assigned.includes('both') || assigned.includes('all')) {
    isAssignee = true;
  } else {
    isAssignee = assigned.some(value => {
      if (matchesIdentity(value)) return true;
      const profile = profiles[value];
      if (!profile) return false;
      return matchesIdentity(profile.uid) || matchesIdentity(profile.id) || matchesIdentity(profile.email) || matchesIdentity(profile.name) || matchesIdentity(profile.username);
    });
  }

  return { isCreator, isAssignee };
}

/* ==================== RENDER TASKS PAGE ==================== */
async function renderTasks() {
  try {
    const { collection, onSnapshot } = window.firebaseFns;
    const db = window.firebaseDB;

    if (!db) throw new Error('DB not ready');

    if (tasksState.unsubscribe) {
      tasksState.unsubscribe();
      tasksState.unsubscribe = null;
    }

    tasksState.unsubscribe = onSnapshot(
      collection(db, 'tasks'),
      (snapshot) => {
        const tasks = [];
        snapshot.forEach(doc => {
          tasks.push({ ...doc.data(), id: doc.data().id || doc.id });
        });

        tasksState.tasks = tasks;

        tasksState.tasks.sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return (a.dueDate || '').localeCompare(b.dueDate || '');
        });

        tasksState.activeTimers = {};
        tasksState.tasks.forEach(t => {
          tasksState.activeTimers[t.id] = {
            startTime: t.timerStartTime || null,
            running: !!t.timerRunning,
            elapsed: Number(t.totalTime || 0)
          };
        });

        renderTaskStats();
        renderTaskTabs();
        renderTaskGrid();

        if (tasksState.detailTaskId) {
          const current = tasksState.tasks.find(x => x.id === tasksState.detailTaskId);
          if (current) {
            const progressPct = current.done ? 100 : getTaskProgressPct(current);
            renderBigProgress(progressPct);
            renderDetailSteps(current, progressPct);
            renderDetailTimerUI(current);
          }
        }
      },
      (error) => {
        console.error('❌ onSnapshot error:', error);
        toast('❌ Real-time sync error: ' + error.message, 'error');
      }
    );

    if (!tasksState.tickInterval) {
      tasksState.tickInterval = setInterval(updateAllTaskTimers, 1000);
    }
  } catch (e) {
    console.warn('Load tasks failed:', e);
    tasksState.tasks = [];
    renderTaskStats();
    renderTaskTabs();
    renderTaskGrid();
  }
}

/* ==================== STATS & TABS ==================== */
function renderTaskStats() {
  const today = new Date().toISOString().slice(0, 10);
  const all = tasksState.tasks;

  setTaskText('tkStatOverdue', all.filter(t => !t.done && t.dueDate && t.dueDate < today).length);
  setTaskText('tkStatToday', all.filter(t => !t.done && t.dueDate === today).length);
  setTaskText('tkStatProgress', all.filter(t => !t.done).length);
  setTaskText('tkStatDone', all.filter(t => t.done).length);
  setTaskText('tkLiveCount', `${all.filter(t => !t.done).length} tasks active · Live tracking`);
}

function setTaskText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderTaskTabs() {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const all = tasksState.tasks;

  setTaskText('tkTabAllCount', all.length);
  setTaskText('tkTabTodayCount', all.filter(t => !t.done && t.dueDate === today).length);
  setTaskText('tkTabWeekCount', all.filter(t => !t.done && t.dueDate && t.dueDate <= weekEndStr).length);
  setTaskText('tkTabDoneCount', all.filter(t => t.done).length);
}

function switchTaskTab(tab, btn) {
  tasksState.filterTab = tab;
  document.querySelectorAll('#page-tasks .tk-tab').forEach(t => t.classList.remove('act'));
  if (btn) btn.classList.add('act');
  renderTaskGrid();
}

function searchTasks(query) {
  tasksState.searchQuery = String(query || '').toLowerCase();
  renderTaskGrid();
}

function renderTaskUserFilter() {
  const select = document.getElementById('tkFilterUser');
  if (!select) return;

  const users = new Map();
  const profiles = window.__userProfiles || {};
  Object.entries(profiles).forEach(([id, profile]) => {
    if (profile.name) users.set(profile.uid || id, profile.name);
  });

  // Keep older assignments selectable, including users no longer in profiles.
  tasksState.tasks.forEach(task => {
    const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    assigned.forEach(id => {
      if (!id || id === 'both' || id === 'all' || users.has(id)) return;
      const name = profiles[id]?.name || ({ junayet: 'Junayet Khan', rajon: 'Rajon' })[id] || id;
      users.set(id, name);
    });
  });

  select.innerHTML = '<option value="all">👥 All Users</option>' +
    Array.from(users, ([id, name]) =>
      `<option value="${escapeAttr(id)}">👤 ${esc(name)}</option>`
    ).join('');
  if (tasksState.filterUser !== 'all' && !users.has(tasksState.filterUser)) {
    tasksState.filterUser = 'all';
  }
  select.value = tasksState.filterUser;
}

function filterTasksByUser(value) {
  tasksState.filterUser = value;
  renderTaskGrid();
}

function filterTasksByPriority(value) {
  tasksState.filterPriority = value;
  renderTaskGrid();
}

function getFilteredTasks() {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  let list = tasksState.tasks.slice();

  if (tasksState.filterTab === 'today') list = list.filter(t => !t.done && t.dueDate === today);
  else if (tasksState.filterTab === 'week') list = list.filter(t => !t.done && t.dueDate && t.dueDate <= weekEndStr);
  else if (tasksState.filterTab === 'done') list = list.filter(t => t.done);

  if (tasksState.filterPriority !== 'all') list = list.filter(t => t.priority === tasksState.filterPriority);
  if (tasksState.filterUser !== 'all') {
    list = list.filter(t => {
      const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
      return assigned.includes(tasksState.filterUser) || assigned.includes('both') || assigned.includes('all');
    });
  }
  
  if (tasksState.searchQuery) {
    const q = tasksState.searchQuery;
    list = list.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.desc || '').toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }
  return list;
}

/* ==================== TASK GRID & CARD ==================== */
function renderTaskGrid() {
  renderTaskUserFilter();
  const el = document.getElementById('tkTaskGrid');
  if (!el) return;

  const list = getFilteredTasks();

  if (!list.length) {
    el.innerHTML = `
      <div class="tk-empty">
        <div class="tk-empty-icon">📋</div>
        <div class="tk-empty-text">No tasks found. Create your first task!</div>
      </div>
    `;
    return;
  }

  el.innerHTML = list.map(t => renderTaskCard(t)).join('');
}

function renderTaskCard(t) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !t.done && t.dueDate && t.dueDate < today;
  const priorityClass = t.done ? 'done' : (t.priority || 'medium');

  const priorityLabel = {
    high: '🔴 HIGH',
    medium: '🟡 MEDIUM',
    low: '🟢 LOW'
  }[t.priority || 'medium'];

  const progressPct = t.done ? 100 : getTaskProgressPct(t);
  const progressClass = t.done ? 'done' : (progressPct > 0 ? 'progress' : '');

  const timer = tasksState.activeTimers[t.id];
  const elapsed = getTaskElapsed(t.id);
  const timerText = elapsed > 0 ? formatTaskTime(elapsed) : '00:00:00';
  const timerClass = timer?.running ? 'running' : '';

  const taskSteps = buildStepsForTask(t, progressPct);
  const roles = getTaskRoles(t);
  
  // ⭐ লজিক ফিক্স: Edit এবং Delete শুধুমাত্র ক্রিয়েটর করতে পারবে
  const canEdit = roles.isCreator;
  const canDelete = roles.isCreator;

  const stepsHtml = taskSteps.map((step, i) => `
    <div class="tk-card-step ${step.status}">
      <div class="tk-card-step-circle ${step.status}">${step.status === 'done' ? '✓' : ''}</div>
      <div class="tk-card-step-content">
        <div class="tk-card-step-title">${esc(step.label)}</div>
      </div>
      <div class="tk-card-step-line"></div>
    </div>
  `).join('');

  let assignName = 'Unassigned';
  if (t.assignedTo === 'both') {
    assignName = 'Both (Team)';
  } else if (t.assignedTo) {
    const profiles = window.__userProfiles || {};
    if (profiles[t.assignedTo] && profiles[t.assignedTo].name) {
      assignName = profiles[t.assignedTo].name;
    } else if (t.assignedTo === 'junayet') {
      assignName = 'Junayet';
    } else if (t.assignedTo === 'rajon') {
      assignName = 'Rajon';
    } else if (t.assignedTo.includes('@')) {
      assignName = t.assignedTo.split('@')[0]; 
    } else {
      assignName = 'Team Member';
    }
  }

  return `
    <div class="tk-card" onclick="openTaskDetail('${t.id}')">
      <div class="tk-card-actions" onclick="event.stopPropagation()">
        ${canEdit ? `
          <button class="tk-card-action" onclick="editTask('${t.id}', event)" title="Edit">✏️</button>
        ` : ''}
        ${canDelete ? `
          <button class="tk-card-action danger" onclick="deleteTask('${t.id}', event)" title="Delete">🗑️</button>
        ` : ''}
      </div>

      <div class="tk-card-head">
        <div class="tk-card-badges">
          <span class="tk-badge ${priorityClass}">${priorityLabel}</span>
        </div>
        <div class="tk-card-progress-badge ${progressClass}">
          ${progressPct}%
        </div>
      </div>

      <div class="tk-card-title">${esc(t.title || 'Untitled Task')}</div>

      <div class="tk-card-steps">
        ${stepsHtml}
      </div>

      <div class="tk-card-footer">
        <div class="tk-card-footer-meta">
          <span class="tk-card-footer-meta-item">👤 ${esc(assignName)}</span>
          <span class="tk-card-footer-meta-item ${isOverdue ? 'overdue' : ''}">📅 ${formatTaskDate(t)}</span>
        </div>
        <div class="tk-card-timer ${timerClass}" data-timer="${t.id}">${timerText}</div>
      </div>
    </div>
  `;
}

/* ==================== BUILD STEPS ==================== */
function buildStepsForTask(t, progressPct) {
  const steps = (t.steps && t.steps.length) ? t.steps : DEFAULT_STEPS;
  const completedCount = t.stepsCompleted || 0;

  return steps.map((step, i) => {
    let status = 'todo';
    if (i < completedCount) status = 'done';
    else if (i === completedCount && progressPct > 0 && progressPct < 100) status = 'progress';
    return { ...step, status, index: i };
  });
}

function getTaskProgressPct(t) {
  const steps = (t.steps && t.steps.length) ? t.steps : DEFAULT_STEPS;
  const completed = t.stepsCompleted || 0;
  return Math.round((completed / steps.length) * 100);
}

/* ==================== HELPERS ==================== */
function formatTaskDate(t) {
  if (!t.dueDate) return 'No date';
  const today = new Date().toISOString().slice(0, 10);
  if (t.dueDate === today) return 'Today · ' + (t.dueTime || '');
  const d = new Date(t.dueDate);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}` + (t.dueTime ? ' · ' + t.dueTime : '');
}

/* ==================== TIMER ==================== */
function getTaskElapsed(taskId) {
  const t = tasksState.activeTimers[taskId];
  if (!t) return 0;
  if (t.running && t.startTime) {
    return t.elapsed + Math.floor((Date.now() - t.startTime) / 1000);
  }
  return t.elapsed;
}

function formatTaskTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function toggleTaskTimer(taskId) {
  const task = tasksState.tasks.find(x => x.id === taskId);
  if (!task) return;
  if (task.done) {
    toast('🔒 Completed task timer is locked', 'warning');
    return;
  }

  const timer = tasksState.activeTimers[taskId] || { elapsed: Number(task.totalTime || 0), running: false };
  const now = Date.now();

  if (timer.running) {
    const elapsed = timer.elapsed + Math.floor((now - timer.startTime) / 1000);
    task.totalTime = elapsed;
    task.timerRunning = false;
    task.timerStartTime = null;
    task.updatedAt = now;
    tasksState.activeTimers[taskId] = { startTime: null, running: false, elapsed: elapsed };
    toast('⏸️ Timer paused', 'info');
  } else {
    task.timerRunning = true;
    task.timerStartTime = now;
    task.timerStopped = false; 
    task.updatedAt = now;
    tasksState.activeTimers[taskId] = { startTime: now, running: true, elapsed: timer.elapsed };
    toast('▶️ Timer started', 'success');
  }

  try { await dbSave('tasks', task); } catch (e) {}
  refreshTaskTimersUI();
}

async function stopTaskTimer(taskId) {
  const task = tasksState.tasks.find(x => x.id === taskId);
  if (!task) return;
  if (task.done) {
    toast('🔒 Completed task timer is locked', 'warning');
    return;
  }

  const timer = tasksState.activeTimers[taskId] || { elapsed: Number(task.totalTime || 0) };
  let elapsed = timer.elapsed;

  if (timer.running && timer.startTime) {
    elapsed += Math.floor((Date.now() - timer.startTime) / 1000);
  }

  task.totalTime = elapsed;
  task.timerRunning = false;
  task.timerStartTime = null;
  task.timerStopped = true; 
  task.updatedAt = Date.now();
  
  tasksState.activeTimers[taskId] = { startTime: null, running: false, elapsed: elapsed };
  toast(`⏹️ Timer stopped · Total: ${formatTaskTime(elapsed)}`, 'success');

  try { await dbSave('tasks', task); } catch (e) {}
  refreshTaskTimersUI();
}

function updateAllTaskTimers() {
  Object.keys(tasksState.activeTimers).forEach(taskId => {
    const t = tasksState.activeTimers[taskId];
    if (!t || !t.running) return;

    const elapsed = getTaskElapsed(taskId);
    const cardTimer = document.querySelector(`[data-timer="${taskId}"]`);
    if (cardTimer) {
      cardTimer.textContent = formatTaskTime(elapsed);
      cardTimer.classList.add('running');
    }

    if (tasksState.detailTaskId === taskId) {
      const detailTimer = document.getElementById('tkDetailTimer');
      if (detailTimer) detailTimer.textContent = formatTaskTime(elapsed);
    }
  });
}

function refreshTaskTimersUI() {
  Object.keys(tasksState.activeTimers).forEach(taskId => {
    const cardTimer = document.querySelector(`[data-timer="${taskId}"]`);
    if (!cardTimer) return;
    const t = tasksState.activeTimers[taskId];
    const elapsed = getTaskElapsed(taskId);

    cardTimer.textContent = elapsed > 0 ? formatTaskTime(elapsed) : '00:00:00';
    cardTimer.classList.toggle('running', !!t.running);
  });

  if (tasksState.detailTaskId) {
    const currentTask = tasksState.tasks.find(x => x.id === tasksState.detailTaskId);
    if (currentTask) renderDetailTimerUI(currentTask);
  }
}

/* ==================== DETAIL MODAL ==================== */
async function openTaskDetail(taskId) {
  const task = tasksState.tasks.find(t => t.id === taskId);
  if (!task) return;

  tasksState.detailTaskId = taskId;

  setTaskText('tkDetailTitle', task.title || 'Untitled');

  const prioBadge = document.getElementById('tkDetailPriorityBadge');
  if (prioBadge) {
    prioBadge.className = 'tk-badge ' + (task.priority || 'medium');
    prioBadge.textContent = {
      high: '🔴 High Priority',
      medium: '🟡 Medium Priority',
      low: '🟢 Low Priority'
    }[task.priority || 'medium'];
  }

  const profiles = window.__userProfiles || {};
  
  let creatorName = 'Unknown';
  if (task.createdBy && profiles[task.createdBy] && profiles[task.createdBy].name) {
    creatorName = profiles[task.createdBy].name;
  } else if (task.createdByName) {
    creatorName = task.createdByName;
  } else if (task.createdBy && task.createdBy.includes('@')) {
    creatorName = task.createdBy.split('@')[0];
  }

  let assignName = 'Unassigned';
  if (task.assignedTo === 'both') {
    assignName = 'Both (Team)';
  } else if (task.assignedTo) {
    if (profiles[task.assignedTo] && profiles[task.assignedTo].name) {
      assignName = profiles[task.assignedTo].name;
    } else if (task.assignedTo.includes('@')) {
      assignName = task.assignedTo.split('@')[0];
    } else {
      assignName = task.assignedTo;
    }
  }

  setTaskText('tkDetailCreatedBy', '👤 Created by: ' + creatorName);
  setTaskText('tkDetailAssignedTo', '👤 ' + assignName);
  setTaskText('tkDetailDueDate', '📅 ' + formatTaskDate(task));
  setTaskText('tkDetailCategory', '📁 ' + (task.category || 'Other'));
  setTaskText('tkDetailCreatedByValue', '👤 ' + creatorName);
  setTaskText('tkDetailDesc', task.desc || 'No description');

  const progressPct = task.done ? 100 : getTaskProgressPct(task);
  const roles = getTaskRoles(task);
  const canManage = roles.isCreator || roles.isAssignee;
  const canDelete = roles.isCreator; 

  renderBigProgress(progressPct);
  renderDetailSteps(task, progressPct);
  renderDetailTimerUI(task);

  // Footer Buttons Visibility
  const btnEdit = document.querySelector('#tkDetailBg .tk-detail-foot-right button[onclick*="editTaskFromDetail"]');
  const btnDelete = document.querySelector('#tkDetailBg .tk-detail-foot-right button[onclick*="deleteTaskFromDetail"]');
  const btnDone = document.querySelector('#tkDetailBg .tk-detail-foot-right button[onclick*="markTaskDone"]');

  // ⭐ লজিক ফিক্স: Edit এবং Delete শুধুমাত্র ক্রিয়েটর দেখতে পাবে
  if (btnEdit) btnEdit.style.display = roles.isCreator ? 'inline-flex' : 'none';
  if (btnDelete) btnDelete.style.display = canDelete ? 'inline-flex' : 'none'; 
  if (btnDone) btnDone.style.display = (canManage && !task.done) ? 'inline-flex' : 'none';

  document.getElementById('tkDetailBg').classList.add('act');
}

function renderBigProgress(pct) {
  const circle = document.getElementById('tkBigProgressRingFg');
  if (circle) {
    const r = 32;
    const c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;
    circle.style.strokeDasharray = c;
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = pct === 100 ? 'var(--green)' : (pct > 0 ? 'var(--amber)' : 'var(--border-2)');
  }
  setTaskText('tkBigProgressPct', pct + '%');
}

function renderDetailSteps(task, progressPct) {
  const el = document.getElementById('tkDetailSteps');
  if (!el) return;

  const steps = buildStepsForTask(task, progressPct);
  const roles = getTaskRoles(task);
  
  // ⭐ লজিক: Done এর আগে Assignee ক্লিক করতে পারবে, Done এর পরে শুধু Creator
  const canClick = !task.done ? roles.isAssignee : roles.isCreator;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:1px">
        Steps (${task.stepsCompleted || 0}/${steps.length})
      </span>
      ${roles.isCreator ? `
        <button class="tk-edit-steps-btn" onclick="openEditStepsModal('${task.id}')">
          ✏️ Edit Steps
        </button>
      ` : ''}
    </div>
    
    ${steps.map((step, i) => {
      const isDone = step.status === 'done';
      return `
        <div class="tk-detail-step ${step.status}" 
             ${canClick ? `onclick="toggleDetailStep(${i}, event)"` : ''} 
             style="${!canClick ? 'cursor:not-allowed;opacity:0.7;pointer-events:none;' : ''}">
          <div class="tk-detail-step-circle ${step.status}">${isDone ? '✓' : ''}</div>
          <div class="tk-detail-step-content">
            <div class="tk-detail-step-title">${esc(step.label)}</div>
          </div>
          <div class="tk-detail-step-line"></div>
        </div>
      `;
    }).join('')}
  `;
}

async function toggleDetailStep(stepIndex, event) {
  if (event) event.stopPropagation();
  const taskId = tasksState.detailTaskId;
  if (!taskId) return;

  const task = tasksState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const roles = getTaskRoles(task);

  // লক চেক
  if (task.done && !roles.isCreator) {
    toast('🔒 Task সম্পন্ন হয়ে গেছে, ক্রিয়েটর ছাড়া কেউ প্রোগ্রেস বদলাতে পারবে না।', 'warning');
    return;
  }
  
  if (!roles.isCreator && !roles.isAssignee) return;

  const steps = (task.steps && task.steps.length) ? task.steps : DEFAULT_STEPS;
  let completed = task.stepsCompleted || 0;

  if (stepIndex === completed) completed = stepIndex + 1;
  else completed = stepIndex; 

  task.stepsCompleted = completed;
  task.updatedAt = Date.now();

  if (completed < steps.length) {
    task.done = false;
    task.status = completed > 0 ? 'progress' : 'todo';
    task.timerStopped = false; 
  } else {
    task.done = true;
    task.status = 'done';
    task.completedAt = Date.now();
    task.timerStopped = true; 
  }

  try { await dbSave('tasks', task); } catch (e) {}

  const progressPct = task.done ? 100 : getTaskProgressPct(task);
  renderBigProgress(progressPct);
  renderDetailSteps(task, progressPct);
  renderDetailTimerUI(task);

  if (task.done) {
    toast('🎉 Task সম্পন্ন!', 'success');
  } else {
    toast(`✅ Progress set to ${completed}/${steps.length}`, 'success');
  }
}

function renderDetailTimerUI(task) {
  if (!task) {
    const taskId = tasksState.detailTaskId;
    if (!taskId) return;
    task = tasksState.tasks.find(t => t.id === taskId);
    if (!task) return;
  }

  const taskId = task.id;
  const display = document.getElementById('tkDetailTimer');
  if (!display) return;

  const t = tasksState.activeTimers[taskId];
  const elapsed = getTaskElapsed(taskId);

  display.textContent = elapsed > 0 ? formatTaskTime(elapsed) : '00:00:00';
  display.className = 'tk-timer-display-lg' + (t?.running ? ' running' : '');

  const btnToggle = document.getElementById('tkDetailTimerToggleBtn');
  const btnStop = document.querySelector('#tkDetailBg .tk-timer-btn.stop');
  
  if (!btnToggle || !btnStop) return;

  const roles = getTaskRoles(task);

  // ⭐ ক্রিয়েটর হলে সবসময় টাইমার কন্ট্রোল পাবে, অ্যাসাইনি Done হলে পাবে না
  if (roles.isCreator) {
    btnToggle.style.display = 'inline-flex';
    btnStop.style.display = 'inline-flex';
    
    if (t?.running) {
      btnToggle.className = 'tk-timer-btn pause';
      btnToggle.innerHTML = '⏸️ Pause';
    } else {
      btnToggle.className = 'tk-timer-btn start';
      btnToggle.innerHTML = elapsed > 0 ? '▶️ Resume' : '▶️ Start';
    }
  } 
  else if (roles.isAssignee) {
    btnToggle.style.display = 'none'; 
    
    if (task.timerStopped || task.done) {
      btnStop.style.display = 'none'; 
    } else {
      btnStop.style.display = 'inline-flex';
      
      if (t?.running) {
        btnStop.className = 'tk-timer-btn stop';
        btnStop.innerHTML = '⏹️ Stop';
        btnStop.onclick = () => stopTaskTimer(taskId);
      } else {
        btnStop.className = 'tk-timer-btn start';
        btnStop.innerHTML = '▶️ Start';
        btnStop.onclick = () => {
          toggleTaskTimer(taskId); 
          setTimeout(() => renderDetailTimerUI(task), 100);
        };
      }
    }
  } 
  else {
    btnToggle.style.display = 'none';
    btnStop.style.display = 'none';
  }
}

function closeTaskDetail() {
  document.getElementById('tkDetailBg').classList.remove('act');
  tasksState.detailTaskId = null;
  renderTaskGrid();
  renderTaskStats();
}

function detailToggleTimer() {
  if (tasksState.detailTaskId) toggleTaskTimer(tasksState.detailTaskId);
}

function detailStopTimer() {
  if (tasksState.detailTaskId) stopTaskTimer(tasksState.detailTaskId);
}

async function markTaskDone() {
  const taskId = tasksState.detailTaskId;
  if (!taskId) return;
  const task = tasksState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const roles = getTaskRoles(task);
  if (!roles.isAssignee && !roles.isCreator) {
    toast('Permission denied', 'error');
    return;
  }

  const steps = (task.steps && task.steps.length) ? task.steps : DEFAULT_STEPS;
  task.stepsCompleted = steps.length;
  task.done = true;
  task.status = 'done';
  task.completedAt = Date.now();
  task.updatedAt = Date.now();
  task.timerStopped = true; 

  const timer = tasksState.activeTimers[taskId] || { elapsed: Number(task.totalTime || 0) };
  let finalElapsed = timer.elapsed;
  if (timer.running && timer.startTime) finalElapsed += Math.floor((Date.now() - timer.startTime) / 1000);

  task.totalTime = finalElapsed;
  task.timerRunning = false;
  task.timerStartTime = null;
  tasksState.activeTimers[taskId] = { startTime: null, running: false, elapsed: finalElapsed };

  try {
    await dbSave('tasks', task);
    toast('🎉 Task সম্পন্ন! Timer stopped.', 'success');
  } catch (e) {
    toast('❌ Save failed: ' + e.message, 'error');
  }
  closeTaskDetail();
}

/* ==================== CREATE / EDIT MODAL ==================== */
function openCreateTaskModal() {
  tasksState.editingTaskId = null;
  document.getElementById('tkModalTitle').textContent = '➕ Create New Task';
  document.getElementById('tkFldTitle').value = '';
  document.getElementById('tkFldDesc').value = '';
  document.getElementById('tkFldTags').value = '';
  document.getElementById('tkFldDueDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('tkFldDueTime').value = '17:00';
  document.getElementById('tkFldCategory').value = '📦 Package';
  
  const assignedSelect = document.getElementById('tkFldAssigned');
  if (assignedSelect) {
    let optionsHtml = '<option value="both">👥 Both (Team)</option>';
    const profiles = window.__userProfiles || {};
    
    Object.values(profiles).forEach(u => {
      if (u.uid && u.name && u.role !== 'accountant') {
        optionsHtml += `<option value="${u.uid}">👤 ${esc(u.name)}</option>`;
      }
    });

    if (Object.keys(profiles).length === 0) {
      optionsHtml += `<option value="junayet">👤 Junayet Khan</option><option value="rajon">👤 Rajon</option>`;
    }

    assignedSelect.innerHTML = optionsHtml;
  }

  setTaskPriority('medium', document.querySelector('#tkCreateModalBg .tk-priority-option.medium'));

  const user = window.firebaseAuth?.currentUser;
  const settings = window.__cachedSettings || {};
  const displayName = settings.userName || user?.displayName || user?.email || 'User';
  setTaskText('tkCreatedByPreview', displayName);

  document.getElementById('tkCreateModalBg').classList.add('act');
  setTimeout(() => document.getElementById('tkFldTitle')?.focus(), 300);
}

async function editTask(taskId, event) {
  if (event) event.stopPropagation();
  const task = tasksState.tasks.find(t => t.id === taskId);
  if (!task) return;

  // ⭐ নতুন লজিক: শুধুমাত্র ক্রিয়েটর এডিট করতে পারবে
  const roles = getTaskRoles(task);
  if (!roles.isCreator) {
    toast('❌ শুধুমাত্র Task Creator ডেট বা সময় পরিবর্তন করতে পারবেন', 'error');
    return;
  }

  tasksState.editingTaskId = taskId;
  document.getElementById('tkModalTitle').textContent = '✏️ Edit Task';
  document.getElementById('tkFldTitle').value = task.title || '';
  document.getElementById('tkFldDesc').value = task.desc || '';
  document.getElementById('tkFldTags').value = (task.tags || []).join(', ');
  document.getElementById('tkFldDueDate').value = task.dueDate || '';
  document.getElementById('tkFldDueTime').value = task.dueTime || '17:00';
  document.getElementById('tkFldCategory').value = task.category || '📦 Package';
  
  const assignedSelect = document.getElementById('tkFldAssigned');
  if (assignedSelect) {
    let optionsHtml = '<option value="both">👥 Both (Team)</option>';
    const profiles = window.__userProfiles || {};
    
    Object.values(profiles).forEach(u => {
      if (u.uid && u.name && u.role !== 'accountant') {
        optionsHtml += `<option value="${u.uid}">👤 ${esc(u.name)}</option>`;
      }
    });

    if (Object.keys(profiles).length === 0) {
      optionsHtml += `<option value="junayet">👤 Junayet Khan</option><option value="rajon">👤 Rajon</option>`;
    }

    assignedSelect.innerHTML = optionsHtml;
    assignedSelect.value = task.assignedTo || 'both';
  }

  setTaskPriority(task.priority || 'medium', document.querySelector(`#tkCreateModalBg .tk-priority-option.${task.priority || 'medium'}`));
  setTaskText('tkCreatedByPreview', task.createdByName || 'Unknown');
  
  document.getElementById('tkCreateModalBg').classList.add('act');
}

function closeCreateTaskModal() {
  document.getElementById('tkCreateModalBg').classList.remove('act');
  tasksState.editingTaskId = null;
}

function setTaskPriority(priority, el) {
  tasksState.priority = priority;
  document.querySelectorAll('#tkCreateModalBg .tk-priority-option').forEach(o => o.classList.remove('act'));
  if (el) el.classList.add('act');
}

async function saveTask() {
  const title = document.getElementById('tkFldTitle').value.trim();
  if (!title) {
    toast('❌ Task title required', 'error');
    document.getElementById('tkFldTitle').focus();
    return;
  }

  const user = window.firebaseAuth?.currentUser;
  const settings = window.__cachedSettings || {};
  const displayName = settings.userName || user?.displayName || user?.email || 'User';

  const isEdit = !!tasksState.editingTaskId;
  const existing = isEdit ? tasksState.tasks.find(t => t.id === tasksState.editingTaskId) : null;

  const assignedToId = document.getElementById('tkFldAssigned').value;

  const taskData = {
    id: isEdit ? tasksState.editingTaskId : ('task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
    title,
    desc: document.getElementById('tkFldDesc').value.trim(),
    assignedTo: assignedToId,
    category: document.getElementById('tkFldCategory').value,
    priority: tasksState.priority,
    dueDate: document.getElementById('tkFldDueDate').value,
    dueTime: document.getElementById('tkFldDueTime').value,
    tags: document.getElementById('tkFldTags').value.split(',').map(s => s.trim()).filter(Boolean),
    createdBy: existing?.createdBy || user?.uid || null,
    createdByName: existing?.createdByName || displayName,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    done: existing?.done || false,
    status: existing?.status || 'todo',
    totalTime: existing?.totalTime || 0,
    timerRunning: existing?.timerRunning || false,
    timerStartTime: existing?.timerStartTime || null,
    timerStopped: existing?.timerStopped || false,
    steps: existing?.steps || DEFAULT_STEPS,
    stepsCompleted: existing?.stepsCompleted || 0
  };

  try {
    await dbSave('tasks', taskData);
    
    if (typeof addNotification === 'function' && !isEdit) {
      let assignedName = 'Team';
      
      if (assignedToId !== 'both') {
        const profiles = window.__userProfiles || {};
        if (profiles[assignedToId] && profiles[assignedToId].name) {
          assignedName = profiles[assignedToId].name;
        } else if (assignedToId.includes('@')) {
          assignedName = assignedToId.split('@')[0];
        } else {
          assignedName = assignedToId;
        }
      }

      addNotification({
        type: 'task_created',
        icon: '✅',
        message: `✅ New task: <b>${esc(title)}</b> assigned to <b>${esc(assignedName)}</b>`,
        link: 'tasks'
      });
    }
    
    toast(isEdit ? '✅ Task updated!' : '✅ Task created!', 'success');
    closeCreateTaskModal();
  } catch (e) {
    toast('❌ Save failed: ' + e.message, 'error');
  }
}

/* ==================== DELETE LOGIC (Only Creator) ==================== */
function deleteTask(taskId, event) {
  if (event) event.stopPropagation();
  const task = tasksState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const roles = getTaskRoles(task);
  if (!roles.isCreator) {
    toast('❌ Only creator can delete this task', 'error');
    return;
  }

  confirmDelete(`Delete task "${task.title}"?`, async () => {
    try {
      await dbDelete('tasks', taskId);
      toast('🗑️ Task deleted', 'success');
      closeTaskDetail();
    } catch (e) {
      toast('❌ Delete failed: ' + e.message, 'error');
    }
  });
}

function editTaskFromDetail() {
  const taskId = tasksState.detailTaskId;
  if (!taskId) return;
  closeTaskDetail();
  setTimeout(() => editTask(taskId), 200);
}

function deleteTaskFromDetail() {
  const taskId = tasksState.detailTaskId;
  if (!taskId) return;
  closeTaskDetail();
  setTimeout(() => deleteTask(taskId), 200);
}

/* ============================================================
   ⭐ EDIT STEPS LOGIC (Only Creator)
   ============================================================ */
function openEditStepsModal(taskId) {
  const task = tasksState.tasks.find(t => t.id === taskId);
  const roles = getTaskRoles(task);
  if (!roles.isCreator) {
    toast('❌ Only creator can edit steps', 'error');
    return;
  }

  _editingTaskId = taskId;
  _editingSteps = JSON.parse(JSON.stringify((task.steps && task.steps.length) ? task.steps : DEFAULT_STEPS));

  renderEditStepsList();
  document.getElementById('tkEditStepsModal').classList.add('act');
}

function closeEditStepsModal() {
  document.getElementById('tkEditStepsModal').classList.remove('act');
  _editingSteps = null;
  _editingTaskId = null;
}

function renderEditStepsList() {
  const el = document.getElementById('tkEditStepsList');
  if (!el || !_editingSteps) return;

  el.innerHTML = _editingSteps.map((step, i) => `
    <div class="tk-edit-step-row" data-idx="${i}">
      <div class="tk-edit-step-num">${i + 1}</div>
      <input type="text" class="tk-edit-step-input" 
             value="${esc(step.label)}" 
             placeholder="Step name..."
             onchange="updateEditStepName(${i}, this.value)"
             onkeydown="if(event.key==='Enter'){this.blur();}">
      <button class="tk-edit-step-del" onclick="deleteEditStep(${i})" title="Delete">✕</button>
    </div>
  `).join('');

  if (typeof Sortable !== 'undefined') {
    if (window._editStepsSortable) {
      try { window._editStepsSortable.destroy(); } catch(e) {}
    }
    window._editStepsSortable = new Sortable(el, {
      animation: 180,
      handle: '.tk-edit-step-num',
      ghostClass: 'tk-edit-step-ghost',
      onEnd: (evt) => {
        const item = _editingSteps.splice(evt.oldIndex, 1)[0];
        _editingSteps.splice(evt.newIndex, 0, item);
        renderEditStepsList();
      }
    });
  }
}

function updateEditStepName(idx, value) {
  if (!_editingSteps || !_editingSteps[idx]) return;
  _editingSteps[idx].label = String(value || '').trim() || `Step ${idx + 1}`;
}

function deleteEditStep(idx) {
  if (!_editingSteps) return;
  if (_editingSteps.length <= 1) {
    toast('At least 1 step required', 'warning');
    return;
  }
  if (!confirm(`Delete "${_editingSteps[idx].label}"?`)) return;
  _editingSteps.splice(idx, 1);
  renderEditStepsList();
}

function addEditStep() {
  if (!_editingSteps) return;
  if (_editingSteps.length >= 15) {
    toast('Max 15 steps', 'warning');
    return;
  }
  const newIdx = _editingSteps.length + 1;
  _editingSteps.push({ key: 'step_' + Date.now(), label: `Step ${newIdx}` });
  renderEditStepsList();
}

function resetEditStepsDefault() {
  if (!confirm('Reset to default 8 steps?')) return;
  _editingSteps = JSON.parse(JSON.stringify(DEFAULT_STEPS));
  renderEditStepsList();
}

async function saveEditSteps() {
  if (!_editingTaskId || !_editingSteps) return;

  const task = tasksState.tasks.find(t => t.id === _editingTaskId);
  if (!task) return;

  const validSteps = _editingSteps.filter(s => s.label && s.label.trim());
  if (!validSteps.length) {
    toast('At least 1 step required', 'error');
    return;
  }

  const oldCompleted = Math.min(task.stepsCompleted || 0, validSteps.length);

  task.steps = validSteps;
  task.stepsCompleted = oldCompleted;

  if (oldCompleted >= validSteps.length) {
    task.done = true;
    task.status = 'done';
    task.stepsCompleted = validSteps.length;
    task.timerStopped = true;
  } else {
    task.done = false;
    task.status = oldCompleted > 0 ? 'progress' : 'todo';
    task.timerStopped = false;
  }

  task.updatedAt = Date.now();

  showLoading('Saving steps...');
  try {
    await dbSave('tasks', task);
    hideLoading();
    closeEditStepsModal();

    const progressPct = task.done ? 100 : getTaskProgressPct(task);
    renderBigProgress(progressPct);
    renderDetailSteps(task, progressPct);
    renderTaskGrid();

    toast('✅ Steps updated');
  } catch (e) {
    hideLoading();
    toast('Save failed: ' + e.message, 'error');
  }
}

/* ==================== INIT ==================== */
window.addEventListener('load', () => {
  setTimeout(() => {
    renderTasks();
  }, 800);
});