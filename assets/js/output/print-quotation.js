/* ============================================================
   UMRAH BUILDER — OUTPUT / PRINT QUOTATION
   Quotation preview + PDF download + content parser
   ============================================================ */

/* ==================== PARSE CONTENT ==================== */
function parseContent(content) {
  const lines = (content || '').split('\n');
  const sections = [];
  let currentSection = { title: 'Activities', items: [] };
  let hasExplicitSection = false;

  const sectionHeaders = /^(activities|places to visit|duration|notes|important|inclusions?|exclusions?|ziyarah)\s*:?\s*$/i;
  const durationLine = /^duration\s*:\s*(.+)/i;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const durMatch = line.match(durationLine);
    if (durMatch) {
      if (currentSection.items.length && currentSection.title !== 'Duration') {
        sections.push(currentSection);
        currentSection = { title: 'Duration', items: [] };
      } else if (currentSection.title !== 'Duration') {
        currentSection.title = 'Duration';
      }
      currentSection.items.push(durMatch[1]);
      hasExplicitSection = true;
      continue;
    }

    if (sectionHeaders.test(line)) {
      if (currentSection.items.length && hasExplicitSection) {
        sections.push(currentSection);
      } else if (currentSection.items.length && !hasExplicitSection && currentSection.title !== 'Activities') {
        sections.push(currentSection);
      }
      currentSection = { title: line.replace(/:\s*$/, ''), items: [] };
      hasExplicitSection = true;
      continue;
    }

    const bulletMatch = line.match(/^[-•*]\s*(.+)/);
    if (bulletMatch) {
      currentSection.items.push(bulletMatch[1]);
      continue;
    }
    currentSection.items.push(line);
  }
  if (currentSection.items.length) sections.push(currentSection);
  return sections;
}

