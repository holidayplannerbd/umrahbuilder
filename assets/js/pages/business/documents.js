/* ============================================================
   UMRAH BUILDER — DOCUMENTS (Full v2)
   Upload · View · Delete · Categories · File Storage
   ============================================================ */

/* docsCache declared in state.js */

const DOC_TYPES = {
  bill:      { label: 'Customer Bill',    icon: '🧾', color: '#0ea5e9', bg: '#f0f9ff' },
  invoice:   { label: 'Vendor Invoice',   icon: '🧾', color: '#22c55e', bg: '#f0fdf4' },
  receipt:   { label: 'Payment Receipt',  icon: '💰', color: '#f59e0b', bg: '#fffbeb' },
  bank:      { label: 'Bank Statement',   icon: '🏦', color: '#a855f7', bg: '#faf5ff' },
  voucher:   { label: 'Payment Voucher',  icon: '📑', color: '#3b82f6', bg: '#eff6ff' },
  vat:       { label: 'VAT / Tax',        icon: '🧮', color: '#ef4444', bg: '#fef2f2' },
  refund:    { label: 'Refund Doc',       icon: '♻️', color: '#f97316', bg: '#fff7ed' },
  contract:  { label: 'Contract',         icon: '📋', color: '#6366f1', bg: '#eef2ff' },
  cashbook:  { label: 'Cash Book',        icon: '💵', color: '#10b981', bg: '#ecfdf5' },
  other:     { label: 'Other',            icon: '📦', color: '#64748b', bg: '#f8fafc' }
};

/* ==================== LOAD / SAVE ==================== */
async function loadDocs() {
  try {
    const raw = await dbGetSetting('documents');
    docsCache = Array.isArray(raw) ? raw : [];
  } catch (e) {
    docsCache = [];
  }
  return docsCache;
}

async function saveDocs() {
  await dbSaveSetting('documents', docsCache);
}

