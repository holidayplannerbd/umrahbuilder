var autoHotelRoomRateOverrides = { makkah: {}, madinah: {} };
var autoHotelRoomMixes = { makkah: null, madinah: null };
var autoServiceEntries = [];
var autoServiceEntryCounter = 0;

function autoPackageDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addAutoPackageDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return autoPackageDateString(date);
}

function getAutoPackageNights() {
  const checkIn = $('autoCheckIn')?.value || '';
  const checkOut = $('autoCheckOut')?.value || '';
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(`${checkOut}T00:00:00`) - new Date(`${checkIn}T00:00:00`)) / 86400000);
}

function getAutoRoomSharing(cityType) {
  return $('autoRoomSharing')?.value || 'double';
}

function getAutoRoomMix(cityType) {
  const saved = autoHotelRoomMixes[cityType];
  if (saved) return { ...saved };
  const pax = (Number($('autoPaxAdult')?.value) || 0) + (Number($('autoPaxChild')?.value) || 0);
  const defaults = getAutoRoomCounts(pax, getAutoRoomSharing(cityType));
  return {
    single: defaults.single || 0,
    double: defaults.double || 0,
    triple: defaults.triple || 0,
    quad: defaults.quad || 0
  };
}

function getAutoRoomMixCapacity(roomMix) {
  const capacities = typeof ROOM_CAPACITY !== 'undefined' ? ROOM_CAPACITY : { single: 1, double: 2, triple: 3, quad: 4 };
  return Object.keys(roomMix).reduce((sum, type) => sum + ((Number(roomMix[type]) || 0) * (capacities[type] || 0)), 0);
}

function getAutoRoomMixLabel(cityType) {
  return getAutoRoomCountsLabel(getAutoRoomMix(cityType));
}

function getAutoRoomCountsLabel(roomMix) {
  return ['quad', 'triple', 'double', 'single']
    .filter(type => Number(roomMix[type]) > 0)
    .map(type => `${Number(roomMix[type])} ${type}`)
    .join(' + ') || 'No rooms selected';
}

function updateAutoRoomMixCount(cityType, roomType, value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) return;
  const roomMix = getAutoRoomMix(cityType);
  roomMix[roomType] = count;
  autoHotelRoomMixes[cityType] = roomMix;
  renderAutoHotelRoomRates();
  renderAutoPackageEstimate();
  renderAutoHotelBudgetMatches();
}

function getAutoHotelRoomRate(cityType, hotel, roomType) {
  const override = autoHotelRoomRateOverrides[cityType]?.[String(hotel.id)]?.[roomType];
  if (override !== undefined) return Math.max(0, Number(override) || 0);
  return typeof getHotelMasterRoomRate === 'function'
    ? getHotelMasterRoomRate(cityType, hotel.id, roomType)
    : Math.max(0, Number(hotel[roomType]) || 0);
}

function updateAutoHotelPricing() {
  renderAutoHotelRoomRates();
  renderAutoPackageEstimate();
  renderAutoHotelBudgetMatches();
}

function renderAutoPackagePresets() {
  const presets = [
    { key: 'economy', icon: '💰', label: 'Economy' },
    { key: 'standard', icon: '⭐', label: 'Standard' },
    { key: 'premium', icon: '👑', label: 'Premium' },
    { key: 'ramadan', icon: '🌙', label: 'Ramadan' }
  ];
  const el = $('autoPresetChoices');
  if (!el) return;
  el.innerHTML = presets.map(preset => {
    const data = TEMPLATES[preset.key];
    return `<button type="button" class="auto-preset-card" data-preset="${preset.key}" onclick="applyAutoPackagePreset('${preset.key}')">
      <span>${preset.icon}</span><b>${preset.label}</b>
      <small>${data.nights} nights · ${esc(data.roomSharing)} sharing</small>
    </button>`;
  }).join('');
}

function applyAutoPackagePreset(key) {
  const preset = TEMPLATES[key];
  if (!preset) return;
  setVal('autoPackageType', preset.type);
  setVal('autoRoomSharing', preset.roomSharing);
  setVal('autoPresetKey', key);
  setVal('autoCheckOut', addAutoPackageDays($('autoCheckIn').value, preset.nights));
  $('autoPresetChoices')?.querySelectorAll('[data-preset]').forEach(card => {
    card.classList.toggle('is-selected', card.dataset.preset === key);
  });
  updateAutoPackageNights(true);
}

function updateAutoPackageType() {
  const selectedPreset = $('autoPresetKey').value;
  const matchingPreset = Object.keys(TEMPLATES).find(key => TEMPLATES[key].type === $('autoPackageType').value);
  if (matchingPreset && matchingPreset !== selectedPreset) applyAutoPackagePreset(matchingPreset);
  else if (!matchingPreset && selectedPreset) {
    setVal('autoPresetKey', '');
    setVal('autoRoomSharing', 'double');
    $('autoPresetChoices')?.querySelectorAll('[data-preset]').forEach(card => card.classList.remove('is-selected'));
  }
}

function getAutoCustomerLabel(customer) {
  const name = customer.customerName || '';
  return customer.phone ? `${name} · ${customer.phone}` : name;
}

function onAutoCustomerInput() {
  const input = $('autoCustomerName');
  const value = input.value.trim().toLocaleLowerCase();
  const customer = (STORE.customers || []).find(item =>
    getAutoCustomerLabel(item).toLocaleLowerCase() === value ||
    String(item.customerName || '').toLocaleLowerCase() === value
  );
  const hint = $('autoCustomerHint');
  if (customer) {
    input.value = customer.customerName || '';
    setVal('autoCustomerId', customer.id);
    hint.textContent = customer.phone
      ? `Existing customer selected · ${customer.phone}`
      : 'Existing customer selected.';
    hint.classList.add('is-selected');
  } else {
    setVal('autoCustomerId', '');
    hint.textContent = 'New customer name. Existing names will appear as suggestions.';
    hint.classList.remove('is-selected');
  }
  renderAutoPackageEstimate();
}

function getAutoServiceConfig(key) {
  const configs = {
    flight: {
      title: 'Flight',
      options: STORE.flights || [],
      label: item => `${item.airline || 'Flight'} · ${item.from || ''} → ${item.to || ''}`
    },
    transport: {
      title: 'Transfer',
      options: STORE.transports || [],
      label: item => `${item.from || ''} → ${item.to || ''} · ${item.vehicle || 'Transport'}`
    },
    ziyarah: {
      title: 'Ziyarah',
      options: STORE.ziyarah || [],
      label: item => `${item.name || 'Ziyarah'}${item.city ? ` · ${item.city}` : ''}`
    },
    visa: {
      title: 'Visa',
      options: STORE.visas || [],
      label: item => `${item.name || 'Visa'} · ${fmt(item.priceAdult || item.price || 0)}`
    }
  };
  return configs[key] || { title: key, options: [], label: item => String(item.id) };
}

function getAutoServiceEntry(id) {
  return autoServiceEntries.find(entry => entry.id === id);
}

function addAutoServiceEntry() {
  const entry = { id: ++autoServiceEntryCounter, key: '', selectedId: '', quantity: 1 };
  autoServiceEntries.push(entry);
  const details = $('autoServiceDetails');
  if (details) details.open = true;
  renderAutoServiceEntries();
  renderAutoPackageEstimate();
  $(`autoServiceType${entry.id}`)?.focus();
}

function removeAutoServiceEntry(id) {
  autoServiceEntries = autoServiceEntries.filter(entry => entry.id !== id);
  renderAutoServiceEntries();
  renderAutoPackageEstimate();
  const nextEntry = autoServiceEntries.find(entry => entry.id > id) || autoServiceEntries[autoServiceEntries.length - 1];
  if (nextEntry) $(`autoServiceType${nextEntry.id}`)?.focus();
  else $('autoAddServiceButton')?.focus();
}

function setAutoServiceEntryType(id, key) {
  const entry = getAutoServiceEntry(id);
  if (!entry) return;
  entry.key = key;
  entry.selectedId = '';
  entry.quantity = 1;
  renderAutoServiceEntries();
  renderAutoPackageEstimate();
  if (key) $(`autoServiceSearch${id}`)?.focus();
}

function syncAutoServiceEntrySearch(id) {
  const entry = getAutoServiceEntry(id);
  if (!entry || !entry.key) return;
  const input = $(`autoServiceSearch${id}`);
  const select = $(`autoServiceSelect${id}`);
  const config = getAutoServiceConfig(entry.key);
  const value = input.value.trim().toLocaleLowerCase();
  const match = config.options.find(item => config.label(item).toLocaleLowerCase() === value);
  entry.selectedId = match ? String(match.id) : '';
  select.value = entry.selectedId;
  input.classList.toggle('has-selection', Boolean(match));
  if (entry.key === 'transport' && match) {
    entry.quantity = Math.max(1, Number(match.vehicleCount) || 1);
    renderAutoServiceEntries();
    ($(`autoServiceQuantity${id}`) || $(`autoServiceSearch${id}`))?.focus();
  }
  renderAutoPackageEstimate();
}

function updateAutoServiceEntryQuantity(id, value) {
  const entry = getAutoServiceEntry(id);
  if (!entry || entry.key !== 'transport') return;
  entry.quantity = value;
  renderAutoPackageEstimate();
}