function calculateQuotationPassengerBreakdown(pkg) {
  const amount = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const counts = {
    adult: Math.max(0, amount(pkg.paxAdult)),
    child: Math.max(0, amount(pkg.paxChild)),
    infant: Math.max(0, amount(pkg.paxInfant))
  };
  const categoryBaseTotals = { adult: 0, child: 0, infant: 0 };
  const categoryFinalTotals = { adult: 0, child: 0, infant: 0 };
  const componentRows = [];
  const adjustmentRows = [];

  const totalOf = totals => totals.adult + totals.child + totals.infant;
  const weightedTotal = rates =>
    rates.adult * counts.adult + rates.child * counts.child + rates.infant * counts.infant;

  const allocateShared = total => ({ adult: total, child: 0, infant: 0 });

  const addRow = (collection, label, totals, type = 'component') => {
    const categoryTotals = {
      adult: amount(totals.adult),
      child: amount(totals.child),
      infant: amount(totals.infant)
    };
    const overall = totalOf(categoryTotals);
    if (Math.abs(overall) < 0.005) return;

    const row = {
      label,
      type,
      adult: counts.adult ? categoryTotals.adult / counts.adult : 0,
      child: counts.child ? categoryTotals.child / counts.child : 0,
      infant: counts.infant ? categoryTotals.infant / counts.infant : 0,
      overall
    };
    collection.push(row);
    categoryFinalTotals.adult += categoryTotals.adult;
    categoryFinalTotals.child += categoryTotals.child;
    categoryFinalTotals.infant += categoryTotals.infant;
    if (collection === componentRows) {
      categoryBaseTotals.adult += categoryTotals.adult;
      categoryBaseTotals.child += categoryTotals.child;
      categoryBaseTotals.infant += categoryTotals.infant;
    }
  };

  const matchTotal = (totals, target) => {
    const current = weightedTotal({
      adult: counts.adult ? totals.adult / counts.adult : 0,
      child: counts.child ? totals.child / counts.child : 0,
      infant: counts.infant ? totals.infant / counts.infant : 0
    });
    if (target <= 0) return totals;
    if (current <= 0) return allocateShared(target);
    const factor = target / current;
    return {
      adult: totals.adult * factor,
      child: totals.child * factor,
      infant: totals.infant * factor
    };
  };

  const flightRates = (pkg.flights || []).reduce((result, flight) => {
    result.adult += amount(flight.fareAdult ?? flight.fare ?? flight.sellPrice);
    result.child += amount(flight.fareChild);
    result.infant += amount(flight.fareInfant);
    return result;
  }, { adult: 0, child: 0, infant: 0 });
  let flightTotals = {
    adult: flightRates.adult * counts.adult,
    child: flightRates.child * counts.child,
    infant: flightRates.infant * counts.infant
  };
  flightTotals = matchTotal(flightTotals, amount(pkg.flightCost));
  addRow(componentRows, 'Flight', flightTotals);

  const visaRates = (pkg.visas || []).reduce((result, visa) => {
    const adultFee = amount(visa.priceAdult || visa.price);
    result.adult += adultFee;
    result.child += amount(visa.priceChild || adultFee);
    result.infant += amount(visa.priceInfant);
    return result;
  }, { adult: 0, child: 0, infant: 0 });
  let visaTotals = {
    adult: visaRates.adult * counts.adult,
    child: visaRates.child * counts.child,
    infant: visaRates.infant * counts.infant
  };
  visaTotals = matchTotal(visaTotals, amount(pkg.visaCost));
  addRow(componentRows, 'Visa', visaTotals);

  addRow(componentRows, 'Hotel Accommodation', allocateShared(amount(pkg.hotelCost)));

  addRow(componentRows, 'Transport / Transfer', allocateShared(amount(pkg.transportCost)));

  addRow(componentRows, 'Ziyarah Transport', allocateShared(amount(pkg.ziyarahTransportCost)));
  addRow(componentRows, 'Other Services', allocateShared(amount(pkg.serviceCost)));

  const calculatedSubtotal = totalOf(categoryBaseTotals);
  const subtotal = amount(pkg.subTotal) || calculatedSubtotal;
  const otherCharges = subtotal - calculatedSubtotal;
  addRow(componentRows, 'Other Package Charges', allocateShared(otherCharges));

  const allocateAdjustment = total => allocateShared(total);

  const vat = amount(pkg.vatAmount);
  const serviceFee = amount(pkg.serviceFeeAmount);
  const markup = amount(pkg.markupAmount);
  const discount = Math.min(
    Math.max(0, amount(pkg.discountAmount)),
    Math.max(0, subtotal + vat + serviceFee + markup)
  );
  [
    { label: `VAT (${amount(pkg.vatPercent)}%)`, amount: vat, type: 'vat' },
    { label: 'Service Fee', amount: serviceFee, type: 'fee' },
    { label: 'Markup', amount: markup, type: 'markup' },
    { label: 'Discount', amount: -discount, type: 'discount' }
  ].forEach(item => {
    if (item.amount) addRow(adjustmentRows, item.label, allocateAdjustment(item.amount), item.type);
  });

  const calculatedGrandTotal = totalOf(categoryFinalTotals);
  const grandTotal = pkg.grandTotal == null ? calculatedGrandTotal : Math.max(0, amount(pkg.grandTotal));
  const roundingAdjustment = grandTotal - calculatedGrandTotal;
  if (Math.abs(roundingAdjustment) >= 0.005) {
    addRow(adjustmentRows, 'Rounding Adjustment', allocateAdjustment(roundingAdjustment), 'rounding');
  }

  const categoryTotals = {
    adult: categoryFinalTotals.adult,
    child: categoryFinalTotals.child,
    infant: categoryFinalTotals.infant
  };
  const countedCategories = ['adult', 'child', 'infant'].filter(category => counts[category] > 0);
  const displayedCategoryTotals = { ...categoryTotals };
  let roundingUnits = Math.round(grandTotal) - countedCategories.reduce(
    (sum, category) => sum + Math.floor(categoryTotals[category]),
    0
  );
  const roundingOrder = countedCategories.slice().sort(
    (left, right) =>
      (categoryTotals[right] - Math.floor(categoryTotals[right])) -
      (categoryTotals[left] - Math.floor(categoryTotals[left]))
  );
  countedCategories.forEach(category => {
    displayedCategoryTotals[category] = Math.floor(categoryTotals[category]);
  });
  for (let index = 0; roundingUnits > 0 && roundingOrder.length; index += 1, roundingUnits -= 1) {
    displayedCategoryTotals[roundingOrder[index % roundingOrder.length]] += 1;
  }
  for (let index = roundingOrder.length - 1; roundingUnits < 0 && roundingOrder.length; index -= 1, roundingUnits += 1) {
    const category = roundingOrder[(index + roundingOrder.length) % roundingOrder.length];
    if (displayedCategoryTotals[category] > 0) displayedCategoryTotals[category] -= 1;
  }
  const categoryRates = {
    adult: counts.adult ? displayedCategoryTotals.adult / counts.adult : 0,
    child: counts.child ? displayedCategoryTotals.child / counts.child : 0,
    infant: counts.infant ? displayedCategoryTotals.infant / counts.infant : 0
  };

  return {
    counts,
    componentRows,
    adjustmentRows,
    categoryBaseTotals,
    categoryTotals: displayedCategoryTotals,
    categoryRates,
    subtotal,
    grandTotal
  };
}