/* ==================== RENDER ==================== */
async function renderDocuments() {
  await loadDocs();

  /* KPIs */
  const total = docsCache.length;
  const invoices = docsCache.filter(d => d.type === 'invoice' || d.type === 'bill').length;
  const receipts = docsCache.filter(d => d.type === 'receipt').length;
  const banks = docsCache.filter(d => d.type === 'bank').length;

  const setTxt = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setTxt('docTotal', total);
  setTxt('docInvoice', invoices);
  setTxt('docReceipt', receipts);
  setTxt('docBank', banks);

  /* Category grid */
  const catGrid = document.getElementById('docCategoryGrid');
  if (catGrid) {
    catGrid.innerHTML = Object.entries(DOC_TYPES).map(([key, cfg]) => {
      const count = docsCache.filter(d => d.type === key).length;
      return `
        <div style="padding:14px;background:linear-gradient(135deg,${cfg.bg},var(--card));border:1.5px solid ${cfg.color}33;border-radius:12px;cursor:pointer;transition:all .15s" onclick="filterDocByCategory('${key}')">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:22px">${cfg.icon}</span>
            <span style="font-size:13px;font-weight:800;color:${cfg.color}">${cfg.label}</span>
          </div>
          <div style="font-size:18px;font-weight:900;color:${cfg.color}">${count}</div>
          <div style="font-size:10px;color:var(--text-3);font-weight:700">files</div>
        </div>
      `;
    }).join('');
  }

  /* Filters */
  const search = (document.getElementById('docSearch')?.value || '').toLowerCase();
  const filterType = document.getElementById('docFilterType')?.value || 'all';
  const filterMonth = document.getElementById('docFilterMonth')?.value || 'all';

  let filtered = docsCache.slice();

  if (search) {
    filtered = filtered.filter(d =>
      (d.title || '').toLowerCase().includes(search) ||
      (d.vendorName || '').toLowerCase().includes(search) ||
      (d.packageName || '').toLowerCase().includes(search) ||
      (d.uploadedByName || '').toLowerCase().includes(search) ||
      (d.invoiceData?.customerName || '').toLowerCase().includes(search) ||
      (d.invoiceData?.invoiceNo || '').toLowerCase().includes(search)
    );
  }

  if (filterType !== 'all') filtered = filtered.filter(d => d.type === filterType);

  if (filterMonth !== 'all') {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    const thisYearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

    if (filterMonth === 'thismonth') filtered = filtered.filter(d => (d.date || '') >= thisMonthStart);
    else if (filterMonth === 'lastmonth') filtered = filtered.filter(d => (d.date || '') >= lastMonthStart && (d.date || '') <= lastMonthEnd);
    else if (filterMonth === 'thisyear') filtered = filtered.filter(d => (d.date || '') >= thisYearStart);
  }

  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  setTxt('docCountBadge', filtered.length + ' files');

  /* List */
  const listEl = document.getElementById('docList');
  if (!listEl) return;

  if (!filtered.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-3)">
        <div style="font-size:56px;opacity:.3;margin-bottom:12px">📁</div>
        <div style="font-size:14px;font-weight:700">No documents yet</div>
        <div style="font-size:12px;margin-top:6px">Click "📤 Upload" to add your first document</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(d => {
    const cfg = DOC_TYPES[d.type] || DOC_TYPES.other;
    const expiry = d.expiry && new Date(d.expiry) < new Date();
    return `
      <div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;display:flex;gap:14px;align-items:center;transition:all .15s;cursor:pointer" onclick="${d.invoiceData ? `viewSavedInvoice('${d.id}')` : `viewDocument('${d.id}')`}" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="width:52px;height:52px;border-radius:12px;background:${cfg.bg};display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;border:1.5px solid ${cfg.color}33">
          ${cfg.icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-size:14px;font-weight:800">${esc(d.title || 'Untitled')}</div>
            <span style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${cfg.bg};color:${cfg.color};text-transform:uppercase;letter-spacing:.3px">${cfg.label}</span>
            ${expiry ? '<span class="status-badge expired" style="font-size:9px">⚠️ Expired</span>' : ''}
          </div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap">
            ${d.packageName ? `<span>📦 ${esc(d.packageName)}</span>` : ''}
            ${d.vendorName ? `<span>🏢 ${esc(d.vendorName)}</span>` : ''}
            ${d.date ? `<span>📅 ${esc(d.date)}</span>` : ''}
            ${d.amount ? `<span style="color:var(--primary);font-weight:800">৳ ${Number(d.amount).toLocaleString()}</span>` : ''}
          </div>
          <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">
            📎 ${esc(d.uploadedByName || 'Unknown')} · ${d.invoiceData ? 'Generated invoice' + (d.notes ? ' · ' + esc(d.notes) : '') : (d.fileName ? esc(d.fileName) : 'No file') + ' · ' + (d.fileSize ? (d.fileSize / 1024).toFixed(0) + ' KB' : '')}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          ${d.invoiceData ? `
            <button class="btn btn-sm btn-ghost btn-icon" onclick="viewSavedInvoice('${d.id}')" title="View / Print Invoice">🖨️</button>
            <button class="btn btn-sm btn-ghost btn-icon" onclick="editSavedInvoice('${d.id}')" title="Edit Invoice">✏️</button>
          ` : `<button class="btn btn-sm btn-ghost btn-icon" onclick="viewDocument('${d.id}')" title="View">👁️</button>`}
          ${d.fileData ? `<button class="btn btn-sm btn-ghost btn-icon" onclick="downloadDocument('${d.id}')" title="Download">📥</button>` : ''}
          <button class="btn btn-sm btn-ghost btn-icon" onclick="deleteDocument('${d.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ==================== FILTER BY CATEGORY ==================== */
function filterDocByCategory(type) {
  const sel = document.getElementById('docFilterType');
  if (sel) sel.value = type;
  renderDocuments();
}

/* ==================== OPEN UPLOAD MODAL ==================== */
function openDocumentUpload() {
  const typeOptions = Object.entries(DOC_TYPES).map(([k, cfg]) =>
    `<option value="${k}">${cfg.icon} ${cfg.label}</option>`
  ).join('');

  const vendorOptions = STORE.vendors.map(v =>
    `<option value="${v.id}">${esc(v.name)}</option>`
  ).join('');

  const packageOptions = STORE.packages.map(p =>
    `<option value="${p.id}">${esc(p.name || 'Untitled')} · ${esc(p.refNo || '')}</option>`
  ).join('');

  const html = `
    <div class="modal-bg act" id="docUploadModal">
      <div class="modal narrow">
        <div class="modal-head">
          <h2>📤 Upload Document</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">

          <div class="grid-2">
            <div class="field" style="grid-column:1/-1">
              <label>Document Type *</label>
              <select id="docType">${typeOptions}</select>
            </div>

            <div class="field" style="grid-column:1/-1">
              <label>Title *</label>
              <input type="text" id="docTitle" placeholder="e.g., Swissotel Hotel Bill - January">
            </div>

            <div class="field">
              <label>Related Vendor (optional)</label>
              <select id="docVendor">
                <option value="">-- No vendor --</option>
                ${vendorOptions}
              </select>
            </div>

            <div class="field">
              <label>Related Package (optional)</label>
              <select id="docPackage">
                <option value="">-- No package --</option>
                ${packageOptions}
              </select>
            </div>

            <div class="field">
              <label>Amount (৳)</label>
              <input type="number" id="docAmount" min="0" placeholder="80000">
            </div>

            <div class="field">
              <label>Date</label>
              <input type="date" id="docDate" value="${today()}">
            </div>

            <div class="field" style="grid-column:1/-1">
              <label>Expiry Date (optional)</label>
              <input type="date" id="docExpiry">
            </div>

            <div class="field" style="grid-column:1/-1">
              <label>File * (PDF/JPG/PNG · max 1 MB)</label>
              <input type="file" id="docFileInput" accept=".pdf,.jpg,.jpeg,.png" onchange="previewDocFile(event)" style="padding:8px">
              <div id="docFilePreview" style="margin-top:8px;font-size:12px;color:var(--text-3)">No file selected</div>
            </div>

            <div class="field" style="grid-column:1/-1">
              <label>Notes</label>
              <textarea id="docNotes" style="min-height:60px;resize:vertical" placeholder="Additional notes..."></textarea>
            </div>
          </div>

        </div>
        <div class="modal-foot">
          <div></div>
          <div class="right-actions">
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="saveDocument()">💾 Upload</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ==================== PREVIEW FILE ==================== */
let _pendingDocFile = null;

function previewDocFile(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('docFilePreview');
  if (!file) {
    _pendingDocFile = null;
    if (preview) preview.textContent = 'No file selected';
    return;
  }
  if (file.size > 1 * 1024 * 1024) {
    toast('❌ File 1MB এর কম হতে হবে', 'error');
    event.target.value = '';
    _pendingDocFile = null;
    if (preview) preview.textContent = 'No file selected';
    return;
  }
  _pendingDocFile = file;
  if (preview) {
    preview.innerHTML = `✅ <b>${esc(file.name)}</b> · ${(file.size / 1024).toFixed(0)} KB`;
    preview.style.color = 'var(--green)';
  }
}

/* ==================== SAVE DOCUMENT ==================== */
async function saveDocument() {
  const type = document.getElementById('docType')?.value || 'other';
  const title = (document.getElementById('docTitle')?.value || '').trim();
  const vendorId = document.getElementById('docVendor')?.value || '';
  const packageId = document.getElementById('docPackage')?.value || '';
  const amount = parseFloat(document.getElementById('docAmount')?.value) || 0;
  const date = document.getElementById('docDate')?.value || today();
  const expiry = document.getElementById('docExpiry')?.value || '';
  const notes = document.getElementById('docNotes')?.value || '';

  if (!title) { toast('Title দিন', 'error'); return; }

  const vendor = vendorId ? STORE.vendors.find(v => String(v.id) === String(vendorId)) : null;
  const pkg = packageId ? STORE.packages.find(p => String(p.id) === String(packageId)) : null;

  const user = window.firebaseAuth?.currentUser;
  const profile = await dbGetUserProfile().catch(() => ({})) || {};
  const uploaderName = profile.name || user?.displayName || user?.email?.split('@')[0] || 'Unknown';

  /* Read file as base64 */
  let fileData = null, fileName = '', fileSize = 0, fileType = '';
  if (_pendingDocFile) {
    fileName = _pendingDocFile.name;
    fileSize = _pendingDocFile.size;
    fileType = _pendingDocFile.type;
    fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(_pendingDocFile);
    });
  }

  showLoading('Saving...');
  try {
    const doc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type,
      title,
      vendorId: vendor?.id || null,
      vendorName: vendor?.name || '',
      packageId: pkg?.id || null,
      packageName: pkg?.name || '',
      amount, date, expiry, notes,
      fileName, fileSize, fileType, fileData,
      uploadedBy: user?.uid || null,
      uploadedByName: uploaderName,
      createdAt: Date.now()
    };

    docsCache.push(doc);
    await saveDocs();

    hideLoading();
    document.getElementById('docUploadModal')?.remove();
    _pendingDocFile = null;
    renderDocuments();
        if (typeof addNotification === 'function') {
      addNotification({
        type: 'document_upload',
        icon: '📄',
        message: `📄 Document uploaded: <b>${esc(title)}</b>`,
        link: 'documents'
      });
    }
    toast('✅ Document uploaded');
  } catch (e) {
    hideLoading();
    toast('Upload failed: ' + e.message, 'error');
  }
}