function renderAutoServiceEntries() {
  const root = $('autoServiceChoices');
  if (!root) return;
  const summary = $('autoServiceSummaryCount');
  const typedEntries = autoServiceEntries.filter(entry => entry.key).length;
  if (summary) {
    summary.textContent = typedEntries
      ? `${typedEntries} service${typedEntries === 1 ? '' : 's'} added`
      : autoServiceEntries.length ? 'Choose a service type' : 'Add flights, transfers, visa or Ziyarah';
  }
  if (!autoServiceEntries.length) {
    root.innerHTML = '<div class="auto-service-empty">No services added yet. Add one or more flights, transfers, or other services.</div>';
    return;
  }

  const typeOptions = [
    { key: 'flight', label: 'Flight' },
    { key: 'transport', label: 'Transfer' },
    { key: 'ziyarah', label: 'Ziyarah' },
    { key: 'visa', label: 'Visa' }
  ];
  const totalPax = ['autoPaxAdult', 'autoPaxChild', 'autoPaxInfant']
    .reduce((sum, id) => sum + (Number($(id)?.value) || 0), 0);

  root.innerHTML = autoServiceEntries.map((entry, index) => {
    const config = entry.key ? getAutoServiceConfig(entry.key) : null;
    const item = config?.options.find(option => String(option.id) === String(entry.selectedId || ''));
    const routeHasVehicleCount = entry.key === 'transport' && item &&
      item.vehicle !== 'Bullet Train' && (item.priceType || 'per_vehicle') === 'per_vehicle';
    const serviceTypeOptions = typeOptions.map(option =>
      `<option value="${option.key}" ${entry.key === option.key ? 'selected' : ''}>${option.label}</option>`
    ).join('');
    const searchId = `autoServiceSearch${entry.id}`;
    const selectId = `autoServiceSelect${entry.id}`;
    return `<article class="auto-service-card">
      <div class="auto-service-entry-head">
        <b>Service ${index + 1}</b>
        <button type="button" class="auto-service-remove" aria-label="Remove service ${index + 1}" onclick="removeAutoServiceEntry(${entry.id})">✕</button>
      </div>
      <div class="field">
        <label for="autoServiceType${entry.id}">Service type</label>
        <select id="autoServiceType${entry.id}" onchange="setAutoServiceEntryType(${entry.id},this.value)">
          <option value="">Choose a service</option>${serviceTypeOptions}
        </select>
      </div>
      ${entry.key ? `
        <div class="field auto-service-choice-field">
          <label for="${searchId}">Select ${esc(config.title)}</label>
          <input type="search" class="auto-service-search ${item ? 'has-selection' : ''}" id="${searchId}"
            list="autoServiceOptions${entry.id}" placeholder="${config.options.length ? `Search ${config.title.toLowerCase()}...` : 'No master data available'}"
            value="${item ? escapeAttr(config.label(item)) : ''}" autocomplete="off"
            oninput="syncAutoServiceEntrySearch(${entry.id})" onchange="syncAutoServiceEntrySearch(${entry.id})"
            ${config.options.length ? '' : 'disabled'}>
          <datalist id="autoServiceOptions${entry.id}">
            ${config.options.map(option => `<option value="${escapeAttr(config.label(option))}"></option>`).join('')}
          </datalist>
          <select id="${selectId}" class="auto-search-value" tabindex="-1" aria-hidden="true">
            <option value=""></option>
            ${config.options.map(option => `<option value="${escapeAttr(option.id)}">${esc(config.label(option))}</option>`).join('')}
          </select>
        </div>` : ''}
      ${entry.key === 'flight' ? `
        <div class="auto-service-quantity">
          <span>Flight tickets</span><b>${totalPax} · auto from passengers</b>
        </div>` : ''}
      ${entry.key === 'visa' ? `
        <div class="auto-service-quantity">
          <span>Visa quantity</span><b>${totalPax} · auto from passengers</b>
        </div>` : ''}
      ${entry.key === 'transport' ? routeHasVehicleCount ? `
        <div class="auto-service-quantity">
          <label for="autoServiceQuantity${entry.id}">Vehicle quantity</label>
          <input type="number" id="autoServiceQuantity${entry.id}" min="1" step="1"
            value="${escapeAttr(entry.quantity)}" oninput="updateAutoServiceEntryQuantity(${entry.id},this.value)">
          <small>Passenger capacity অনুযায়ী প্রয়োজন হলে vehicle count বাড়বে।</small>
        </div>` : `
        <div class="auto-service-quantity">
          <span>Transfer quantity</span><b>${item ? 'Auto from passenger rate' : 'Select a per-vehicle route'}</b>
        </div>` : ''}
    </article>`;
  }).join('');
}

function syncAutoHotelSearch(city) {
  const cityKey = city === 'makkah' ? 'Makkah' : 'Madinah';
  const input = $(`auto${cityKey}HotelSearch`);
  const select = $(`auto${cityKey}Hotel`);
  const hotels = city === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
  const value = input.value.trim().toLocaleLowerCase();
  const match = hotels.find(hotel => {
    const label = `${hotel.name}${hotel.star ? ` · ${hotel.star}★` : ''}`;
    return label.toLocaleLowerCase() === value;
  });
  const previous = select.value;
  select.value = match ? String(match.id) : '';
  input.classList.toggle('has-selection', Boolean(match));
  if (previous !== select.value) updateAutoPackageNights(false);
  renderAutoHotelRoomRates();
  renderAutoPackageEstimate();
  renderAutoHotelBudgetMatches();
}

function openAutoPackageModal() {
  if (!isAdmin()) {
    toast('❌ আপনি Package create করতে পারবেন না', 'error');
    return;
  }

  const today = new Date();
  const checkOut = new Date(today);
  checkOut.setDate(checkOut.getDate() + 7);
  setVal('autoCheckIn', autoPackageDateString(today));
  setVal('autoCheckOut', autoPackageDateString(checkOut));
  setVal('autoPaxAdult', 2);
  setVal('autoPaxChild', 0);
  setVal('autoPaxInfant', 0);
  setVal('autoCustomerName', '');
  setVal('autoCustomerId', '');
  $('autoCustomerHint').textContent = 'Type a new name or choose an existing customer.';
  $('autoCustomerHint').classList.remove('is-selected');
  setVal('autoMakkahHotel', '');
  setVal('autoMadinahHotel', '');
  setVal('autoMakkahHotelSearch', '');
  setVal('autoMadinahHotelSearch', '');
  setVal('autoHotelCategory', 'all');
  setVal('autoHotelBudget', '');
  autoHotelRoomRateOverrides = { makkah: {}, madinah: {} };
  autoHotelRoomMixes = { makkah: null, madinah: null };
  autoServiceEntries = [];
  autoServiceEntryCounter = 0;
  $('autoPackageModal')?.querySelectorAll('.auto-disclosure').forEach(details => {
    details.open = false;
  });
  setVal('autoProfitPerAdult', 0);
  setVal('autoMakkahNights', 0);
  setVal('autoMadinahNights', 0);
  setVal('autoRoomSharing', 'triple');
  setVal('autoPresetKey', '');
  $('autoPackageError').textContent = '';
  $('autoPackageError').classList.remove('act');

  const typeSelect = $('autoPackageType');
  const builderTypeSelect = $('pkgType');
  typeSelect.innerHTML = Array.from(builderTypeSelect.options).map(option =>
    `<option value="${escapeAttr(option.value)}">${esc(option.textContent)}</option>`
  ).join('');
  typeSelect.value = 'Standard';
  renderAutoPackagePresets();
  applyAutoPackagePreset('standard');

  $('autoCustomerSuggestions').innerHTML = (STORE.customers || [])
    .filter(customer => customer.customerName)
    .map(customer => `<option value="${escapeAttr(getAutoCustomerLabel(customer))}"></option>`)
    .join('');

  const renderHotelOptions = (select, datalist, hotels) => {
    select.innerHTML = `<option value="">-- Skip hotel --</option>${(hotels || []).map(hotel =>
      `<option value="${escapeAttr(hotel.id)}">${esc(hotel.name)}${hotel.star ? ` · ${esc(hotel.star)}★` : ''}</option>`
    ).join('')}`;
    datalist.innerHTML = (hotels || []).map(hotel => {
      const label = `${hotel.name}${hotel.star ? ` · ${hotel.star}★` : ''}`;
      return `<option value="${escapeAttr(label)}"></option>`;
    }).join('');
  };
  renderHotelOptions($('autoMakkahHotel'), $('autoMakkahHotelOptions'), STORE.makkahHotels);
  renderHotelOptions($('autoMadinahHotel'), $('autoMadinahHotelOptions'), STORE.madinahHotels);
  $('autoMakkahHotelSearch').classList.remove('has-selection');
  $('autoMadinahHotelSearch').classList.remove('has-selection');

  renderAutoServiceEntries();
  showAutoPackageStep(1);
  renderAutoHotelRoomRates();
  renderAutoPackageEstimate();
  renderAutoHotelBudgetMatches();
  openModal('autoPackageModal');
}

