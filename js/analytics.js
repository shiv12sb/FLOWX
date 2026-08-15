(function () {
  const state = {
    history: [],
    range: 'session',
    maxHistory: 120
  };

  function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatCurrency(value) {
    return `₹${Math.round(safeNumber(value, 0))}`;
  }

  function formatPercent(value) {
    return `${Math.round(safeNumber(value, 0))}%`;
  }

  function getTrafficSnapshot() {
    const engine = window.FlowXTrafficEngine;
    if (engine && typeof engine.getState === 'function') {
      const snapshot = engine.getState();
      if (snapshot && Array.isArray(snapshot.roads)) {
        return snapshot;
      }
    }
    return { roads: [], totalVehicles: 0, averageNetworkSpeed: 0, networkUtilization: 0, congestedRoads: 0, clock: { timeText: '00:00' } };
  }

  function getSignalSnapshot() {
    const engine = window.FlowXSignalEngine;
    if (engine && typeof engine.getState === 'function') {
      return engine.getState();
    }
    return { intersections: [], summary: { averageWaitReduction: 0, signalEfficiency: 0 }, eventLog: [] };
  }

  function getWeatherSnapshot() {
    const engine = window.FlowXWeatherEngine;
    if (engine && typeof engine.getCurrentScenario === 'function') {
      return engine.getCurrentScenario();
    }
    return { impactScore: 0, label: 'Clear', alert: 'Low weather impact' };
  }

  function getAuthoritySnapshot() {
    const engine = window.FlowXAuthorityCoordination;
    if (engine && typeof engine.buildSnapshot === 'function') {
      return engine.buildSnapshot();
    }
    return { authorities: [], balance: { networkBalance: 0, displacementRisk: 0, warning: false }, optimization: { expectedGain: 0 } };
  }

  function getPredictionSnapshot() {
    const engine = window.FlowXPredictionEngine;
    if (engine && typeof engine.refreshPredictionState === 'function') {
      const summary = engine.refreshPredictionState();
      return summary || { highRiskRoads: [], capacityBreaches: 0, averagePredictedUtilization: 0, nextExpectedCongestion: 0 };
    }
    return { highRiskRoads: [], capacityBreaches: 0, averagePredictedUtilization: 0, nextExpectedCongestion: 0 };
  }

  function getEmergencySnapshot() {
    const engine = window.FlowXEmergency;
    if (engine && typeof engine.getActiveEmergencies === 'function') {
      return engine.getActiveEmergencies();
    }
    return [];
  }

  function buildInsightSummary(roads) {
    const hotspots = [...roads]
      .sort((a, b) => (safeNumber(b.utilization, 0) + safeNumber(b.delay, 0) * 2) - (safeNumber(a.utilization, 0) + safeNumber(a.delay, 0) * 2))
      .slice(0, 4)
      .map((road) => ({
        id: road.id,
        name: road.name,
        utilization: safeNumber(road.utilization, 0),
        speed: safeNumber(road.averageSpeed, 0),
        delay: safeNumber(road.delay, 0),
        status: road.status || 'GREEN'
      }));

    const rootCauses = [
      {
        title: 'Road pressure',
        detail: hotspots[0] ? `${hotspots[0].name} is carrying the steepest network load at ${formatPercent(hotspots[0].utilization)} utilization.` : 'No critical load spikes recorded.'
      },
      {
        title: 'Weather friction',
        detail: `Current weather is ${getWeatherSnapshot().label || 'Clear'} with an impact score of ${safeNumber(getWeatherSnapshot().impactScore, 0)}.`
      },
      {
        title: 'Signal inefficiency',
        detail: `Signal efficiency is ${formatPercent(getSignalSnapshot().summary?.signalEfficiency || 0)} with ${formatPercent(getSignalSnapshot().summary?.averageWaitReduction || 0)} average wait reduction.`
      }
    ];

    return { hotspots, rootCauses };
  }

  function buildAnalytics() {
    const traffic = getTrafficSnapshot();
    const signal = getSignalSnapshot();
    const weather = getWeatherSnapshot();
    const authority = getAuthoritySnapshot();
    const prediction = getPredictionSnapshot();
    const emergency = getEmergencySnapshot();
    const roads = traffic.roads || [];
    const averageSpeed = roads.length ? roads.reduce((sum, road) => sum + safeNumber(road.averageSpeed, 0), 0) / roads.length : 0;
    const averageDelay = roads.length ? roads.reduce((sum, road) => sum + safeNumber(road.delay, 0), 0) / roads.length : 0;
    const averageUtilization = roads.length ? roads.reduce((sum, road) => sum + safeNumber(road.utilization, 0), 0) / roads.length : 0;
    const congestedRoads = roads.filter((road) => (road.status || 'GREEN') !== 'GREEN').length;
    const networkHealth = clamp(100 - averageUtilization * 0.7 + (averageSpeed / 65) * 22, 0, 100);
    const balance = authority.balance || { networkBalance: 0, displacementRisk: 0, warning: false };
    const insights = buildInsightSummary(roads);

    const previous = (state.history && state.history[0]) || null;

    const analytics = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      totalVehicles: safeNumber(traffic.totalVehicles, 0),
      averageSpeed: Number(averageSpeed.toFixed(1)),
      averageDelay: Number(averageDelay.toFixed(1)),
      averageUtilization: Number(averageUtilization.toFixed(1)),
      congestedRoads,
      networkHealth: Number(networkHealth.toFixed(1)),
      weatherImpact: safeNumber(weather.impactScore, 0),
      emergencyCount: emergency.length,
      authorityBalance: safeNumber(balance.networkBalance, 0),
      authorityRisk: safeNumber(balance.displacementRisk, 0),
      signalEfficiency: safeNumber(signal.summary?.signalEfficiency, 0),
      signalWaitReduction: safeNumber(signal.summary?.averageWaitReduction, 0),
      predictionRisk: safeNumber(prediction.highRiskRoads?.length || 0, 0),
      nextExpectedCongestion: safeNumber(prediction.nextExpectedCongestion, 0),
      stats: {
        healthyRoads: roads.filter((road) => (road.status || 'GREEN') === 'GREEN').length,
        alertRoads: roads.filter((road) => (road.status || 'GREEN') !== 'GREEN').length,
        topHotspot: insights.hotspots[0] || null,
        weatherLabel: weather.label || 'Clear',
        weatherDetail: weather.alert || 'Low weather impact'
      },
      hotspots: insights.hotspots,
      causes: insights.rootCauses,
      roads,
      signal,
      authority,
      prediction,
      emergency
    };

    // attach previous snapshot metrics for trend calculation
    analytics.previous = previous;

    // push to bounded history (most recent first)
    state.history = [analytics, ...state.history].slice(0, Math.max(8, state.maxHistory));
    return analytics;
  }

  function renderKpis(analytics) {
    const grid = document.getElementById('analytics-kpi-grid');
    if (!grid) return;
    // Required KPI list for Phase 13, pulling from live analytics
    const kpis = [
      { key: 'totalVehicles', label: 'TOTAL VEHICLES', fmt: (v) => String(v), accent: 'cyan' },
      { key: 'roads', label: 'ACTIVE ROADS', fmt: (v) => String((v || []).length), accent: 'green' },
      { key: 'congestedRoads', label: 'CONGESTED ROADS', fmt: (v) => String(v), accent: 'orange' },
      { key: 'averageSpeed', label: 'AVERAGE SPEED', fmt: (v) => `${Number(v).toFixed(1)} km/h`, accent: 'blue' },
      { key: 'averageDelay', label: 'AVERAGE DELAY', fmt: (v) => `${Number(v).toFixed(1)} min`, accent: 'purple' },
      { key: 'averageUtilization', label: 'NETWORK UTILIZATION', fmt: (v) => `${Number(v).toFixed(1)}%`, accent: 'teal' },
      { key: 'authorityBalance', label: 'TRAFFIC BALANCE SCORE', fmt: (v) => `${Number(v).toFixed(0)}%`, accent: 'indigo' },
      { key: 'emergencyCount', label: 'ACTIVE EMERGENCIES', fmt: (v) => String(v), accent: 'red' }
    ];

    function computeChange(current, previous) {
      if (previous == null) return { pct: null, trend: '→' };
      if (previous === 0) return { pct: null, trend: '→' };
      const diff = current - previous;
      const pct = (diff / Math.abs(previous)) * 100;
      const trend = pct > 1 ? '↑' : pct < -1 ? '↓' : '→';
      return { pct: Number(pct.toFixed(1)), trend };
    }

    const prev = analytics.previous || null;

    grid.innerHTML = kpis.map((item) => {
      const current = item.key === 'roads' ? analytics.roads : analytics[item.key];
      const prevVal = prev ? (item.key === 'roads' ? prev.roads : prev[item.key]) : null;
      const display = item.fmt(current === undefined || current === null ? 0 : current);
      const currentNumeric = item.key === 'roads' ? (analytics.roads || []).length : Number(current || 0);
      const prevNumeric = prevVal ? (item.key === 'roads' ? (prevVal || []).length : Number(prevVal || 0)) : null;
      const change = computeChange(currentNumeric, prevNumeric);
      const changeLabel = change.pct === null ? 'N/A' : `${change.trend} ${Math.abs(change.pct).toFixed(1)}%`;

      return `
      <article class="kpi-card kpi-card--${item.accent}">
        <div class="kpi-card__icon" aria-hidden="true">◆</div>
        <p class="kpi-card__label">${item.label}</p>
        <p class="kpi-card__value">${display}</p>
        <div class="kpi-card__meta">
          <span class="kpi-card__trend">${changeLabel}</span>
          <span class="kpi-card__demo">SIM</span>
        </div>
      </article>
      `;
    }).join('');
  }

  function renderTrend(analytics) {
    const container = document.getElementById('analytics-trend-chart');
    if (!container) return;

    const history = state.history.length ? state.history : [analytics];
    const samples = history.slice(0, 6).reverse();
    const maxValue = Math.max(100, ...samples.map((sample) => Math.max(safeNumber(sample.averageUtilization, 0), safeNumber(sample.averageSpeed, 0))));

    container.innerHTML = samples.map((sample) => {
      const utilization = safeNumber(sample.averageUtilization, 0);
      const speed = safeNumber(sample.averageSpeed, 0);
      const height = clamp((utilization / maxValue) * 100, 18, 100);
      const speedHeight = clamp((speed / 65) * 100, 20, 100);
      return `
        <div class="analytics-trend__column" title="${sample.timestamp}">
          <div class="analytics-trend__stack">
            <span class="analytics-trend__utilization" style="height:${height}%"></span>
            <span class="analytics-trend__speed" style="height:${speedHeight}%"></span>
          </div>
          <small>${sample.timestamp.split(':').slice(0, 2).join(':')}</small>
        </div>
      `;
    }).join('');
  }

  function renderBottlenecks(analytics) {
    const container = document.getElementById('analytics-bottlenecks');
    if (!container) return;
    // Build top-10 bottlenecks by combined score (utilization + delay weighting + speed penalty)
    const roads = analytics.roads || [];
    const prev = analytics.previous || null;

    function roadTrend(roadId) {
      if (!prev || !prev.roads) return null;
      const prevRoad = (prev.roads || []).find((r) => r.id === roadId);
      if (!prevRoad) return null;
      const curr = roads.find((r) => r.id === roadId) || {};
      const diff = safeNumber(curr.utilization, 0) - safeNumber(prevRoad.utilization, 0);
      const pct = prevRoad.utilization ? (diff / Math.abs(prevRoad.utilization)) * 100 : null;
      return pct == null ? null : Number(pct.toFixed(1));
    }

    const scored = roads.map((road) => {
      const util = safeNumber(road.utilization, 0);
      const delay = safeNumber(road.delay, 0);
      const speed = safeNumber(road.averageSpeed, 0);
      const authorityName = road.authority || 'Unassigned';
      const score = util * 0.6 + delay * 2.2 + Math.max(0, (60 - speed)) * 0.8;
      return { id: road.id, name: road.name, utilization: util, delay, speed, authority: authorityName, score };
    }).sort((a, b) => b.score - a.score).slice(0, 10);

    container.innerHTML = scored.map((r, idx) => {
      const trend = roadTrend(r.id);
      const trendLabel = trend == null ? 'N/A' : (trend > 1 ? `↑ ${Math.abs(trend)}%` : trend < -1 ? `↓ ${Math.abs(trend)}%` : `→ ${Math.abs(trend)}%`);
      const status = r.utilization >= 90 ? 'CRITICAL' : r.utilization >= 75 ? 'SEVERE' : r.utilization >= 60 ? 'HIGH' : 'MODERATE';
      return `
      <div class="analytics-list-item">
        <div>
          <strong>${idx + 1}. ${r.name}</strong>
          <small>${r.authority} · ${status}</small>
        </div>
        <div class="analytics-list-item__metrics">
          <span>${formatPercent(r.utilization)}</span>
          <span>${r.speed.toFixed(1)} km/h</span>
          <span>${r.delay.toFixed(1)} min</span>
          <span>${trendLabel}</span>
        </div>
      </div>
      `;
    }).join('');
  }

  function renderCauses(analytics) {
    const container = document.getElementById('analytics-root-causes');
    if (!container) return;

    container.innerHTML = analytics.causes.map((cause) => `
      <div class="analytics-warning-item">
        <strong>${cause.title}</strong>
        <p>${cause.detail}</p>
      </div>
    `).join('');
  }

  function renderAuthorities(analytics) {
    const container = document.getElementById('analytics-authorities');
    if (!container) return;

    const items = analytics.authority.authorities || [];
    if (!items.length) {
      container.innerHTML = '<p class="analytics-empty">Authority snapshot pending.</p>';
      return;
    }

    container.innerHTML = items.slice(0, 4).map((authority) => `
      <div class="analytics-table-row">
        <span>${authority.name}</span>
        <span>${authority.utilization.toFixed(0)}%</span>
        <span>${authority.avgSpeed.toFixed(1)} km/h</span>
        <span>${authority.status}</span>
      </div>
    `).join('');
  }

  function renderSignalMetrics(analytics) {
    const container = document.getElementById('analytics-signal-metrics');
    if (!container) return;

    const summary = analytics.signal.summary || { signalEfficiency: 0, averageWaitReduction: 0 };
    const intersections = analytics.signal.intersections || [];
    const activeMode = intersections.some((entry) => entry.signalMode === 'SMART') ? 'SMART' : 'FIXED';

    container.innerHTML = `
      <div class="analytics-signal-metric">
        <span>System mode</span>
        <strong>${activeMode}</strong>
      </div>
      <div class="analytics-signal-metric">
        <span>Signal efficiency</span>
        <strong>${formatPercent(summary.signalEfficiency)}</strong>
      </div>
      <div class="analytics-signal-metric">
        <span>Wait reduction</span>
        <strong>${formatPercent(summary.averageWaitReduction)}</strong>
      </div>
      <div class="analytics-signal-metric">
        <span>Junctions</span>
        <strong>${intersections.length || 0}</strong>
      </div>
    `;
  }

  function renderActivityFeed(analytics) {
    const container = document.getElementById('analytics-activity-feed');
    if (!container) return;

    const signalLog = (analytics.signal.eventLog || []).slice(0, 3);
    const authorityLog = (analytics.authority?.state?.logs || []).slice(0, 3);
    const items = [...signalLog.map((entry) => ({ time: entry.time || analytics.timestamp, text: entry.message || 'Signal state update' })), ...authorityLog.map((entry) => ({ time: entry.time || analytics.timestamp, text: `${entry.title}: ${entry.detail}` }))].slice(0, 6);

    container.innerHTML = items.map((entry) => `
      <div class="analytics-activity-item">
        <span>${entry.time}</span>
        <p>${entry.text}</p>
      </div>
    `).join('');
  }

  function renderDecisionSupport(analytics) {
    const container = document.getElementById('analytics-decision-support');
    if (!container) return;

    const topAction = analytics.hotspots[0];
    const weatherText = analytics.stats.weatherDetail;

    container.innerHTML = `
      <ul>
        <li>Prioritize ${topAction ? topAction.name : 'the most congested corridor'} for diversion or queue relief.</li>
        <li>Keep current signal mode in ${analytics.signal.summary?.signalEfficiency > 55 ? 'SMART' : 'FIXED'} alignment to preserve green-time efficiency.</li>
        <li>Monitor ${analytics.stats.weatherLabel} conditions because the simulated weather profile is elevating route friction and delay.</li>
        <li>Use the live authority recommendation to redistribute load before displacement risk crosses ${analytics.authorityRisk.toFixed(0)}%.</li>
      </ul>
    `;
  }

  function renderTimestamp(analytics) {
    const el = document.getElementById('analytics-live-ts');
    if (el) el.textContent = `Updated ${analytics.timestamp}`;
  }

  function renderExportButton() {
    const button = document.getElementById('analytics-export-btn');
    if (!button) return;
    const optimizeBtn = document.getElementById('analytics-optimize-signals');
    const weatherBtn = document.getElementById('analytics-apply-weather');
    const whatifBtn = document.getElementById('analytics-run-whatif');

    button.addEventListener('click', () => {
      const analytics = buildAnalytics();
      const rows = [
        ['road', 'status', 'utilization', 'speed', 'delay', 'weatherImpact'],
        ...analytics.roads.map((road) => [
          road.name,
          road.status || 'GREEN',
          safeNumber(road.utilization, 0).toFixed(1),
          safeNumber(road.averageSpeed, 0).toFixed(1),
          safeNumber(road.delay, 0).toFixed(1),
          safeNumber(road.weatherImpactScore, 0).toFixed(0)
        ])
      ];

      const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'flowx-traffic-analytics.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });

    if (optimizeBtn && window.FlowXSignalEngine && typeof window.FlowXSignalEngine.applySmartSignal === 'function') {
      optimizeBtn.addEventListener('click', () => {
        window.FlowXSignalEngine.applySmartSignal();
        refresh();
      });
    }

    if (weatherBtn && window.FlowXWeatherEngine && typeof window.FlowXWeatherEngine.applyToSimulation === 'function') {
      weatherBtn.addEventListener('click', () => {
        window.FlowXWeatherEngine.applyToSimulation('heavy-rain');
        refresh();
      });
    }

    if (whatifBtn) {
      whatifBtn.addEventListener('click', () => {
        // Run a bounded what-if: apply smart signals, tick simulation 3 times, then revert
        const originalMode = window.FlowXSignalEngine && window.FlowXSignalEngine.mode;
        if (window.FlowXSignalEngine && typeof window.FlowXSignalEngine.applySmartSignal === 'function') {
          window.FlowXSignalEngine.applySmartSignal();
        }
        const ticks = 3;
        let run = 0;
        const runner = setInterval(() => {
          if (window.FlowXTrafficEngine && typeof window.FlowXTrafficEngine.step === 'function') {
            window.FlowXTrafficEngine.step();
          }
          run += 1;
          if (run >= ticks) {
            clearInterval(runner);
            if (window.FlowXSignalEngine && typeof window.FlowXSignalEngine.setMode === 'function' && originalMode) {
              window.FlowXSignalEngine.setMode(originalMode);
            }
            refresh();
          }
        }, 300);
      });
    }
  }

  function refresh() {
    const analytics = buildAnalytics();
    renderKpis(analytics);
    renderTrend(analytics);
    renderBottlenecks(analytics);
    renderCauses(analytics);
    renderAuthorities(analytics);
    renderSignalMetrics(analytics);
    renderActivityFeed(analytics);
    renderDecisionSupport(analytics);
    renderTimestamp(analytics);
  }

  function init() {
    if (typeof document === 'undefined') return;
    renderExportButton();
    refresh();

    if (window.FlowXTrafficEngine && typeof window.FlowXTrafficEngine.subscribe === 'function') {
      window.FlowXTrafficEngine.subscribe(() => refresh());
    }
  }

  if (typeof window !== 'undefined') {
    window.FlowXAnalytics = { init, refresh, buildAnalytics, state };
    document.addEventListener('DOMContentLoaded', init);
  }
})();
