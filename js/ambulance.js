(function () {
  const zones = [
    'Central Square',
    'Wardha Road',
    'Ring Road',
    'Airport Corridor',
    'Sadar Nagpur',
    'Cotton Market',
    'Civil Hospital',
    'City Hospital'
  ];

  const hospitals = [
    'City Hospital',
    'Civil Hospital',
    'Emergency Center',
    'Fire Station',
    'Police HQ'
  ];

  const ambulanceFleet = [
    { id: 'AMB-204', type: 'Basic Life Support', eta: 6.2, distance: 3.6, price: 420, rating: 4.8, availability: 'Ready', zone: 'Central Square', baseCost: 350, speed: 58, peak: 'Fast', accent: 'good' },
    { id: 'AMB-118', type: 'Advanced Life Support', eta: 8.6, distance: 4.8, price: 520, rating: 4.9, availability: 'Busy', zone: 'Wardha Road', baseCost: 440, speed: 52, peak: 'Priority', accent: 'warn' },
    { id: 'AMB-331', type: 'Critical Care', eta: 5.1, distance: 2.9, price: 610, rating: 5.0, availability: 'Ready', zone: 'Airport Corridor', baseCost: 500, speed: 63, peak: 'Critical', accent: 'critical' },
    { id: 'AMB-442', type: 'BLS Plus', eta: 9.4, distance: 5.4, price: 390, rating: 4.6, availability: 'Ready', zone: 'Cotton Market', baseCost: 340, speed: 49, peak: 'Value', accent: 'good' },
    { id: 'AMB-509', type: 'Emergency Response', eta: 7.8, distance: 4.2, price: 470, rating: 4.7, availability: 'Ready', zone: 'Sadar Nagpur', baseCost: 390, speed: 54, peak: 'Fast', accent: 'good' },
    { id: 'AMB-612', type: 'Critical Care', eta: 10.2, distance: 6.1, price: 660, rating: 4.9, availability: 'Busy', zone: 'Ring Road', baseCost: 580, speed: 51, peak: 'Priority', accent: 'warn' }
  ];

  const state = {
    selectedId: null,
    sortMode: 'recommended',
    urgency: 'Critical',
    patientZone: 'Central Square',
    hospital: 'City Hospital'
  };

  function formatMoney(value) {
    return `₹${Math.round(value)}`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function buildRecommendationScore(unit, config = {}) {
    const urgencyWeight = config.urgency === 'Critical' ? 1.35 : config.urgency === 'Priority' ? 1.15 : 1;
    const weatherPenalty = config.weatherImpact || 1;
    const trafficPenalty = config.trafficImpact || 1;
    const distanceFactor = unit.distance * 1.8;
    const etaFactor = unit.eta * 1.6;
    const costFactor = unit.price / 120;
    const availabilityFactor = unit.availability === 'Ready' ? 0.75 : 1.2;

    const score = (100 - (distanceFactor + etaFactor + costFactor + availabilityFactor) * urgencyWeight * weatherPenalty * trafficPenalty);
    return clamp(score, 20, 98);
  }

  function calculateRecommendations() {
    const weatherImpact = window.FlowXWeatherEngine && typeof window.FlowXWeatherEngine.getCurrentScenario === 'function'
      ? window.FlowXWeatherEngine.getCurrentScenario().impactScore / 100 || 0.25
      : 0.25;

    const trafficImpact = 0.92 + (Math.random() * 0.28);
    const urgency = state.urgency;

    const items = ambulanceFleet.map((unit) => {
      const distanceBias = Math.abs(unit.distance - 4.5) * 0.85;
      const etaAdjustment = unit.eta + (weatherImpact * 3.6) + (urgency === 'Critical' ? 1.1 : urgency === 'Priority' ? 0.45 : 0.15);
      const routeDelay = (unit.speed / 58) * (trafficImpact * 1.25);
      const priceAdjustment = unit.baseCost + (urgency === 'Critical' ? 85 : urgency === 'Priority' ? 40 : 0) + Math.round(weatherImpact * 55);
      const score = buildRecommendationScore({ ...unit, eta: etaAdjustment, price: priceAdjustment, distance: unit.distance + distanceBias }, { urgency, weatherImpact, trafficImpact });

      return {
        ...unit,
        calculatedEta: Number((etaAdjustment / routeDelay).toFixed(1)),
        distance: Number((unit.distance + distanceBias).toFixed(1)),
        price: priceAdjustment,
        score: Number(score.toFixed(1)),
        availability: unit.availability,
        urgency
      };
    }).sort((a, b) => b.score - a.score);

    const sortMode = state.sortMode;
    const sorted = [...items].sort((a, b) => {
      if (sortMode === 'fastest') return a.calculatedEta - b.calculatedEta;
      if (sortMode === 'nearest') return a.distance - b.distance;
      if (sortMode === 'cheapest') return a.price - b.price;
      return b.score - a.score;
    });

    const selected = sorted[0];
    state.selectedId = selected?.id || null;
    return sorted;
  }

  function renderResults(items) {
    const resultsEl = document.getElementById('ambulance-results');
    if (!resultsEl) return;

    if (!items.length) {
      resultsEl.innerHTML = '<div class="route-empty">No simulated ambulances available.</div>';
      return;
    }

    const recommended = items.map((unit) => {
      const selectedClass = state.selectedId === unit.id ? 'is-selected' : '';
      const icon = unit.type.includes('Critical') ? '🚑' : '🚑';
      const badge = unit.availability === 'Ready' ? 'ambulance-pill ambulance-pill--good' : 'ambulance-pill ambulance-pill--warn';
      return `
        <div class="ambulance-result-card ${selectedClass}" data-ambulance-id="${unit.id}" tabindex="0" role="button" aria-label="Select ambulance ${unit.id}">
          <div class="ambulance-result-card__icon" aria-hidden="true">${icon}</div>
          <div>
            <strong>${unit.id}</strong>
            <div>${unit.type}</div>
            <div class="ambulance-result-card__meta">
              <span>${unit.peak}</span>
              <span>${unit.availability}</span>
              <span>${unit.rating.toFixed(1)}★</span>
            </div>
          </div>
          <div>
            <div class="ambulance-result-card__score">${unit.score.toFixed(1)}</div>
            <div>${unit.calculatedEta.toFixed(1)} min</div>
            <div>${unit.distance.toFixed(1)} km</div>
          </div>
        </div>
      `;
    }).join('');

    resultsEl.innerHTML = recommended;

    resultsEl.querySelectorAll('[data-ambulance-id]').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedId = card.dataset.ambulanceId;
        render();
      });
    });
  }

  function renderDetail(items) {
    const detailEl = document.getElementById('ambulance-detail');
    if (!detailEl) return;

    const selected = items.find((item) => item.id === state.selectedId) || items[0];
    if (!selected) {
      detailEl.innerHTML = '<div class="route-empty">Select a simulated ambulance unit.</div>';
      return;
    }

    detailEl.innerHTML = `
      <div class="ambulance-detail-card__header">
        <div>
          <strong>${selected.id}</strong>
          <div>${selected.type}</div>
        </div>
        <span class="${selected.availability === 'Ready' ? 'ambulance-pill ambulance-pill--good' : 'ambulance-pill ambulance-pill--warn'}">${selected.availability}</span>
      </div>
      <div class="ambulance-detail-card__body">
        <div><span>ETA</span><strong>${selected.calculatedEta.toFixed(1)} min</strong></div>
        <div><span>Distance</span><strong>${selected.distance.toFixed(1)} km</strong></div>
        <div><span>Estimated cost</span><strong>${formatMoney(selected.price)}</strong></div>
        <div><span>Hospital</span><strong>${state.hospital}</strong></div>
        <div><span>Patient zone</span><strong>${state.patientZone}</strong></div>
        <div><span>Urgency</span><strong>${state.urgency}</strong></div>
        <div><span>Route quality</span><strong>${selected.score >= 75 ? 'High' : selected.score >= 60 ? 'Moderate' : 'Watch list'}</strong></div>
        <div><span>Rating</span><strong>${selected.rating.toFixed(1)} / 5</strong></div>
      </div>
    `;
  }

  function renderTable(items) {
    const tableEl = document.getElementById('ambulance-table');
    if (!tableEl) return;

    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Type</th>
            <th>ETA</th>
            <th>Distance</th>
            <th>Price</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((unit) => `
            <tr>
              <td>${unit.id}</td>
              <td>${unit.type}</td>
              <td>${unit.calculatedEta.toFixed(1)} min</td>
              <td>${unit.distance.toFixed(1)} km</td>
              <td>${formatMoney(unit.price)}</td>
              <td>${unit.score.toFixed(1)}</td>
              <td><span class="${unit.availability === 'Ready' ? 'ambulance-pill ambulance-pill--good' : 'ambulance-pill ambulance-pill--warn'}">${unit.availability}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderSummary(items) {
    if (!items.length) return;
    const fastest = Math.min(...items.map((item) => item.calculatedEta));
    const nearest = Math.min(...items.map((item) => item.distance));
    const best = items.slice().sort((a, b) => a.price - b.price)[0];
    const available = items.filter((item) => item.availability === 'Ready').length;

    const fastestEl = document.getElementById('ambulance-fastest-eta');
    const nearestEl = document.getElementById('ambulance-nearest-dist');
    const costEl = document.getElementById('ambulance-best-cost');
    const countEl = document.getElementById('ambulance-available-count');

    if (fastestEl) fastestEl.textContent = `${fastest.toFixed(1)} min`;
    if (nearestEl) nearestEl.textContent = `${nearest.toFixed(1)} km`;
    if (costEl) costEl.textContent = formatMoney(best.price);
    if (countEl) countEl.textContent = String(available);
  }

  function render() {
    const items = calculateRecommendations();
    renderResults(items);
    renderDetail(items);
    renderTable(items);
    renderSummary(items);
  }

  function populateOptions() {
    const patientZoneEl = document.getElementById('ambulance-patient-zone');
    const hospitalEl = document.getElementById('ambulance-hospital');

    if (patientZoneEl) {
      patientZoneEl.innerHTML = zones.map((zone) => `<option value="${zone}">${zone}</option>`).join('');
      patientZoneEl.value = state.patientZone;
    }

    if (hospitalEl) {
      hospitalEl.innerHTML = hospitals.map((hospital) => `<option value="${hospital}">${hospital}</option>`).join('');
      hospitalEl.value = state.hospital;
    }
  }

  function bindControls() {
    const form = document.getElementById('ambulance-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const patientZone = document.getElementById('ambulance-patient-zone')?.value || state.patientZone;
        const hospital = document.getElementById('ambulance-hospital')?.value || state.hospital;
        const urgency = document.getElementById('ambulance-urgency')?.value || state.urgency;
        const sortMode = document.getElementById('ambulance-sort')?.value || state.sortMode;

        state.patientZone = patientZone;
        state.hospital = hospital;
        state.urgency = urgency;
        state.sortMode = sortMode;
        render();
      });
    }
  }

  function init() {
    if (typeof document === 'undefined') return;
    populateOptions();
    bindControls();
    render();
  }

  if (typeof window !== 'undefined') {
    window.FlowXAmbulance = {
      init,
      state,
      calculateRecommendations,
      getFleet: () => ambulanceFleet.slice()
    };
    document.addEventListener('DOMContentLoaded', init);
  }
})();