function showAutoPackageStep(step) {
  const currentStep = Math.min(3, Math.max(1, step));
  document.querySelectorAll('[data-auto-panel]').forEach(panel => {
    panel.hidden = Number(panel.dataset.autoPanel) !== currentStep;
  });
  document.querySelectorAll('.auto-stepper-item').forEach(item => {
    const itemStep = Number(item.dataset.step);
    item.classList.toggle('is-active', itemStep === currentStep);
    item.classList.toggle('is-done', itemStep < currentStep);
    if (itemStep === currentStep) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  const nextButton = $('autoPackageNext');
  const submitButton = $('autoPackageSubmit');
  if (nextButton) {
    nextButton.hidden = currentStep === 3;
    nextButton.textContent = currentStep === 1 ? 'Continue to Hotels →' : 'Review Package →';
  }
  if (submitButton) submitButton.hidden = currentStep !== 3;
  const footnote = $('autoPackageFootnote');
  if (footnote) {
    footnote.textContent = currentStep === 1
      ? 'Trip, passenger ও customer-এর তথ্য দিন; hotel ও service optional.'
      : currentStep === 2
        ? 'Hotel optional; নির্বাচন করলে city-র nights ও room rate মিলিয়ে নিন.'
        : 'Generate করলে package list-এ save হবে; পরে click করে preview দেখুন.';
  }
}

function goToAutoPackageStep(step) {
  $('autoPackageError').textContent = '';
  $('autoPackageError').classList.remove('act');
  showAutoPackageStep(step);
  $('autoPackageModal')?.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  renderAutoPackageEstimate();
}

function advanceAutoPackageStep() {
  const currentStep = Number(document.querySelector('.auto-stepper-item.is-active')?.dataset.step) || 1;
  const prerequisiteError = currentStep > 1 ? getAutoPackageStepError(1) : '';
  const error = prerequisiteError || getAutoPackageStepError(currentStep);
  const errorElement = $('autoPackageError');
  if (error) {
    errorElement.textContent = error;
    errorElement.classList.add('act');
    errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (prerequisiteError) showAutoPackageStep(1);
    return;
  }
  errorElement.textContent = '';
  errorElement.classList.remove('act');
  showAutoPackageStep(currentStep + 1);
  $('autoPackageModal')?.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  renderAutoPackageEstimate();
}

function getAutoPackageStepError(step) {
  const checkIn = $('autoCheckIn').value;
  const checkOut = $('autoCheckOut').value;
  const nights = getAutoPackageNights();
  const adult = Number($('autoPaxAdult').value);
  const child = Number($('autoPaxChild').value);
  const infant = Number($('autoPaxInfant').value);

  if (!checkIn || !checkOut || !Number.isFinite(nights) || nights <= 0) {
    return 'অনুগ্রহ করে সঠিক Check In এবং Check Out date দিন।';
  }
  if (!Number.isInteger(adult) || adult < 1 ||
      !Number.isInteger(child) || child < 0 ||
      !Number.isInteger(infant) || infant < 0) {
    return 'যাত্রীর সংখ্যা সঠিকভাবে দিন (কমপক্ষে ১ জন Adult থাকতে হবে)।';
  }
  if (step === 1 && !$('autoCustomerName').value.trim()) {
    return 'Package save করতে Customer Name দিন।';
  }

  if (step === 2) {
    const makkahHotel = $('autoMakkahHotel').value;
    const madinahHotel = $('autoMadinahHotel').value;
    const makkahNights = Number($('autoMakkahNights').value) || 0;
    const madinahNights = Number($('autoMadinahNights').value) || 0;
    const budgetText = $('autoHotelBudget').value.trim();
    const hotelBudget = Number(budgetText);
    if (!Number.isInteger(makkahNights) || makkahNights < 0 ||
        !Number.isInteger(madinahNights) || madinahNights < 0) {
      return 'Makkah ও Madinah-এর রাত পূর্ণ সংখ্যা হিসেবে দিন।';
    }
    if (budgetText && (!Number.isFinite(hotelBudget) || hotelBudget < 0)) {
      return 'Hotel budget শূন্য বা তার বেশি দিন।';
    }
    if ((makkahHotel && makkahNights < 1) || (madinahHotel && madinahNights < 1)) {
      return 'যে শহরে hotel নির্বাচন করেছেন, সেখানে কমপক্ষে ১ রাত থাকতে হবে।';
    }
    if ((budgetText || makkahHotel || madinahHotel) && makkahNights + madinahNights !== nights) {
      return 'Makkah ও Madinah-এর রাতের যোগফল package-এর মোট রাতের সমান হতে হবে।';
    }
    if (makkahHotel || madinahHotel) {
      const estimate = getAutoSelectedHotelBudgetEstimate();
      if (estimate.selected.length && !estimate.complete) {
        const insufficientRoomMix = estimate.selected.find(item => item.roomCapacity < adult + child);
        if (insufficientRoomMix) {
          return `${insufficientRoomMix.city} room mix-এর capacity ${insufficientRoomMix.roomCapacity}; সব Adult ও Children-এর জন্য room বাড়ান।`;
        }
        return 'নির্বাচিত hotel-এর missing room rate এখানে যোগ করুন; তারপর আবার Review & Save-এ যান।';
      }
      if (hotelBudget > 0 && estimate.selected.length && estimate.total > hotelBudget) {
        return `নির্বাচিত hotel-এর মোট খরচ ${fmt(estimate.total)}; budget ${fmt(hotelBudget)}-এর মধ্যে আনতে hotel পরিবর্তন করুন।`;
      }
    }
  }
  if (step === 3) {
    const profitText = $('autoProfitPerAdult').value.trim();
    const profitPerAdult = Number(profitText);
    if (profitText && (!Number.isFinite(profitPerAdult) || profitPerAdult < 0)) {
      return 'প্রতি Adult-এর profit শূন্য বা তার বেশি দিন।';
    }
    for (const entry of autoServiceEntries) {
      if (!entry.key) continue;
      const config = getAutoServiceConfig(entry.key);
      if (!config.options.length) {
        return `${config.title}-এর master data নেই। আগে master data যোগ করুন অথবা service-টি সরিয়ে দিন।`;
      }
      if (!entry.selectedId || !config.options.some(item => String(item.id) === String(entry.selectedId))) {
        return `${config.title} নির্বাচন করুন অথবা service-টি সরিয়ে দিন।`;
      }
      if (entry.key === 'transport') {
        const selectedTransport = config.options.find(item => String(item.id) === String(entry.selectedId));
        const quantity = Number(entry.quantity);
        if (selectedTransport && selectedTransport.vehicle !== 'Bullet Train' &&
            (selectedTransport.priceType || 'per_vehicle') === 'per_vehicle' &&
            (!Number.isInteger(quantity) || quantity < 1)) {
          return 'Transfer-এর vehicle quantity কমপক্ষে ১ দিন।';
        }
      }
    }
  }
  return '';
}

function getAutoRoomCounts(pax, sharing) {
  const counts = {};
  const roomCapacities = typeof ROOM_CAPACITY !== 'undefined' ? ROOM_CAPACITY : { single: 1, double: 2, triple: 3, quad: 4 };
  const defaultCapacity = roomCapacities[sharing] || 2;
  let remaining = pax;
  while (remaining > 0) {
    let roomType = sharing;
    let capacity = defaultCapacity;
    if (remaining < defaultCapacity) {
      roomType = remaining === 1 ? 'single' : remaining === 2 ? 'double' : remaining === 3 ? 'triple' : 'quad';
      capacity = roomCapacities[roomType] || remaining;
    }
    counts[roomType] = (counts[roomType] || 0) + 1;
    remaining -= capacity;
  }
  return counts;
}

function getAutoHotelEstimate(hotel, cityType, nights, pax, roomMix = getAutoRoomMix(cityType)) {
  const roomCounts = roomMix;
  const missingRoomTypes = [];
  const roomCapacity = getAutoRoomMixCapacity(roomCounts);
  const roomCount = Object.values(roomCounts).reduce((sum, count) => sum + (Number(count) || 0), 0);
  let total = 0;
  Object.keys(roomCounts).forEach(roomType => {
    if (!(Number(roomCounts[roomType]) > 0)) return;
    const rate = getAutoHotelRoomRate(cityType, hotel, roomType);
    if (rate > 0) total += rate * roomCounts[roomType] * nights;
    else missingRoomTypes.push(roomType);
  });
  return {
    total: Math.round(total),
    roomCounts,
    roomCount,
    roomCapacity,
    missingRoomTypes,
    complete: nights > 0 && pax > 0 && roomCount > 0 && roomCapacity >= pax && missingRoomTypes.length === 0
  };
}

function getAutoHotelSuggestionEstimate(hotel, cityType, nights, pax, roomMix) {
  const estimate = getAutoHotelEstimate(hotel, cityType, nights, pax, roomMix);
  if (estimate.complete || autoHotelRoomMixes[cityType] || !roomMix.single ||
      !estimate.missingRoomTypes.includes('single')) return estimate;

  const alternativeRoomMix = {
    ...roomMix,
    single: 0,
    double: (Number(roomMix.double) || 0) + Number(roomMix.single)
  };
  const alternative = getAutoHotelEstimate(hotel, cityType, nights, pax, alternativeRoomMix);
  return alternative.complete ? alternative : estimate;
}

function getAutoSelectedHotelBudgetEstimate() {
  const pax = (Number($('autoPaxAdult')?.value) || 0) + (Number($('autoPaxChild')?.value) || 0);
  const selected = [];
  let total = 0;
  let complete = true;
  [['Makkah', 'makkah'], ['Madinah', 'madinah']].forEach(([city, cityType]) => {
    const hotelId = $(`auto${city}Hotel`)?.value;
    if (!hotelId) return;
    const hotels = cityType === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
    const hotel = hotels.find(item => String(item.id) === String(hotelId));
    if (!hotel) {
      complete = false;
      return;
    }
    const nights = Number($(`auto${city}Nights`)?.value) || 0;
    const estimate = getAutoHotelEstimate(hotel, cityType, nights, pax, getAutoRoomMix(cityType));
    selected.push({ city, hotel, nights, ...estimate });
    total += estimate.total;
    complete = complete && estimate.complete;
  });
  return { selected, total: Math.round(total), complete };
}

function updateAutoHotelRoomRate(cityType, hotelId, roomType, value) {
  const parsed = value.trim() === '' ? 0 : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return;
  const cityOverrides = autoHotelRoomRateOverrides[cityType];
  if (!cityOverrides[String(hotelId)]) cityOverrides[String(hotelId)] = {};
  cityOverrides[String(hotelId)][roomType] = parsed;
  updateAutoHotelRoomMixSummary(cityType);
  renderAutoPackageEstimate();
  renderAutoHotelBudgetMatches();
}

function updateAutoHotelRoomMixSummary(cityType) {
  const city = cityType === 'makkah' ? 'Makkah' : 'Madinah';
  const summary = $(`auto${city}RoomMixSummary`);
  if (!summary) return;
  const roomMix = getAutoRoomMix(cityType);
  const pax = (Number($('autoPaxAdult')?.value) || 0) + (Number($('autoPaxChild')?.value) || 0);
  const roomCapacity = getAutoRoomMixCapacity(roomMix);
  const roomCount = Object.values(roomMix).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const hotelId = $(`auto${city}Hotel`)?.value;
  const hotels = cityType === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
  const hotel = hotels.find(item => String(item.id) === String(hotelId || ''));
  const missingRates = hotel
    ? Object.keys(roomMix).filter(roomType => Number(roomMix[roomType]) > 0 && !(getAutoHotelRoomRate(cityType, hotel, roomType) > 0))
    : [];
  summary.textContent = `${roomCount} room(s) · ${roomCapacity}/${pax} guests${missingRates.length ? ` · ${missingRates.length} rate missing` : ''}`;
  summary.classList.toggle('has-warning', roomCapacity < pax || missingRates.length > 0);
}

function renderAutoHotelRoomRates() {
  [['Makkah', 'makkah'], ['Madinah', 'madinah']].forEach(([city, cityType]) => {
    const editor = $(`auto${city}RoomRates`);
    const mixEditor = $(`auto${city}RoomMix`);
    const pax = (Number($('autoPaxAdult')?.value) || 0) + (Number($('autoPaxChild')?.value) || 0);
    const roomMix = getAutoRoomMix(cityType);
    const roomCapacity = getAutoRoomMixCapacity(roomMix);
    const roomCount = Object.values(roomMix).reduce((sum, count) => sum + (Number(count) || 0), 0);
    const capacities = typeof ROOM_CAPACITY !== 'undefined' ? ROOM_CAPACITY : { single: 1, double: 2, triple: 3, quad: 4 };
    const hotelId = $(`auto${city}Hotel`)?.value;
    const hotels = cityType === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
    const hotel = hotels.find(item => String(item.id) === String(hotelId || ''));
    updateAutoHotelRoomMixSummary(cityType);
    if (mixEditor) {
      mixEditor.innerHTML = `
        <div class="auto-room-mix-options">
          ${['single', 'double', 'triple', 'quad'].map(roomType => `
            <label class="auto-room-mix-option">
              <span><b>${roomType}</b><small>${capacities[roomType] || 1} guest/room</small></span>
              <input type="number" min="0" max="${Math.max(0, pax)}" step="1" value="${Number(roomMix[roomType]) || 0}"
                aria-label="${city} ${roomType} room count"
                onchange="updateAutoRoomMixCount('${cityType}','${roomType}',this.value)">
            </label>
          `).join('')}
        </div>
        <div class="auto-room-mix-status ${roomCapacity < pax ? 'has-error' : ''}">
          ${roomCount} room(s) · capacity ${roomCapacity} for ${pax} guest(s)
          ${roomCapacity < pax ? ' · Add rooms to fit all Adults and Children.' : ''}
        </div>`;
    }

    if (!editor) return;
    if (!hotel) {
      editor.innerHTML = '';
      return;
    }

    const overrides = autoHotelRoomRateOverrides[cityType][String(hotel.id)] || {};
    editor.innerHTML = Object.keys(roomMix).filter(roomType => roomMix[roomType] > 0).map(roomType => {
      const masterRate = typeof getHotelMasterRoomRate === 'function'
        ? getHotelMasterRoomRate(cityType, hotel.id, roomType)
        : Math.max(0, Number(hotel[roomType]) || 0);
      const value = overrides[roomType] !== undefined ? Number(overrides[roomType]) : masterRate;
      const rateMissing = !(value > 0);
      return `<div class="auto-hotel-rate-row">
        <label for="auto${city}${roomType}Rate">${roomType} · ${roomMix[roomType]} room(s) · rate/room/night</label>
        <input type="number" id="auto${city}${roomType}Rate" min="0" step="1" value="${value > 0 ? escapeAttr(value) : ''}"
          placeholder="${rateMissing ? 'Enter missing rate' : 'Edit rate'}"
          oninput="updateAutoHotelRoomRate('${cityType}','${escapeAttr(hotel.id)}','${roomType}',this.value)">
        <small>${rateMissing ? 'Master rate missing. Enter a manual rate to continue.' : 'Master rate shown; edit here if needed. Manual rate applies as vendor and sell rate.'}</small>
      </div>`;
    }).join('') || '<small class="auto-hotel-rate-empty">Set at least one room count above to enter or check its rate.</small>';
  });
}

function selectAutoHotelBudgetMatch(button) {
  const setHotel = (cityType, hotelId, roomCounts) => {
    const city = cityType === 'makkah' ? 'Makkah' : 'Madinah';
    const hotels = cityType === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
    const hotel = hotels
      .find(item => String(item.id) === String(hotelId || ''));
    const select = $(`auto${city}Hotel`);
    const search = $(`auto${city}HotelSearch`);
    select.value = hotel ? String(hotel.id) : '';
    search.value = hotel ? `${hotel.name}${hotel.star ? ` · ${hotel.star}★` : ''}` : '';
    search.classList.toggle('has-selection', Boolean(hotel));
    if (hotel && roomCounts) autoHotelRoomMixes[cityType] = roomCounts;
  };
  if (button.dataset.makkahId) {
    setHotel('makkah', button.dataset.makkahId, button.dataset.makkahRooms ? JSON.parse(button.dataset.makkahRooms) : null);
  }
  if (button.dataset.madinahId) {
    setHotel('madinah', button.dataset.madinahId, button.dataset.madinahRooms ? JSON.parse(button.dataset.madinahRooms) : null);
  }
  updateAutoPackageNights(false);
}

function renderAutoHotelOnlyEstimate() {
  const estimateEl = $('autoHotelOnlyEstimate');
  if (!estimateEl) return;

  const estimate = getAutoSelectedHotelBudgetEstimate();
  const budget = Number($('autoHotelBudget')?.value) || 0;
  const selectedByCity = new Set(estimate.selected.map(item => item.city));
  const unselectedCities = [['Makkah', 'autoMakkahNights'], ['Madinah', 'autoMadinahNights']]
    .filter(([city, nightsId]) => Number($(nightsId)?.value) > 0 && !selectedByCity.has(city))
    .map(([city]) => city);
  const complete = estimate.complete && unselectedCities.length === 0;
  const rows = estimate.selected.map(item => {
    const rooms = Object.keys(item.roomCounts)
      .filter(roomType => Number(item.roomCounts[roomType]) > 0)
      .map(roomType => `${Number(item.roomCounts[roomType])} ${roomType}`)
      .join(' + ') || 'No rooms selected';
    const missing = item.missingRoomTypes.length
      ? ` · Missing rate: ${item.missingRoomTypes.join(', ')}`
      : '';
    return `<div class="auto-hotel-only-row">
      <span><b>${esc(item.city)} · ${esc(item.hotel.name)}</b><small>${item.nights} night(s) · ${esc(rooms)}${esc(missing)}</small></span>
      <strong>${item.complete ? fmt(item.total) : `${fmt(item.total)}*`}</strong>
    </div>`;
  });
  const totalLabel = estimate.selected.length
    ? complete ? fmt(estimate.total) : `${fmt(estimate.total)}*`
    : 'Not selected';
  const budgetNote = budget > 0 && estimate.selected.length
    ? complete
      ? estimate.total <= budget
        ? ` · ${fmt(budget - estimate.total)} remaining`
        : ` · ${fmt(estimate.total - budget)} over budget`
      : ` · Budget: ${fmt(budget)}`
    : budget > 0 ? ` · Budget: ${fmt(budget)}` : '';
  const missingNote = unselectedCities.length
    ? `Hotel not selected for ${unselectedCities.join(' and ')}.`
    : !estimate.selected.length
      ? 'Choose a hotel suggestion or select one manually.'
      : !estimate.complete
        ? 'Complete room selection and rates to confirm the total.'
        : '';

  estimateEl.innerHTML = `
    <div class="auto-hotel-only-heading">
      <span><b>Hotel-only calculation</b><small>Selected hotel rooms × nights · excludes flights, visa and services</small></span>
      <strong>${totalLabel}</strong>
    </div>
    ${rows.length ? `<div class="auto-hotel-only-rows">${rows.join('')}</div>` : ''}
    <div class="auto-hotel-only-foot ${complete || !estimate.selected.length ? '' : 'has-warning'}">
      <span>${esc(missingNote)}${estimate.selected.length && !complete ? ' *Known subtotal only; some hotel rates or selections are incomplete.' : ''}</span>
      <b>${esc(budgetNote)}</b>
    </div>`;
  estimateEl.classList.toggle('has-selection', estimate.selected.length > 0);
  estimateEl.classList.toggle('has-warning', estimate.selected.length > 0 && !complete);
}

function renderAutoHotelBudgetMatches() {
  const matchesEl = $('autoHotelBudgetMatches');
  const countEl = $('autoHotelMatchCount');
  const statusEl = $('autoHotelBudgetStatus');
  if (!matchesEl || !countEl || !statusEl) return;
  renderAutoHotelOnlyEstimate();

  const budgetText = $('autoHotelBudget').value.trim();
  const budget = Number(budgetText);
  statusEl.className = 'auto-hotel-budget-status';
  countEl.textContent = '';
  if (!budgetText || !Number.isFinite(budget) || budget <= 0) {
    statusEl.textContent = '';
    matchesEl.innerHTML = '<div class="auto-hotel-empty">Enter a total hotel budget to see matching options.</div>';
    return;
  }

  const nights = getAutoPackageNights();
  const pax = (Number($('autoPaxAdult').value) || 0) + (Number($('autoPaxChild').value) || 0);
  const makkahNights = Number($('autoMakkahNights').value) || 0;
  const madinahNights = Number($('autoMadinahNights').value) || 0;
  const plannedNights = makkahNights + madinahNights;
  if (plannedNights !== nights) {
    statusEl.textContent = `Set city nights to match the ${nights}-night package before hotel suggestions can be priced.`;
    statusEl.classList.add('has-warning');
    matchesEl.innerHTML = '';
    return;
  }
  if (!Number.isInteger(nights) || nights < 1 || pax < 1) {
    statusEl.textContent = 'Enter valid travel dates and passenger counts to calculate hotel options.';
    statusEl.classList.add('has-warning');
    matchesEl.innerHTML = '';
    return;
  }

  const selectedEstimate = getAutoSelectedHotelBudgetEstimate();
  const selectedCities = new Set(selectedEstimate.selected.map(item => item.city));
  const hasUnselectedCityHotel = [['Makkah', 'autoMakkahNights'], ['Madinah', 'autoMadinahNights']]
    .some(([city, nightsId]) => Number($(nightsId)?.value) > 0 && !selectedCities.has(city));
  const selectedPlanComplete = selectedEstimate.complete && !hasUnselectedCityHotel;
  if (selectedEstimate.selected.length) {
    if (!selectedPlanComplete) {
      statusEl.textContent = 'Selected hotel subtotal only; complete the planned city hotel selections and room rates to confirm the total.';
      statusEl.classList.add('has-warning');
    } else if (selectedEstimate.total <= budget) {
      statusEl.textContent = `Selected hotel estimate: ${fmt(selectedEstimate.total)} of ${fmt(budget)} budget.`;
      statusEl.classList.add('is-within');
    } else {
      statusEl.textContent = `Selected hotel estimate ${fmt(selectedEstimate.total)} is ${fmt(selectedEstimate.total - budget)} over budget.`;
      statusEl.classList.add('is-over');
    }
  } else {
    statusEl.textContent = `Choose a matching suggestion or select hotels manually. Total budget: ${fmt(budget)}.`;
  }

  const category = $('autoHotelCategory').value;
  const minimumStar = Number(category);
  const matchesCategory = hotel => category === 'all' || (Number.parseInt(hotel.star, 10) || 0) >= minimumStar;
  const makkahHotels = (STORE.makkahHotels || []).filter(matchesCategory);
  const madinahHotels = (STORE.madinahHotels || []).filter(matchesCategory);
  const roomRatesMissing = new Set();
  const roomMixInsufficient = new Set();
  const estimateCandidates = (hotels, city, cityType, cityNights, sharing) => hotels.reduce((items, hotel) => {
    const estimate = getAutoHotelSuggestionEstimate(hotel, cityType, cityNights, pax, sharing);
    if (!estimate.complete) {
      if (estimate.missingRoomTypes.length) roomRatesMissing.add(`${cityType}:${hotel.id}`);
      if (estimate.roomCapacity < pax) roomMixInsufficient.add(city);
      return items;
    }
    items.push({ hotel, city, cityType, nights: cityNights, total: estimate.total, roomMix: estimate.roomCounts });
    return items;
  }, []);

  const makkahRoomMix = getAutoRoomMix('makkah');
  const madinahRoomMix = getAutoRoomMix('madinah');
  const makkahOnlyCandidates = makkahNights > 0
    ? estimateCandidates(makkahHotels, 'Makkah', 'makkah', makkahNights, makkahRoomMix)
    : [];
  const madinahOnlyCandidates = madinahNights > 0
    ? estimateCandidates(madinahHotels, 'Madinah', 'madinah', madinahNights, madinahRoomMix)
    : [];
  const pairCandidates = [];
  if (makkahNights > 0 && madinahNights > 0) {
    makkahHotels.forEach(makkahHotel => {
      const makkahEstimate = getAutoHotelSuggestionEstimate(makkahHotel, 'makkah', makkahNights, pax, makkahRoomMix);
      if (!makkahEstimate.complete) {
        if (makkahEstimate.missingRoomTypes.length) roomRatesMissing.add(`makkah:${makkahHotel.id}`);
        if (makkahEstimate.roomCapacity < pax) roomMixInsufficient.add('Makkah');
        return;
      }
      madinahHotels.forEach(madinahHotel => {
        const madinahEstimate = getAutoHotelSuggestionEstimate(madinahHotel, 'madinah', madinahNights, pax, madinahRoomMix);
        if (!madinahEstimate.complete) {
          if (madinahEstimate.missingRoomTypes.length) roomRatesMissing.add(`madinah:${madinahHotel.id}`);
          if (madinahEstimate.roomCapacity < pax) roomMixInsufficient.add('Madinah');
          return;
        }
        const total = makkahEstimate.total + madinahEstimate.total;
        pairCandidates.push({
          makkahHotel, madinahHotel, makkahNights, madinahNights, total,
          makkahRoomMix: makkahEstimate.roomCounts,
          madinahRoomMix: madinahEstimate.roomCounts,
          label: `${makkahHotel.name} (${makkahHotel.star}★) + ${madinahHotel.name} (${madinahHotel.star}★)`,
          detail: `${makkahNights} nights Makkah · ${getAutoRoomCountsLabel(makkahEstimate.roomCounts)}; ${madinahNights} nights Madinah · ${getAutoRoomCountsLabel(madinahEstimate.roomCounts)}`
        });
      });
    });
  }

  const getOptionStarLevel = item => {
    const hotels = item.hotel ? [item.hotel] : [item.makkahHotel, item.madinahHotel];
    return hotels.reduce((highest, hotel) => Math.max(highest, Number.parseInt(hotel?.star, 10) || 0), 0);
  };
  const selectBudgetOptions = (items, limit) => {
    const inBudget = items.filter(item => item.total <= budget).sort((a, b) => a.total - b.total);
    let options;
    if (inBudget.length) {
      const firstStar = category === 'all' ? 3 : minimumStar;
      options = [];
      for (let star = firstStar; star <= 5 && options.length < limit; star++) {
        const bestAtStar = inBudget.find(item => getOptionStarLevel(item) === star);
        if (bestAtStar) options.push(bestAtStar);
      }
      inBudget.forEach(item => {
        if (options.length < limit && !options.includes(item)) options.push(item);
      });
    } else {
      options = [...items].sort((a, b) => a.total - b.total).slice(0, limit);
    }
    return { items: options.slice(0, limit), closest: !inBudget.length && items.length > 0, count: inBudget.length || items.length };
  };
  const pairOptions = selectBudgetOptions(pairCandidates, 4);
  const makkahOptions = selectBudgetOptions(makkahOnlyCandidates, 3);
  const madinahOptions = selectBudgetOptions(madinahOnlyCandidates, 3);
  const closestGroups = [pairOptions, makkahOptions, madinahOptions].filter(options => options.closest).length;
  if (closestGroups) {
    statusEl.textContent = `${statusEl.textContent} যে ধরনের option budget-এর মধ্যে নেই, সেই group-এর closest hotel-ও দেখানো হয়েছে; extra amount card-এ দেখুন।`;
    statusEl.classList.add('has-warning');
  }

  const matchCard = (makkahHotel, madinahHotel, total, label, detail, makkahRoomMix, madinahRoomMix) => {
    const isOverBudget = total > budget;
    return `
    <button type="button" class="auto-hotel-match-card ${isOverBudget ? 'is-over-budget' : ''}"
      data-makkah-id="${escapeAttr(makkahHotel?.id || '')}"
      data-madinah-id="${escapeAttr(madinahHotel?.id || '')}"
      data-makkah-rooms="${makkahRoomMix ? escapeAttr(JSON.stringify(makkahRoomMix)) : ''}"
      data-madinah-rooms="${madinahRoomMix ? escapeAttr(JSON.stringify(madinahRoomMix)) : ''}"
      onclick="selectAutoHotelBudgetMatch(this)">
      <strong>${esc(label)}</strong>
      <small>${esc(detail)}</small>
      <span class="auto-hotel-match-cost">${fmt(total)}${isOverBudget ? ` · +${fmt(total - budget)}` : ''}</span>
      <span class="auto-hotel-match-use">${isOverBudget ? `Over budget by ${fmt(total - budget)} · ` : ''}Use this option →</span>
    </button>`;
  };
  const group = (title, options, items) => items.length
    ? `<section class="auto-hotel-match-group"><h5>${esc(options.closest ? `Closest ${title}` : title)}</h5><div class="auto-hotel-match-grid">${items.map(item =>
        matchCard(item.makkahHotel || null, item.madinahHotel || null, item.total, item.label, item.detail, item.makkahRoomMix, item.madinahRoomMix)
      ).join('')}</div></section>`
    : '';

  const shownPairs = pairOptions.items;
  const shownMakkah = makkahOptions.items.map(item => ({
    makkahHotel: item.hotel, madinahHotel: null, total: item.total, makkahRoomMix: item.roomMix,
    label: `${item.hotel.name} (${item.hotel.star}★)`, detail: `${makkahNights} nights in Makkah · ${getAutoRoomCountsLabel(item.roomMix)}`
  }));
  const shownMadinah = madinahOptions.items.map(item => ({
    makkahHotel: null, madinahHotel: item.hotel, total: item.total, madinahRoomMix: item.roomMix,
    label: `${item.hotel.name} (${item.hotel.star}★)`, detail: `${madinahNights} nights in Madinah · ${getAutoRoomCountsLabel(item.roomMix)}`
  }));
  const groups = [
    group('Makkah + Madinah', pairOptions, shownPairs),
    group('Makkah only', makkahOptions, shownMakkah),
    group('Madinah only', madinahOptions, shownMadinah)
  ].filter(Boolean);
  const shownCount = shownPairs.length + shownMakkah.length + shownMadinah.length;
  const candidateCount = pairOptions.count + makkahOptions.count + madinahOptions.count;
  countEl.textContent = shownCount
    ? candidateCount > shownCount ? `${shownCount} shown · ${candidateCount} options` : `${shownCount} suggestions`
    : '';
  const roomCapacityNote = roomMixInsufficient.size
    ? ` Room mix capacity is too low for all guests in ${Array.from(roomMixInsufficient).join(' and ')}. Add rooms above.`
    : '';
  const roomRateNote = roomRatesMissing.size
    ? `${roomRatesMissing.size} hotel(s) hidden because a required room rate is missing.`
    : '';
  matchesEl.innerHTML = groups.length
    ? `${groups.join('')}${roomCapacityNote || roomRateNote ? `<div class="auto-hotel-empty">${esc(`${roomRateNote} ${roomCapacityNote}`.trim())}</div>` : ''}`
    : `<div class="auto-hotel-empty">No complete hotel option could be priced for this room mix and stay plan.${roomRateNote ? ` ${esc(roomRateNote)}` : ''}${esc(roomCapacityNote)}</div>`;
}

function renderAutoPackageEstimate() {
  const rows = [];
  const warnings = [];
  const adults = Math.max(0, Number($('autoPaxAdult')?.value) || 0);
  const children = Math.max(0, Number($('autoPaxChild')?.value) || 0);
  const infants = Math.max(0, Number($('autoPaxInfant')?.value) || 0);
  const chargeablePax = adults + children;
  const totalPax = chargeablePax + infants;
  let knownSellTotal = 0;
  let vendorCostTotal = 0;
  let selectedHotelCost = 0;
  let selectedHotelCostKnown = true;
  let selectedHotelCount = 0;

  const addRow = (label, quantity, sell, cost, sellKnown = true, costKnown = true) => {
    if (sellKnown) knownSellTotal += sell;
    if (costKnown) vendorCostTotal += cost;
    rows.push(`<div class="auto-estimate-row">
      <span><b>${esc(label)}</b><small>${esc(quantity)}</small></span>
      <b>${sellKnown ? fmt(sell) : 'Set in builder'}</b>
      <b>${costKnown ? fmt(cost) : 'Rate missing'}</b>
    </div>`);
  };
  [['Makkah', 'makkah'], ['Madinah', 'madinah']].forEach(([city, cityType]) => {
    const hotelId = $(`auto${city}Hotel`)?.value;
    const hotel = (cityType === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [])
      .find(item => String(item.id) === String(hotelId || ''));
    if (!hotel) return;
    const nights = Number($(`auto${city}Nights`)?.value) || 0;
    const estimate = getAutoHotelEstimate(hotel, cityType, nights, chargeablePax, getAutoRoomMix(cityType));
    const roomDetails = Object.keys(estimate.roomCounts)
      .filter(roomType => estimate.roomCounts[roomType] > 0)
      .map(roomType => `${estimate.roomCounts[roomType]} ${roomType}`);
    selectedHotelCount++;
    selectedHotelCost += estimate.total;
    selectedHotelCostKnown = selectedHotelCostKnown && estimate.complete;
    estimate.missingRoomTypes.forEach(roomType => warnings.push(`${city}: ${roomType} room vendor rate নেই।`));
    if (estimate.roomCapacity < chargeablePax) {
      warnings.push(`${city}: room mix capacity ${estimate.roomCapacity}; অন্তত ${chargeablePax} guest-এর জন্য room বাড়ান।`);
    }
    addRow(`${city} Hotel`, `${nights} nights · ${roomDetails.join(', ') || 'no rooms'}`, estimate.total, estimate.total, estimate.complete, estimate.complete);
    warnings.push(`${city}: hotel estimate master/manual room rate থেকে নেওয়া হয়েছে—Builder-এ যাচাই করুন।`);
  });

  autoServiceEntries.forEach((entry, index) => {
    if (!entry.key) return;
    const config = getAutoServiceConfig(entry.key);
    const item = config.options.find(option => String(option.id) === String(entry.selectedId || ''));
    const label = `${config.title} ${index + 1}`;
    if (!item) {
      warnings.push(`${label}: master item নির্বাচন করুন।`);
      return;
    }

    if (entry.key === 'flight') {
      const fare = (item.fareAdult || item.fare || 0) * adults +
                   (item.fareChild || 0) * children +
                   (item.fareInfant || 0) * infants;
      const cost = (item.costAdult || item.netPrice || item.fareAdult || item.fare || 0) * adults +
                   (item.costChild || item.fareChild || 0) * children +
                   (item.costInfant || item.fareInfant || 0) * infants;
      const missing = (adults > 0 && !(item.fareAdult || item.fare)) ||
                      (children > 0 && !item.fareChild) ||
                      (infants > 0 && !item.fareInfant);
      if (missing) warnings.push(`${label}: এক বা একাধিক passenger rate নেই।`);
      addRow(`${label} · ${config.label(item)}`, `${totalPax} tickets · ${adults}A/${children}C/${infants}I`, fare, cost, !missing, true);
    } else if (entry.key === 'transport') {
      let sell = 0, cost = 0, quantity = '';
      let missing = false;
      if (item.vehicle === 'Bullet Train') {
        sell = (item.adultSell || 0) * adults + (item.childSell || 0) * children + (item.infantSell || 0) * infants;
        cost = (item.adultCost || 0) * adults + (item.childCost || 0) * children + (item.infantCost || 0) * infants;
        missing = (adults > 0 && !item.adultSell) || (children > 0 && !item.childSell) || (infants > 0 && !item.infantSell);
        quantity = `${totalPax} pax`;
      } else {
        const priceType = item.priceType || 'per_vehicle';
        const capacity = Number(VEHICLE_CAPACITY[item.vehicle] || item.capacity || 12);
        const requestedVehicles = Math.max(1, Number(entry.quantity) || 1);
        const multiplier = priceType === 'per_vehicle'
          ? Math.max(requestedVehicles, capacity > 0 ? Math.ceil(chargeablePax / capacity) : 1)
          : Math.max(1, chargeablePax);
        sell = Number(item.sellPrice !== undefined ? item.sellPrice : item.price || 0) * multiplier;
        cost = Number(item.vendorCost !== undefined ? item.vendorCost : item.price || 0) * multiplier;
        missing = sell <= 0;
        quantity = `${multiplier} ${priceType === 'per_vehicle' ? 'vehicle(s)' : 'pax'}`;
      }
      if (missing) warnings.push(`${label}: sell rate নেই।`);
      if (cost <= 0) warnings.push(`${label}: vendor cost rate নেই।`);
      addRow(`${label} · ${config.label(item)}`, quantity, sell, cost, !missing, cost > 0);
    } else if (entry.key === 'ziyarah') {
      const best = typeof autoSelectBestCar === 'function'
        ? autoSelectBestCar(chargeablePax, item.carRates || {})
        : null;
      if (!best) warnings.push(`${label}: উপযুক্ত car rate নেই।`);
      else addRow(`${label} · ${config.label(item)}`, `${best.cars} ${best.car}`, best.rate * best.cars, best.rate * best.cars);
    } else if (entry.key === 'visa') {
      const rate = Number(item.priceAdult || item.price || 0);
      const cost = Number(item.costAdult || 0) * totalPax;
      const missing = rate <= 0;
      if (missing) warnings.push(`${label}: visa sell rate নেই।`);
      if (cost <= 0) warnings.push(`${label}: visa vendor cost rate নেই।`);
      addRow(`${label} · ${config.label(item)}`, `${totalPax} pax × ${fmt(rate)}`, rate * totalPax, cost, !missing, cost > 0);
    }
  });

  const hotelBudget = Number($('autoHotelBudget')?.value) || 0;
  if (hotelBudget > 0 && selectedHotelCount) {
    if (!selectedHotelCostKnown) warnings.push('Selected hotel total cannot be verified until all room vendor rates are added.');
    else if (selectedHotelCost > hotelBudget) {
      warnings.push(`Selected hotel estimate ${fmt(selectedHotelCost)} exceeds the ${fmt(hotelBudget)} total hotel budget.`);
    }
  }

  const profitPerAdult = Math.max(0, Number($('autoProfitPerAdult')?.value) || 0);
  const totalAdultProfit = Math.round(profitPerAdult * adults);
  const profitTotalEl = $('autoProfitTotal');
  if (profitTotalEl) profitTotalEl.textContent = fmt(totalAdultProfit);
  const profitCountEl = $('autoProfitCountLabel');
  if (profitCountEl) profitCountEl.textContent = `Based on ${adults} adult${adults === 1 ? '' : 's'}`;

  const totalEl = $('autoKnownSellTotal');
  const costEl = $('autoVendorCostTotal');
  if (totalEl) totalEl.textContent = fmt(knownSellTotal);
  if (costEl) costEl.textContent = fmt(vendorCostTotal);
  const breakdown = $('autoEstimateBreakdown');
  if (breakdown) {
    breakdown.innerHTML = `<div class="auto-estimate-row auto-estimate-head"><span>Item / Quantity</span><b>Known Sell</b><b>Vendor Cost</b></div>${rows.length ? rows.join('') : '<div class="auto-estimate-empty">Service নির্বাচন করলে হিসাব এখানে দেখা যাবে।</div>'}`;
  }
  const warningEl = $('autoRateWarnings');
  if (warningEl) {
    warningEl.innerHTML = warnings.length
      ? `<b>Rate check</b><ul>${Array.from(new Set(warnings)).map(warning => `<li>${esc(warning)}</li>`).join('')}</ul>`
      : '<span>নির্বাচিত service-এর master rate check করা হয়েছে।</span>';
    warningEl.classList.toggle('has-warning', warnings.length > 0);
  }
  renderAutoPackageSummary(warnings);
}

function renderAutoPackageSummary(warnings = []) {
  const summary = $('autoPackageSummary');
  if (!summary) return;
  const uniqueWarnings = Array.from(new Set(warnings));

  const checkIn = $('autoCheckIn')?.value || '—';
  const checkOut = $('autoCheckOut')?.value || '—';
  const nights = getAutoPackageNights();
  const customerName = $('autoCustomerName')?.value.trim() || 'Customer not selected';
  const pax = [
    `${Number($('autoPaxAdult')?.value) || 0} adult`,
    `${Number($('autoPaxChild')?.value) || 0} child`,
    `${Number($('autoPaxInfant')?.value) || 0} infant`
  ].join(' · ');
  const hotelParts = [];
  [['Makkah', 'makkah'], ['Madinah', 'madinah']].forEach(([city, key]) => {
    const hotelId = $(`auto${city}Hotel`)?.value;
    const hotels = key === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
    const hotel = hotels.find(item => String(item.id) === String(hotelId || ''));
    if (hotel) {
      hotelParts.push(`${hotel.name} · ${Number($(`auto${city}Nights`)?.value) || 0} nights · ${getAutoRoomMixLabel(key)}`);
    }
  });
  const hotelBudget = Number($('autoHotelBudget')?.value) || 0;
  const selectedHotelEstimate = getAutoSelectedHotelBudgetEstimate();
  const hotelCategory = $('autoHotelCategory')?.selectedOptions?.[0]?.textContent || 'Any star category';
  const hotelBudgetText = hotelBudget > 0
    ? `${hotelCategory} · ${fmt(hotelBudget)} total · ${selectedHotelEstimate.selected.length
      ? selectedHotelEstimate.complete ? `${fmt(selectedHotelEstimate.total)} selected estimate` : 'selected rate missing'
      : 'not selected'}`
    : `${hotelCategory} · Budget not set`;
  const profitPerAdult = Math.max(0, Number($('autoProfitPerAdult')?.value) || 0);
  const totalAdultProfit = Math.round(profitPerAdult * (Number($('autoPaxAdult')?.value) || 0));
  const selectedServices = autoServiceEntries.map((entry, index) => {
    if (!entry.key) return '';
    const config = getAutoServiceConfig(entry.key);
    const item = config.options.find(option => String(option.id) === String(entry.selectedId || ''));
    if (!item) return `${config.title} ${index + 1} · not selected`;
    if (entry.key === 'flight') {
      const totalPax = ['autoPaxAdult', 'autoPaxChild', 'autoPaxInfant']
        .reduce((sum, id) => sum + (Number($(id)?.value) || 0), 0);
      return `${config.label(item)} · ${totalPax} tickets (auto)`;
    }
    if (entry.key === 'transport') {
      const chargeablePax = (Number($('autoPaxAdult')?.value) || 0) + (Number($('autoPaxChild')?.value) || 0);
      if (item.vehicle === 'Bullet Train' || (item.priceType || 'per_vehicle') !== 'per_vehicle') {
        return config.label(item) + ' · passenger-based';
      }
      const capacity = Number(VEHICLE_CAPACITY[item.vehicle] || item.capacity || 12);
      const vehicles = Math.max(Number(entry.quantity) || 1, capacity > 0 ? Math.ceil(chargeablePax / capacity) : 1);
      return `${config.label(item)} · ${vehicles} vehicle(s)`;
    }
    return config.label(item);
  }).filter(Boolean);

  summary.innerHTML = `
    <div class="auto-summary-grid">
      <div class="auto-summary-item"><span>Customer</span><b>${esc(customerName)}</b></div>
      <div class="auto-summary-item"><span>Travel dates</span><b>${esc(checkIn)} → ${esc(checkOut)}${nights > 0 ? ` · ${nights} nights` : ''}</b></div>
      <div class="auto-summary-item"><span>Passengers</span><b>${esc(pax)}</b></div>
      <div class="auto-summary-item"><span>Package type</span><b>${esc($('autoPackageType')?.value || 'Standard')}</b></div>
      <div class="auto-summary-item"><span>Hotel budget</span><b>${esc(hotelBudgetText)}</b></div>
      <div class="auto-summary-item"><span>Profit · Adult only</span><b>${esc(`${fmt(profitPerAdult)} × ${Number($('autoPaxAdult')?.value) || 0} = ${fmt(totalAdultProfit)}`)}</b></div>
      <div class="auto-summary-item auto-summary-wide"><span>Hotels</span><b>${hotelParts.length ? hotelParts.map(esc).join(' · ') : 'No hotels selected'}</b></div>
      <div class="auto-summary-item auto-summary-wide"><span>Services</span><b>${selectedServices.length ? selectedServices.map(esc).join(' · ') : 'No extra services selected'}</b></div>
    </div>
    <div class="auto-summary-rates ${uniqueWarnings.length ? 'has-warning' : 'is-ready'}">
      <b>${uniqueWarnings.length ? `${uniqueWarnings.length} rate note${uniqueWarnings.length === 1 ? '' : 's'}` : 'Rate check passed'}</b>
      ${uniqueWarnings.length
        ? `<ul>${uniqueWarnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul>`
        : '<span>Selected items have no missing-rate warnings.</span>'}
    </div>`;
}

function updateAutoPackageNights(resetSplit, manualDateChange = false) {
  const nights = getAutoPackageNights();
  const duration = $('autoPackageDuration');
  if (duration) duration.value = nights >= 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'Invalid date range';
  if (manualDateChange && $('autoPresetKey').value) {
    setVal('autoPresetKey', '');
    $('autoPresetChoices')?.querySelectorAll('[data-preset]').forEach(card => card.classList.remove('is-selected'));
  }

  const makkahInput = $('autoMakkahNights');
  const madinahInput = $('autoMadinahNights');
  if (!makkahInput || !madinahInput) return;

  makkahInput.max = Math.max(0, nights);
  madinahInput.max = Math.max(0, nights);
  if (resetSplit) {
    makkahInput.value = Math.ceil(Math.max(0, nights) / 2);
    madinahInput.value = Math.floor(Math.max(0, nights) / 2);
  }

  const makkahNights = Math.max(0, Number(makkahInput.value) || 0);
  const madinahNights = Math.max(0, Number(madinahInput.value) || 0);
  const selectedNights = makkahNights + madinahNights;
  const makkahSelected = Boolean($('autoMakkahHotel')?.value);
  const madinahSelected = Boolean($('autoMadinahHotel')?.value);
  const hint = $('autoHotelNightsHint');
  if (hint) {
    const matches = selectedNights === nights && nights > 0;
    hint.textContent = matches
      ? `Planned stay: ${makkahNights} Makkah + ${madinahNights} Madinah = ${selectedNights} / ${nights} nights.`
      : `Planned stay: ${selectedNights} / ${nights} nights. Adjust the city nights to match the package duration.`;
    hint.classList.toggle('has-error', !matches && (makkahSelected || madinahSelected || Number($('autoHotelBudget')?.value) > 0));
  }
  renderAutoHotelRoomRates();
  renderAutoPackageEstimate();
  renderAutoHotelBudgetMatches();
}

function configureAutoPackageHotelRooms(hotel, cityType, nights) {
  let adultsRemaining = Number($('autoPaxAdult')?.value) || 0;
  let childrenRemaining = Number($('autoPaxChild')?.value) || 0;
  const roomCounts = getAutoRoomMix(cityType);
  const masterHotels = cityType === 'makkah' ? STORE.makkahHotels || [] : STORE.madinahHotels || [];
  const masterHotel = masterHotels.find(item => String(item.id) === String(hotel.hotelId));
  if (!masterHotel) throw new Error(`${cityType} hotel not found while creating rooms.`);
  hotel.rooms = [];
  ['quad', 'triple', 'double', 'single'].forEach(roomType => {
    const capacity = Number(ROOM_CAPACITY[roomType]) || 2;
    for (let index = 0; index < roomCounts[roomType]; index++) {
      hotelRoomCounter++;
      const adults = Math.min(capacity, adultsRemaining);
      adultsRemaining -= adults;
      const children = Math.min(capacity - adults, childrenRemaining);
      childrenRemaining -= children;
      const room = {
        id: hotelRoomCounter,
        type: roomType,
        adults,
        children,
        nights,
        rate: getAutoHotelRoomRate(cityType, masterHotel, roomType),
        meal: 'room_only',
        mealRate: 0
      };
      const override = autoHotelRoomRateOverrides[cityType]?.[String(hotel.hotelId)]?.[roomType];
      if (override !== undefined && Number(override) > 0) room.manualVendorRate = Number(override);
      room.vendorRate = getHotelRoomVendorRate(cityType, hotel, room);
      hotel.rooms.push(room);
    }
  });
}

function generateAutoPackage() {
  const error = $('autoPackageError');
  const checkIn = $('autoCheckIn').value;
  const checkOut = $('autoCheckOut').value;
  const nights = getAutoPackageNights();
  const paxAdult = Number($('autoPaxAdult').value);
  const paxChild = Number($('autoPaxChild').value);
  const paxInfant = Number($('autoPaxInfant').value);
  const profitPerAdult = Math.max(0, Number($('autoProfitPerAdult').value) || 0);
  const totalAdultProfit = Math.round(profitPerAdult * paxAdult);
  const customerName = $('autoCustomerName').value.trim();
  const selectedCustomer = (STORE.customers || []).find(customer =>
    String(customer.id) === String($('autoCustomerId').value)
  );
  const makkahHotelId = $('autoMakkahHotel').value;
  const madinahHotelId = $('autoMadinahHotel').value;
  const makkahNights = Number($('autoMakkahNights').value) || 0;
  const madinahNights = Number($('autoMadinahNights').value) || 0;
  const includedServices = autoServiceEntries.filter(entry => entry.key && entry.selectedId);

  error.textContent = '';
  error.classList.remove('act');

  let errorStep = 1;
  error.textContent = getAutoPackageStepError(1);
  if (!error.textContent) {
    errorStep = 2;
    error.textContent = getAutoPackageStepError(2);
  }
  if (!error.textContent) {
    errorStep = 3;
    error.textContent = getAutoPackageStepError(3);
  }

  if (error.textContent) {
    error.classList.add('act');
    showAutoPackageStep(errorStep);
    return;
  }

  const submit = $('autoPackageSubmit');
  submit.disabled = true;
  submit.textContent = '⏳ Saving package...';
  closeModal('autoPackageModal');
  showLoading('Saving your package...');

  (async () => {
    try {
      await openBuilder();
      const packageType = $('autoPackageType').value || 'Standard';
      const presetKey = $('autoPresetKey').value;
      const defaultSharing = makkahHotelId ? getAutoRoomSharing('makkah')
        : madinahHotelId ? getAutoRoomSharing('madinah')
          : $('autoRoomSharing').value || 'double';
      setVal('pkgType', packageType);
      setVal('pkgTemplateKey', presetKey);
      setVal('roomSharing', defaultSharing);
      builderDefaultRoomSharing = defaultSharing;
      setVal('pkgCheckIn', checkIn);
      setVal('pkgCheckOut', checkOut);
      setVal('paxAdult', paxAdult);
      setVal('paxChild', paxChild);
      setVal('paxInfant', paxInfant);
      setVal('pkgCustomerName', customerName);
      setVal('pkgCustomerPhone', selectedCustomer?.phone || '');
      setVal('pkgCustomerPassport', selectedCustomer?.passport || '');
      setVal('pkgCustomerEmail', selectedCustomer?.email || '');
      setVal('pkgCustomerNationality', selectedCustomer?.nationality || 'Bangladeshi');
      setVal('markupType', 'fixed');
      setVal('markupPercent', 0);
      setVal('markupValue', totalAdultProfit);
      setVal('pkgName', `${packageType} Umrah Package`);
      calcDuration();

      const makkahDateIn = checkIn;
      const makkahDateOut = addAutoPackageDays(checkIn, makkahNights);
      const madinahDateIn = makkahDateOut;
      const madinahDateOut = checkOut;

      if (makkahHotelId) {
        const hotel = makkahItems[0];
        hotel.checkIn = makkahDateIn;
        hotel.checkOut = makkahDateOut;
        hotel._makkahDateManual = true;
        onMakkahHotelChange(hotel.id, makkahHotelId);
      } else {
        makkahItems = [];
        renderMakkahHotelsList();
      }

      if (madinahHotelId) {
        const hotel = madinahItems[0];
        hotel.checkIn = madinahDateIn;
        hotel.checkOut = madinahDateOut;
        hotel._madinahDateManual = true;
        onMadinahHotelChange(hotel.id, madinahHotelId);
      } else {
        madinahItems = [];
        renderMadinahHotelsList();
      }
      syncHotelRoomNightsFromDates(nights);
      if (makkahHotelId) configureAutoPackageHotelRooms(makkahItems[0], 'makkah', makkahNights);
      if (madinahHotelId) configureAutoPackageHotelRooms(madinahItems[0], 'madinah', madinahNights);

      includedServices.forEach(entry => {
        const selectedId = entry.selectedId;
        if (entry.key === 'flight') {
          addFlightItem();
          if (selectedId) onFlightItemChange(flightItems[flightItems.length - 1].id, selectedId);
        } else if (entry.key === 'transport') {
          addTransportItem();
          if (selectedId) {
            onTransportItemChange(transportItems[transportItems.length - 1].id, selectedId);
            const transport = transportItems[transportItems.length - 1];
            if (transport && transport.vehicle !== 'Bullet Train' && (transport.priceType || 'per_vehicle') === 'per_vehicle') {
              const capacity = Number(VEHICLE_CAPACITY[transport.vehicle] || transport.capacity || 12);
              const requiredVehicles = capacity > 0 ? Math.ceil((paxAdult + paxChild) / capacity) : 1;
              transport.vehicleCount = Math.max(1, Math.floor(Number(entry.quantity) || 1), requiredVehicles);
              recalcTransportTotals(transport);
            }
          }
        } else if (entry.key === 'visa') {
          addVisaItem();
          if (selectedId) onVisaItemChange(visaItems[visaItems.length - 1].id, selectedId);
        } else {
          addZiyarahTransportItem();
          if (selectedId && ziyarahTransportItems.length) {
            onZiyarahSelectChange(ziyarahTransportItems.length - 1, selectedId);
          }
        }
      });

      renderAll();
      recalc();
      toggleMarkupInput();
      const saved = await savePackage();
      if (saved) {
        try {
          await nav('packages', document.querySelector('.ni[data-page="packages"]'));
        } catch (e) {
          toast('Package saved, but the package list could not be opened: ' + e.message, 'error');
        }
      }
    } catch (e) {
      toast('Package save করা যায়নি: ' + e.message, 'error');
    } finally {
      hideLoading();
      submit.disabled = false;
      submit.textContent = '✨ Generate Package';
    }
  })();
}