/* ==================== PRINT QUOTATION ==================== */
async function printQuotation(id) {
  const p = STORE.packages.find(x => x.id === id);
  if (!p) return;

  const s = await dbGetSetting('settings') || {};
  const company = s.company || '';
  const address = s.address || '';
  const phones = s.phone || '';
  const emails = s.email || '';
  const license = s.license || '';
  const headerImg = s.headerImgData || '';
  const footerImg = s.footerImgData || '';

  const paxAdult = p.paxAdult || 0;
  const paxChild = p.paxChild || 0;
  const paxInfant = p.paxInfant || 0;
  const makkahHotels = p.makkahHotels || [];
  const madinahHotels = p.madinahHotels || [];

  /* Preload hotel images as data URLs */
  const hotelImages = {};
  for (const h of [...makkahHotels, ...madinahHotels]) {
    if (h.imageIds && h.imageIds.length) {
      const dataUrl = await getImageDataURL(h.imageIds[0]);
      if (dataUrl) hotelImages[h.id || h.name] = dataUrl;
    }
  }

  let grandHotelTotal = 0;
  let hotelRowsHTML = '';

  const buildHotelRows = (hotels, city) => {
    return hotels.map(h => {
      const imgKey = h.id || h.name;
      const imgData = hotelImages[imgKey];
      const imgCell = imgData
        ? `<img src="${imgData}" style="width:80px;height:80px;border-radius:8px;object-fit:cover;display:block;border:1px solid #e5e7eb">`
        : '<div style="width:80px;height:80px;border-radius:8px;background:#fff7ed;display:flex;align-items:center;justify-content:center;font-size:30px;border:1px solid #e5e7eb">🕌</div>';

      const rooms = h.rooms || [];
      if (!rooms.length) {
        return `<tr><td style="padding:10px;border-bottom:1px solid #f4f4f5;vertical-align:middle">
          <div style="display:flex;align-items:center;gap:12px">${imgCell}
            <div>
              <strong style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.5px">${esc(city)}</strong>
              <div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${esc(h.name) || '—'}</div>
              ${h.distance ? `<div style="font-size:10px;color:#a1a1aa;margin-top:2px">📍 ${esc(h.distance)}</div>` : ''}
            </div>
          </div>
        </td><td colspan="4" style="padding:10px;text-align:center;color:#a1a1aa;font-size:10px">No rooms</td></tr>`;
      }

      return rooms.map((r, idx) => {
        const paxInRoom = (r.adults || 0) + (r.children || 0);
        const mealPerNight = (r.mealRate || 0) * paxInRoom;
        const totalRatePerNight = (r.rate || 0) + mealPerNight;
        const total = totalRatePerNight * (r.nights || 0);
        grandHotelTotal += total;

        const typeLabel = { quad: 'Quad (4)', triple: 'Triple (3)', double: 'Double (2)', single: 'Single (1)' }[r.type] || r.type;
        const guests = `${r.adults || 0}A${r.children ? '+' + r.children + 'C' : ''}`;
        const mealLabel = {
          room_only: ' (Room Only)',
          breakfast: ' (Room + Breakfast)',
          half_board: ' (Room + Half Board)',
          full_board: ' (Room + Full Board)'
        }[r.meal] || '';

        return `<tr>
          <td style="padding:10px;border-bottom:1px solid #f4f4f5;vertical-align:middle">
            ${idx === 0 ? `<div style="display:flex;align-items:center;gap:12px">${imgCell}
              <div>
                <strong style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.5px">${esc(city)}</strong>
                <div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${esc(h.name) || '—'}</div>
                ${h.distance ? `<div style="font-size:10px;color:#a1a1aa;margin-top:2px">📍 ${esc(h.distance)}</div>` : ''}
              </div>
            </div>` : ''}
          </td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f5;font-size:11px">Room ${idx + 1} · ${typeLabel} · ${guests}${mealLabel}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f5;font-size:11px">${r.nights || 0}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f5;font-size:11px">${fmt(totalRatePerNight)}</td>
          <td style="padding:8px;border-bottom:1px solid #f4f4f5;font-size:11px"><strong>${fmt(total)}</strong></td>
        </tr>`;
      }).join('');
    }).join('');
  };

  hotelRowsHTML += buildHotelRows(makkahHotels, 'Makkah');
  hotelRowsHTML += buildHotelRows(madinahHotels, 'Madinah');

  let passengersStr = `${paxAdult}A`;
  if (paxChild) passengersStr += ` + ${paxChild}C`;
  if (paxInfant) passengersStr += ` + ${paxInfant}I`;

  /* Itinerary */
  const _seenItin = new Set();
  const itineraryRows = (p.itinerary || []).filter(it => {
    const key = `${it.day}-${it.title || ''}-${it.description || ''}`;
    if (_seenItin.has(key)) return false;
    _seenItin.add(key);
    return true;
  }).slice(0, p.days || 999);

  const inclusions = dedupeTextItems(p.inclusions || []);
  const exclusions = dedupeTextItems(p.exclusions || []);
  const importantNotes = dedupeTextItems(p.importantNotes || []);
  const paymentTerms = dedupeTextItems(p.paymentTerms || []);
  const cancellationPolicyItems = dedupeTextItems(p.cancellationPolicyItems || []);

  const docTitle = `${p.name || 'Umrah Package'} — ${p.nights || 0}N/${p.days || 0}D`;

  /* Cost breakdown */
  const passengerBreakdown = calculateQuotationPassengerBreakdown(p);
  const formatBreakdownRate = value => Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  const formatBreakdownCurrencyRate = value => value < 0
    ? `- ৳ ${formatBreakdownRate(Math.abs(value))}`
    : `৳ ${formatBreakdownRate(value)}`;
  const formatBreakdownAmount = value => value < 0
    ? `- ${fmt(Math.abs(value))}`
    : fmt(value);
  const renderBreakdownRows = rows => rows.map(row => {
    const color = row.type === 'discount' ? '#dc2626' : row.type === 'markup' || row.type === 'vat' ? '#c2410c' : '#27272a';
    const cell = (value, count) => count ? formatBreakdownCurrencyRate(value) : '—';
    return `<tr>
      <td style="padding:7px 5px;color:#52525b;font-weight:600">${row.label}</td>
      <td style="padding:7px 5px;text-align:right;color:${color};font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">${cell(row.adult, passengerBreakdown.counts.adult)}</td>
      <td style="padding:7px 5px;text-align:right;color:${color};font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">${cell(row.child, passengerBreakdown.counts.child)}</td>
      <td style="padding:7px 5px;text-align:right;color:${color};font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">${cell(row.infant, passengerBreakdown.counts.infant)}</td>
      <td style="padding:7px 5px;text-align:right;color:${color};font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap">${formatBreakdownAmount(row.overall)}</td>
    </tr>`;
  }).join('');
  const breakdownPaxTypes = [
    { key: 'adult', label: 'Adult' },
    { key: 'child', label: 'Child' },
    { key: 'infant', label: 'Infant' }
  ];

  const costBreakdownHtml = passengerBreakdown.componentRows.length || passengerBreakdown.adjustmentRows.length ? `
    <div class="cost-breakdown-section pdf-breakable" style="margin-top:20px;padding:16px 18px;background:#fffaf5;border:2px solid #fed7aa;border-radius:12px">
      <div style="font-size:15px;font-weight:900;color:#18181b;margin-bottom:5px;text-align:center">📊 Cost Breakdown (Per Person)</div>
      <div style="font-size:10px;font-weight:600;color:#71717a;margin-bottom:12px;text-align:center">Per-person rate by passenger type and package total</div>
      <table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed">
        <colgroup><col style="width:27%"><col style="width:18%"><col style="width:18%"><col style="width:18%"><col style="width:19%"></colgroup>
        <thead>
          <tr style="background:#fff1e6;border-bottom:2px solid #fdba74">
            <th style="padding:8px 5px;text-align:left;color:#52525b;font-weight:800">Cost Head</th>
            ${breakdownPaxTypes.map(type => `<th style="padding:8px 5px;text-align:right;color:#52525b;font-weight:800">${type.label}<br><span style="font-size:9px;font-weight:600">(${passengerBreakdown.counts[type.key]}) · / person</span></th>`).join('')}
            <th style="padding:8px 5px;text-align:right;color:#52525b;font-weight:800">Overall</th>
          </tr>
        </thead>
        <tbody>
          ${renderBreakdownRows(passengerBreakdown.componentRows)}
          <tr style="border-top:1px dashed #fdba74;background:#fffdfb">
            <td style="padding:8px 5px;color:#27272a;font-weight:800">Subtotal</td>
            ${breakdownPaxTypes.map(type => {
              const count = passengerBreakdown.counts[type.key];
              const amount = passengerBreakdown.categoryBaseTotals[type.key];
              return `<td style="padding:8px 5px;text-align:right;color:#27272a;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap">${count ? `৳ ${formatBreakdownRate(amount / count)}` : '—'}</td>`;
            }).join('')}
            <td style="padding:8px 5px;text-align:right;color:#27272a;font-weight:900;white-space:nowrap">${fmt(passengerBreakdown.subtotal)}</td>
          </tr>
          ${renderBreakdownRows(passengerBreakdown.adjustmentRows)}
          <tr style="border-top:2px solid #f97316;background:#fff1e6">
            <td style="padding:10px 5px;color:#18181b;font-weight:900;font-size:11px">TOTAL / PERSON</td>
            ${breakdownPaxTypes.map(type => {
              const rate = passengerBreakdown.categoryRates[type.key];
              return `<td style="padding:10px 5px;text-align:right;color:#c2410c;font-weight:900;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap">${passengerBreakdown.counts[type.key] ? `৳ ${formatBreakdownRate(rate)}` : '—'}</td>`;
            }).join('')}
            <td style="padding:10px 5px;text-align:right;color:#c2410c;font-weight:900;font-size:12px;white-space:nowrap">${fmt(passengerBreakdown.grandTotal)}</td>
          </tr>
        </tbody>
      </table>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">
        ${breakdownPaxTypes.map(type => {
          const count = passengerBreakdown.counts[type.key];
          return `<div style="padding:9px 10px;background:#fff;border:1px solid #fed7aa;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:#71717a;font-weight:700">${type.label} Total (${count})</div>
            <div style="margin-top:3px;font-size:14px;color:#18181b;font-weight:900;font-variant-numeric:tabular-nums">${fmt(passengerBreakdown.categoryTotals[type.key])}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const includesExcludesHtml = (inclusions.length || exclusions.length) ? `
    <div class="pdf-breakable" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px">
      ${inclusions.length ? `<div style="padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px">
        <div style="font-size:12px;font-weight:900;color:#166534;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #16a34a;text-transform:uppercase;letter-spacing:1px">✓ Package Inclusions</div>
        <ul style="list-style:none;padding:0;margin:0">
          ${inclusions.map(x => `<li style="padding:3px 0 3px 16px;position:relative;font-size:11px;color:#166534;line-height:1.6"><span style="position:absolute;left:0;color:#16a34a;font-weight:800">✓</span>${esc(x.text)}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${exclusions.length ? `<div style="padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px">
        <div style="font-size:12px;font-weight:900;color:#991b1b;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #dc2626;text-transform:uppercase;letter-spacing:1px">✕ Package Exclusions</div>
        <ul style="list-style:none;padding:0;margin:0">
          ${exclusions.map(x => `<li style="padding:3px 0 3px 16px;position:relative;font-size:11px;color:#991b1b;line-height:1.6"><span style="position:absolute;left:0;color:#dc2626;font-weight:800">✕</span>${esc(x.text)}</li>`).join('')}
        </ul>
      </div>` : ''}
    </div>` : '';

  const importantNotesHtml = importantNotes.length ? `
    <div class="pdf-breakable" style="margin-top:18px;padding:14px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:10px">
      <div style="font-size:12px;font-weight:900;color:#1e40af;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">📝 Important Notes</div>
      <ul style="list-style:none;padding:0;margin:0">
        ${importantNotes.map(x => `<li style="padding:3px 0 3px 16px;position:relative;font-size:11px;color:#1e3a8a;line-height:1.7"><span style="position:absolute;left:0;color:#3b82f6;font-weight:800">✓</span>${esc(x.text)}</li>`).join('')}
      </ul>
    </div>` : '';

  const paymentTermsHtml = paymentTerms.length ? `
    <div class="pdf-breakable" style="margin-top:14px;padding:14px;background:#eff6ff;border:1px solid #93c5fd;border-radius:10px">
      <div style="font-size:12px;font-weight:900;color:#1e40af;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #3b82f6;text-transform:uppercase;letter-spacing:1px">💳 Payment Terms</div>
      <ul style="list-style:none;padding:0;margin:0">
        ${paymentTerms.map(x => `<li style="padding:3px 0 3px 16px;position:relative;font-size:11px;color:#1e3a8a;line-height:1.7"><span style="position:absolute;left:0;color:#3b82f6;font-weight:800">✓</span>${esc(x.text)}</li>`).join('')}
      </ul>
    </div>` : '';

  const cancellationPolicyHtml = cancellationPolicyItems.length ? `
    <div class="pdf-breakable" style="margin-top:14px;padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px">
      <div style="font-size:12px;font-weight:900;color:#991b1b;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #dc2626;text-transform:uppercase;letter-spacing:1px">❌ Cancellation Policy</div>
      <ul style="list-style:none;padding:0;margin:0">
        ${cancellationPolicyItems.map(x => `<li style="padding:3px 0 3px 16px;position:relative;font-size:11px;color:#991b1b;line-height:1.7"><span style="position:absolute;left:0;color:#dc2626;font-weight:800">✓</span>${esc(x.text)}</li>`).join('')}
      </ul>
    </div>` : '';

  const html = `<div class="modal-bg act" id="invoiceModal" style="background:#e8e8ec;backdrop-filter:none">
    <div class="modal" style="max-width:880px;border-radius:0">
      <div class="modal-head" style="background:#f5f5f7">
        <h2 style="color:#18181b">🖨️ Quotation Preview</h2>
        <button class="close-btn" onclick="this.closest('.modal-bg').remove()" style="background:#e8e8ec;color:#52525b">✕</button>
      </div>
      <div class="modal-body" style="padding:20px;background:#e8e8ec;max-height:80vh">
        <div id="umrahPrintArea" style="width:190mm;max-width:100%;min-height:277mm;margin:0 auto;background:#fff;padding:0;display:flex;flex-direction:column;font-family:'Inter','Hind Siliguri',sans-serif;color:#18181b;box-sizing:border-box">
          ${headerImg ? `<div data-pdf-header class="pdf-header" style="width:100%;text-align:center;padding:20px 30px 10px;page-break-after:avoid"><img src="${headerImg}" style="max-width:100%;max-height:140px;object-fit:contain"></div>` : ''}
          <div class="quotation-content" style="flex:1;padding:24px 40px 20px">
            <div style="text-align:center;margin-bottom:22px;padding-bottom:14px;border-bottom:3px solid #f97316">
              <div style="font-size:24px;font-weight:900;color:#18181b;letter-spacing:-.03em;margin-bottom:6px">${esc(docTitle)}</div>
              ${company ? `<div style="font-size:13px;color:#71717a;font-style:italic">${esc(company)}</div>` : ''}
              ${p.refNo ? `<div style="font-size:11px;color:#f97316;font-weight:800;margin-top:4px">Ref: ${esc(p.refNo)}</div>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
              <div style="padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #f97316"><div style="font-size:9.5px;color:#71717a;text-transform:uppercase;font-weight:800;letter-spacing:1px">Customer</div><div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${esc(p.customerName) || '—'}</div></div>
              <div style="padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #f97316"><div style="font-size:9.5px;color:#71717a;text-transform:uppercase;font-weight:800;letter-spacing:1px">Phone</div><div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${esc(p.customerPhone) || '—'}</div></div>
              <div style="padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #f97316"><div style="font-size:9.5px;color:#71717a;text-transform:uppercase;font-weight:800;letter-spacing:1px">Check In</div><div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${p.checkIn || p.start || '—'}</div></div>
              <div style="padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #f97316"><div style="font-size:9.5px;color:#71717a;text-transform:uppercase;font-weight:800;letter-spacing:1px">Check Out</div><div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${p.checkOut || p.end || '—'}</div></div>
              <div style="padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #f97316"><div style="font-size:9.5px;color:#71717a;text-transform:uppercase;font-weight:800;letter-spacing:1px">Duration</div><div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${p.nights || 0}N / ${p.days || 0}D</div></div>
              <div style="padding:10px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #f97316"><div style="font-size:9.5px;color:#71717a;text-transform:uppercase;font-weight:800;letter-spacing:1px">Passengers</div><div style="font-size:13px;font-weight:800;color:#18181b;margin-top:2px">${passengersStr}</div></div>
            </div>

            <div style="font-size:12px;font-weight:900;color:#18181b;margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid #f97316;text-transform:uppercase;letter-spacing:1px">🏨 Hotel Accommodation</div>
            <table class="hotel-table" style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;margin-bottom:16px;border:1px solid #e5e7eb">
              <colgroup><col style="width:26%"><col style="width:27%"><col style="width:7%"><col style="width:18%"><col style="width:22%"></colgroup>
              <thead>
                <tr style="background:#fef3c7">
                  <th style="padding:9px;text-align:left;color:#92400e;font-size:9.5px;text-transform:uppercase;font-weight:800">Hotel</th>
                  <th style="padding:9px;text-align:left;color:#92400e;font-size:9.5px;text-transform:uppercase;font-weight:800">Room / Sharing</th>
                  <th style="padding:9px;text-align:left;color:#92400e;font-size:9.5px;text-transform:uppercase;font-weight:800">Nights</th>
                  <th style="padding:9px;text-align:left;color:#92400e;font-size:9.5px;text-transform:uppercase;font-weight:800">Rate/Night</th>
                  <th style="padding:9px;text-align:left;color:#92400e;font-size:9.5px;text-transform:uppercase;font-weight:800">Total</th>
                </tr>
              </thead>
              <tbody>
                ${hotelRowsHTML || '<tr><td colspan="5" style="padding:14px;text-align:center;color:#999">No hotels</td></tr>'}
                ${hotelRowsHTML ? `<tr style="background:#fff7ed;height:42px"><td colspan="4" style="padding:11px;text-align:right;vertical-align:middle;line-height:1.2;font-weight:900;color:#92400e;text-transform:uppercase;font-size:10px;border-top:2px solid #f97316">Hotel Subtotal</td><td style="padding:11px;text-align:right;vertical-align:middle;line-height:1.2;white-space:nowrap;min-width:28mm;font-weight:900;color:#ea580c;font-size:13px;border-top:2px solid #f97316"><span style="display:inline-block;white-space:nowrap">${fmt(grandHotelTotal)}</span></td></tr>` : ''}
              </tbody>
            </table>

            ${itineraryRows.length ? `
              <div style="font-size:12px;font-weight:900;color:#18181b;margin:18px 0 12px;padding-bottom:6px;border-bottom:2px solid #f97316;text-transform:uppercase;letter-spacing:1px">📅 Day-wise Itinerary</div>
              ${itineraryRows.map((it, idx) => {
                const sections = parseContent(it.description);
                return `<div class="itinerary-day pdf-breakable" style="margin-bottom:14px">
                  <div style="display:flex;align-items:center;border:1px solid #e8e8ec;border-radius:6px;overflow:hidden;margin-bottom:10px">
                    <div style="background:#f97316;color:#fff;font-size:11px;font-weight:800;padding:8px 14px;white-space:nowrap;flex-shrink:0">Day ${it.day}</div>
                    <div style="flex:1;background:#f4f4f5;padding:8px 14px;font-size:11.5px;font-weight:800;color:#18181b;letter-spacing:-.1px">${esc(it.title) || ''}</div>
                  </div>
                  <div style="padding-left:2px">
                    ${sections.length ? sections.map(sec => {
                      const isDuration = sec.title.toLowerCase() === 'duration';
                      if (isDuration) {
                        return `<div style="margin-bottom:8px;font-size:11px;color:#333"><strong style="color:#18181b">${esc(sec.title)}:</strong> ${sec.items.map(x => esc(x)).join(', ')}</div>`;
                      }
                      return `<div style="margin-bottom:8px">
                        <div style="font-size:11.5px;font-weight:800;color:#18181b;margin-bottom:5px">${esc(sec.title)}</div>
                        <ul style="list-style:none;padding:0;margin:0">
                          ${sec.items.map(item => `<li style="padding:3px 0 3px 18px;position:relative;font-size:10.5px;color:#333;line-height:1.7"><span style="position:absolute;left:4px;top:3px;color:#18181b;font-weight:900;font-size:12px">•</span>${esc(item)}</li>`).join('')}
                        </ul>
                      </div>`;
                    }).join('') : `<div style="padding:6px 0;font-size:10.5px;color:#999;font-style:italic">No content</div>`}
                  </div>
                  ${idx < itineraryRows.length - 1 ? '<div style="height:1px;background:#f4f4f5;margin:12px 0 8px"></div>' : ''}
                </div>`;
              }).join('')}
            ` : ''}

            ${costBreakdownHtml}
            ${includesExcludesHtml}
            ${importantNotesHtml}

            ${(paymentTermsHtml || cancellationPolicyHtml) ? `<div style="font-size:12px;font-weight:900;color:#18181b;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #18181b;text-transform:uppercase;letter-spacing:1px">📋 Terms and Policies</div>` : ''}
            ${paymentTermsHtml}
            ${cancellationPolicyHtml}

            <div style="background:#fafafa;padding:16px;border-radius:12px;border:2px solid #fed7aa;margin-top:18px">
              ${p.advanceAmount ? `
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#71717a"><span>Grand Total</span><span style="font-weight:800;color:#18181b">${fmt(p.grandTotal)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#16a34a"><span>Advance Paid</span><span style="font-weight:800">- ${fmt(p.advanceAmount)}</span></div>
                <div style="height:1px;background:#e5e7eb;margin:8px 0"></div>
              ` : ''}
              <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:18px;font-weight:900;color:#18181b">
                <span>${p.advanceAmount ? 'DUE AMOUNT' : 'GRAND TOTAL'}</span>
                <span style="color:#ea580c">${fmt(p.dueAmount || p.grandTotal)}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:10px;border-top:2px solid #f97316">
                ${breakdownPaxTypes.map(type => `<div style="text-align:center">
                  <div style="font-size:10px;font-weight:700;color:#71717a">${type.label} / Person</div>
                  <div style="margin-top:3px;font-size:13px;font-weight:900;color:#16a34a;font-variant-numeric:tabular-nums">${passengerBreakdown.counts[type.key] ? `৳ ${formatBreakdownRate(passengerBreakdown.categoryRates[type.key])}` : '—'}</div>
                </div>`).join('')}
              </div>
              ${p.validUntil ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#71717a;text-align:center;font-weight:600">⏳ Valid until: <strong style="color:#18181b">${p.validUntil}</strong></div>` : ''}
            </div>

            ${(address || phones || emails || license) ? `
              <div style="margin-top:18px;padding:14px;background:#18181b;border-radius:10px;color:#fff;font-size:10.5px;line-height:1.7;text-align:center">
                ${address ? '📍 ' + esc(address) : ''}${phones ? ' · 📞 ' + esc(phones) : ''}${emails ? '<br>✉️ ' + esc(emails) : ''}${license ? '<br>📋 License: ' + esc(license) : ''}
              </div>
            ` : ''}
          </div>
          ${footerImg ? `<div data-pdf-footer class="pdf-footer" style="width:100%;text-align:center;padding:10px 30px 20px;margin-top:auto;page-break-inside:avoid"><img src="${footerImg}" style="max-width:100%;max-height:120px;object-fit:contain"></div>` : ''}
        </div>
      </div>
      <div class="modal-foot">
        <div></div>
        <div class="right-actions">
          <button class="btn btn-secondary" onclick="this.closest('.modal-bg').remove()">Close</button>
          <button class="btn btn-green" onclick="downloadPDF()">📥 Download PDF</button>
          <button class="btn btn-primary" onclick="window.print()">🖨️ Print</button>
        </div>
      </div>
    </div>
  </div>`;

  $('modalsContainer').insertAdjacentHTML('beforeend', html);
}

/* ==================== DOWNLOAD PDF ==================== */
async function downloadPDF() {
  const el = document.getElementById('umrahPrintArea');
  if (!el) {
    toast('Quotation not ready', 'error');
    return;
  }

  const p = STORE.packages.find(x => x.id === currentViewPackageId);
  const safe = value => String(value || '').trim().replace(/[\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 100);
  const fn = `${safe(p?.name || 'Umrah')}_${safe(p?.customerName || 'Customer')}.pdf`;

  toast('Generating PDF...', 'info');
  try {
    const footerImage = el.querySelector('.pdf-footer img');
    if (footerImage && !footerImage.complete) {
      await new Promise(resolve => {
        footerImage.addEventListener('load', resolve, { once: true });
        footerImage.addEventListener('error', resolve, { once: true });
      });
    }
    const worker = html2pdf().set({
      margin: [10, 10, 37, 10],
      filename: fn,
      image: { type: 'jpeg', quality: .95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        onclone: clonedDoc => {
          const cloneArea = clonedDoc.getElementById('umrahPrintArea');
          if (cloneArea) {
            cloneArea.style.width = '190mm';
            cloneArea.style.minHeight = '0';
          }
          clonedDoc.querySelectorAll('#umrahPrintArea .pdf-footer').forEach(footer => {
            footer.style.display = 'none';
          });
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.pdf-header', '.pdf-footer'] }
    }).from(el).toPdf();

    const pdf = await worker.get('pdf');
    if (footerImage?.complete && footerImage.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = footerImage.naturalWidth;
      canvas.height = footerImage.naturalHeight;
      canvas.getContext('2d').drawImage(footerImage, 0, 0);
      const footerData = canvas.toDataURL('image/png');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxWidth = pageWidth - 20;
      const maxHeight = 24;
      const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const width = canvas.width * scale;
      const height = canvas.height * scale;
      const x = (pageWidth - width) / 2;
      const y = pageHeight - height - 7;

      for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
        pdf.setPage(page);
        pdf.addImage(footerData, 'PNG', x, y, width, height);
      }
    }

    await worker.save();
    toast('PDF downloaded');
  } catch (e) {
    toast('PDF failed: ' + e.message, 'error');
  }
}