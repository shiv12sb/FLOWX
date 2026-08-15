(function () {
  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function formatPercent(value) {
    return `${Math.round(safeNumber(value, 0))}%`;
  }

  function renderKpis(summary) {
    const grid = document.getElementById('prediction-kpi-grid');
    if (!grid) return;

    const cards = [
      {
        label: 'High-Risk Roads',
        value: String(summary.highRiskRoads.length),
        modifier: 'warning',
        accent: 'orange'
      },
      {
        label: 'Capacity Breaches',
        value: String(summary.capacityBreaches),
        modifier: 'danger',
        accent: 'red'
      },
      {
        label: 'Predicted Utilization',
        value: formatPercent(summary.averagePredictedUtilization),
        modifier: 'primary',
        accent: 'cyan'
      },
      {
        label: 'Next Expected Congestion',
        value: `${summary.nextExpectedCongestion || 0} min`,
        modifier: 'neutral',
        accent: 'blue'
      }
    ];

    grid.innerHTML = cards.map((item) => `
      <div class="kpi-card kpi-card--${item.accent}">
        <div class="kpi-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 18h18"/><path d="M7 14l4-4 3 3 7-8"/>
          </svg>
        </div>
        <div class="kpi-card__label">${item.label}</div>
        <div class="kpi-card__value">${item.value}</div>
        <span class="kpi-card__demo">${item.modifier}</span>
      </div>
    `).join('');
  }

  function renderForecastChart(summary, horizon) {
    const chart = document.getElementById('forecast-chart');
    if (!chart) return;

    const activeRoad = summary.predictions[0];
    if (!activeRoad) {
      chart.innerHTML = '<p class="prediction-empty">Collecting traffic data…</p>';
      return;
    }

    const selectedForecast = activeRoad.forecasts.find((entry) => Number(entry.minutes) === Number(horizon)) || activeRoad.forecasts[0];
    const forecast = selectedForecast.forecast;
    const currentUtilization = activeRoad.currentUtilization;
    const currentSpeed = activeRoad.currentSpeed;

    const bars = [
      { title: 'Current', value: currentUtilization, unit: '%', fill: 100 },
      { title: '15 min', value: activeRoad.forecasts[0]?.forecast.predictedUtilization || currentUtilization, unit: '%', fill: 100 },
      { title: '30 min', value: activeRoad.forecasts[1]?.forecast.predictedUtilization || currentUtilization, unit: '%', fill: 100 },
      { title: '45 min', value: activeRoad.forecasts[2]?.forecast.predictedUtilization || currentUtilization, unit: '%', fill: 100 }
    ];

    chart.innerHTML = bars.map((bar) => `
      <div class="forecast-chart__bar">
        <div class="forecast-chart__title">${bar.title}</div>
        <div class="forecast-chart__value">${Math.round(bar.value)}${bar.unit}</div>
        <div class="forecast-chart__track">
          <div class="forecast-chart__fill" style="width:${Math.min(100, bar.value)}%"></div>
        </div>
      </div>
    `).join('');
  }

  function renderRoadCards(summary) {
    const container = document.getElementById('road-prediction-cards');
    if (!container) return;

    const roads = summary.highRiskRoads.length ? summary.highRiskRoads : summary.predictions.slice(0, 3);

    container.innerHTML = roads.map((road) => {
      const selected = road.forecasts[0];
      const risk = road.riskLevel || 'LOW';
      return `
        <article class="prediction-road-card">
          <div class="prediction-road-card__top">
            <div class="prediction-road-card__title">${road.roadName}</div>
            <span class="prediction-road-card__risk prediction-road-card__risk--${risk}">${risk}</span>
          </div>
          <div class="prediction-road-card__metrics">
            <div class="prediction-road-card__metric">
              <span class="prediction-road-card__metric-label">Current</span>
              <span class="prediction-road-card__metric-value">${Math.round(road.currentUtilization)}%</span>
            </div>
            <div class="prediction-road-card__metric">
              <span class="prediction-road-card__metric-label">Risk</span>
              <span class="prediction-road-card__metric-value">${road.riskScore}</span>
            </div>
            <div class="prediction-road-card__metric">
              <span class="prediction-road-card__metric-label">15 min</span>
              <span class="prediction-road-card__metric-value">${Math.round(road.forecasts[0].forecast.predictedUtilization)}%</span>
            </div>
            <div class="prediction-road-card__metric">
              <span class="prediction-road-card__metric-label">30 min</span>
              <span class="prediction-road-card__metric-value">${Math.round(road.forecasts[1].forecast.predictedUtilization)}%</span>
            </div>
          </div>
          <p>Capacity breach: ${road.breach.breachExpected ? `${road.breach.minutesToBreach} min` : 'No breach expected'}</p>
          <p>Model confidence: ${road.modelConfidence}%</p>
          <p>${road.explanation.reasons[0] || 'Traffic trend stable'}</p>
          <button class="btn btn--ghost" type="button">VIEW ROAD</button>
        </article>
      `;
    }).join('');
  }

  function renderReasons(summary) {
    const container = document.getElementById('prediction-reasons');
    if (!container) return;
    const road = summary.highRiskRoads[0] || summary.predictions[0];
    if (!road) {
      container.innerHTML = '<p>Collecting historical observations for the forecast model.</p>';
      return;
    }

    container.innerHTML = road.explanation.reasons.map((reason) => `
      <div class="reason-item">${reason}</div>
    `).join('');
  }

  function renderActions(summary) {
    const container = document.getElementById('recommended-actions');
    if (!container) return;
    const road = summary.highRiskRoads[0] || summary.predictions[0];
    if (!road) {
      container.innerHTML = '<p>Waiting for data collection to complete.</p>';
      return;
    }

    const action = {
      title: 'SMART TRAFFIC RECOMMENDATION',
      text: `Consider diverting traffic from ${road.roadName} toward Ring Road to reduce pressure and improve corridor flow.`
    };

    container.innerHTML = `
      <div class="recommendation-item">
        <strong>${action.title}</strong>
        <p>${action.text}</p>
      </div>
    `;
  }

  function renderScenario(summary) {
    const container = document.getElementById('scenario-summary');
    if (!container) return;
    const road = summary.highRiskRoads[0] || summary.predictions[0];
    if (!road) {
      container.innerHTML = '<p>Historical observations are still being gathered.</p>';
      return;
    }

    const diversion = 20;
    const current = road.currentUtilization;
    const improved = Math.max(0, current - (diversion * 0.7));
    container.innerHTML = `
      <p>Current: ${Math.round(current)}%</p>
      <p>After ${diversion}% diversion: ${Math.round(improved)}%</p>
      <p>Estimated congestion improvement: ${Math.round(current - improved)} percentage points</p>
    `;
  }

  function refreshAnalytics() {
    const engine = window.FlowXPredictionEngine;
    if (!engine || typeof engine.refreshPredictionState !== 'function') return;

    const summary = engine.refreshPredictionState();
    if (!summary) return;

    renderKpis(summary);
    renderForecastChart(summary, document.querySelector('.prediction-toggle.is-active')?.dataset.horizon || 15);
    renderRoadCards(summary);
    renderReasons(summary);
    renderActions(summary);
    renderScenario(summary);
  }

  function setupControls() {
    document.querySelectorAll('.prediction-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.prediction-toggle').forEach((item) => item.classList.toggle('is-active', item === button));
        refreshAnalytics();
      });
    });

    document.querySelectorAll('.scenario-btn').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.scenario-btn').forEach((item) => item.classList.toggle('is-selected', item === button));
        renderScenario(window.FlowXPredictionEngine.refreshPredictionState());
      });
    });

    document.getElementById('apply-scenario-btn')?.addEventListener('click', () => {
      const road = window.FlowXPredictionEngine.refreshPredictionState()?.highRiskRoads[0] || window.FlowXPredictionEngine.refreshPredictionState()?.predictions[0];
      if (road) {
        const target = document.querySelector('.scenario-btn.is-selected')?.dataset.diversion || 20;
        document.getElementById('scenario-summary').innerHTML = `<p>Scenario applied: ${target}% diversion</p><p>Projected congestion reduction on ${road.roadName}: ${Math.round(road.currentUtilization * 0.18)}%.</p>`;
      }
    });

    document.getElementById('reset-prediction-btn')?.addEventListener('click', () => {
      if (window.FlowXPredictionEngine && typeof window.FlowXPredictionEngine.resetPredictionState === 'function') {
        window.FlowXPredictionEngine.resetPredictionState();
        window.FlowXPredictionEngine.initializePredictionEngine();
        refreshAnalytics();
      }
    });
  }

  function initializePredictionPage() {
    const trafficEngine = window.FlowXTrafficEngine;
    if (trafficEngine && typeof trafficEngine.init === 'function') {
      const currentState = trafficEngine.getState ? trafficEngine.getState() : null;
      if (!currentState || !Array.isArray(currentState.roads) || !currentState.roads.length) {
        trafficEngine.init();
      }

      for (let index = 0; index < 12; index += 1) {
        if (typeof trafficEngine.tick === 'function') {
          trafficEngine.tick();
        }
      }
    }

    const engine = window.FlowXPredictionEngine;
    if (engine && typeof engine.initializePredictionEngine === 'function') {
      engine.initializePredictionEngine();
      engine.refreshPredictionState();
    }
    setupControls();
    refreshAnalytics();
    if (window.FlowXTrafficEngine && typeof window.FlowXTrafficEngine.subscribe === 'function') {
      window.FlowXTrafficEngine.subscribe(() => refreshAnalytics());
    }
  }

  if (typeof window !== 'undefined') {
    window.FlowXAnalyticsView = { initializePredictionPage, refreshAnalytics, renderKpis, renderForecastChart };
    document.addEventListener('DOMContentLoaded', initializePredictionPage);
  }
})();