/* ==================== VIEW DOCUMENT ==================== */
function viewDocument(id) {
  const d = docsCache.find(x => x.id === id);
  if (!d) return;

  const cfg = DOC_TYPES[d.type] || DOC_TYPES.other;

  /* File preview HTML */
  let previewHtml = '';
  if (d.fileData && d.fileType) {
    if (d.fileType.startsWith('image/')) {
      previewHtml = `<img src="${d.fileData}" style="max-width:100%;max-height:400px;border-radius:8px;display:block;margin:0 auto">`;
    } else if (d.fileType === 'application/pdf') {
      previewHtml = `<iframe src="${d.fileData}" style="width:100%;height:400px;border:none;border-radius:8px"></iframe>`;
    } else {
      previewHtml = `<div style="padding:20px;text-align:center;color:var(--text-3)">Preview not available</div>`;
    }
  } else {
    previewHtml = `<div style="padding:40px;text-align:center;color:var(--text-3)"><div style="font-size:48px;opacity:.3;margin-bottom:12px">📄</div>No file attached</div>`;
  }

  const html = `
    <div class="modal-bg act" id="docViewModal">
      <div class="modal wide">
        <div class="modal-head">
          <h2>${cfg.icon} ${esc(d.title)}</h2>
          <button class="close-btn" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">

          <div style="padding:14px;background:var(--bg-2);border-radius:12px;margin-bottom:20px;border:1px solid var(--border)">
            ${previewHtml}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid ${cfg.color}">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Type</div>
              <div style="font-size:13.5px;font-weight:700">${cfg.icon} ${cfg.label}</div>
            </div>
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--primary)">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Date</div>
              <div style="font-size:13.5px;font-weight:700">${esc(d.date || '—')}</div>
            </div>
            ${d.amount ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--green)">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Amount</div>
                <div style="font-size:13.5px;font-weight:700;color:var(--green)">৳ ${Number(d.amount).toLocaleString()}</div>
              </div>
            ` : ''}
            ${d.expiry ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid ${new Date(d.expiry) < new Date() ? 'var(--red)' : 'var(--amber)'}">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Expiry</div>
                <div style="font-size:13.5px;font-weight:700">${esc(d.expiry)}</div>
              </div>
            ` : ''}
            ${d.vendorName ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--blue)">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Vendor</div>
                <div style="font-size:13.5px;font-weight:700">🏢 ${esc(d.vendorName)}</div>
              </div>
            ` : ''}
            ${d.packageName ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--purple)">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Package</div>
                <div style="font-size:13.5px;font-weight:700">📦 ${esc(d.packageName)}</div>
              </div>
            ` : ''}
            ${d.notes ? `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--amber);grid-column:1/-1">
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">Notes</div>
                <div style="font-size:12.5px">${esc(d.notes)}</div>
              </div>
            ` : ''}
            <div style="padding:12px;background:var(--bg-2);border-radius:10px;border-left:3px solid var(--text-3);grid-column:1/-1">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:800;margin-bottom:4px">File Info</div>
              <div style="font-size:12.5px">
                📎 <b>${esc(d.fileName || 'No file')}</b>
                ${d.fileSize ? ' · ' + (d.fileSize / 1024).toFixed(0) + ' KB' : ''}
                · Uploaded by <b>${esc(d.uploadedByName || 'Unknown')}</b>
                ${d.createdAt ? ' on ' + new Date(d.createdAt).toLocaleString() : ''}
              </div>
            </div>
          </div>

        </div>
        <div class="modal-foot">
          <div class="left-actions">
            <button class="btn btn-danger btn-sm" onclick="closeModal('docViewModal');setTimeout(()=>deleteDocument('${d.id}'),200)">🗑️ Delete</button>
          </div>
          <div class="right-actions">
            ${d.fileData ? `<button class="btn btn-green btn-sm" onclick="downloadDocument('${d.id}')">📥 Download</button>` : ''}
            <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ==================== DOWNLOAD ==================== */
function downloadDocument(id) {
  const d = docsCache.find(x => x.id === id);
  if (!d || !d.fileData) { toast('No file to download', 'error'); return; }

  const a = document.createElement('a');
  a.href = d.fileData;
  a.download = d.fileName || 'document';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('✅ Downloaded');
}

/* ==================== DELETE ==================== */
async function deleteDocument(id) {
  const d = docsCache.find(x => x.id === id);
  if (!d) return;

  /* Check ownership */
  const user = window.firebaseAuth?.currentUser;
  const isAdmin = window.currentUserRole === 'admin' || !window.currentUserRole;
  const isOwner = user && d.uploadedBy === user.uid;

  if (!isAdmin && !isOwner) {
    toast('❌ আপনি শুধু নিজের upload delete করতে পারবেন', 'error');
    return;
  }

  confirmDelete(`Delete "${d.title}"?`, async () => {
    docsCache = docsCache.filter(x => x.id !== id);
    await saveDocs();
    document.getElementById('docViewModal')?.remove();
    renderDocuments();
    toast('Document deleted', 'warning');
  });
}