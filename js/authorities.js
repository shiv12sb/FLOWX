(function () {
  const fallbackRoads = [
    { id: 'ring-road', name: 'Ring Road', roadType: 'highway', length: 4.5, lanes: 4, capacityPerMinute: 240, currentVehicles: 640, averageSpeed: 39, utilization: 68, delay: 7, incident: null, upstreamRoads: ['airport-corridor'], downstreamRoads: ['sadar-nagpur'], authority: 'Nagpur West' },
    { id: 'wardha-road', name: 'Wardha Road', roadType: 'arterial', length: 3.7, lanes: 4, capacityPerMinute: 220, currentVehicles: 760, averageSpeed: 22, utilization: 82, delay: 14, incident: 'accident', upstreamRoads: ['ring-road'], downstreamRoads: ['sadar-nagpur'], authority: 'Nagpur Central' },
    { id: 'central-avenue', name: 'Central Avenue', roadType: 'arterial', length: 3.4, lanes: 3, capacityPerMinute: 190, currentVehicles: 420, averageSpeed: 38, utilization: 46, delay: 4, incident: null, upstreamRoads: ['ring-road'], downstreamRoads: ['sadar-nagpur'], authority: 'Nagpur Central' },
    { id: 'sadar-nagpur', name: 'Sadar Nagpur', roadType: 'arterial', length: 4.2, lanes: 4, capacityPerMinute: 230, currentVehicles: 520, averageSpeed: 29, utilization: 58, delay: 5, incident: null, upstreamRoads: ['ring-road', 'wardha-road', 'central-avenue'], downstreamRoads: ['cotton-market'], authority: 'Nagpur Urban' },
    { id: 'cotton-market', name: 'Cotton Market', roadType: 'local', length: 2.8, lanes: 2, capacityPerMinute: 150, currentVehicles: 610, averageSpeed: 15, utilization: 91, delay: 11, incident: 'laneClosure', upstreamRoads: ['sadar-nagpur'], downstreamRoads: [], authority: 'Nagpur Market' },
    { id: 'airport-corridor', name: 'Airport Corridor', roadType: 'highway', length: 5.2, lanes: 4, capacityPerMinute: 260, currentVehicles: 360, averageSpeed: 50, utilization: 39, delay: 2, incident: null, upstreamRoads: [], downstreamRoads: ['ring-road'], authority: 'Nagpur Airport' }
  ];

  const state = {
    lastAction: '',
    logs: [],
    snapshot: null
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function slugify(value) {
    return String(value || 'authority')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'authority';
  }

  function getRoadSnapshot() {
    const engine = window.FlowXTrafficEngine;
    if (engine && engine.getState) {
      const snapshot = engine.getState();
      if (snapshot && Array.isArray(snapshot.roads) && snapshot.roads.length) {
        return snapshot.roads;
      }
    }
    return fallbackRoads;
  }

  function buildAuthorityData() {
    const roads = getRoadSnapshot();
    const grouped = new Map();

    roads.forEach((road) => {
      const authorityName = road.authority || 'Unassigned Authority';
      const entry = grouped.get(authorityName) || {
        id: slugify(authorityName),
        name: authorityName,
        code: authorityName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AU',
        color: ['#00c8ff', '#7c3aed', '#f97316', '#22c55e', '#f43f5e', '#facc15'][grouped.size % 6],
        managedRoads: [],
        totalVehicles: 0,
        avgUtilization: 0,
        avgSpeed: 0,
        queuePressure: 0,
        incidentCount: 0,
        crossBoundary: 0,
        inbound: 0,
        outbound: 0
      };

      entry.managedRoads.push(road.id);
      entry.totalVehicles += safeNumber(road.currentVehicles, 0);
      entry.avgUtilization += safeNumber(road.utilization, 0);
      entry.avgSpeed += safeNumber(road.averageSpeed, 0);
      entry.queuePressure += safeNumber(road.delay, 0) * 3;
      if (road.incident) entry.incidentCount += 1;

      const upstreamAuthorities = (road.upstreamRoads || []).map((id) => {
        const upstream = roads.find((item) => item.id === id);
        return upstream ? upstream.authority : null;
      }).filter(Boolean);
      const downstreamAuthorities = (road.downstreamRoads || []).map((id) => {
        const downstream = roads.find((item) => item.id === id);
        return downstream ? downstream.authority : null;
      }).filter(Boolean);

      const cross = new Set([...upstreamAuthorities, ...downstreamAuthorities].filter((item) => item && item !== authorityName));
      entry.crossBoundary += cross.size;
      entry.inbound += upstreamAuthorities.filter((item) => item && item !== authorityName).length;
      entry.outbound += downstreamAuthorities.filter((item) => item && item !== authorityName).length;

      grouped.set(authorityName, entry);
    });

    const authorities = [...grouped.values()].map((authority) => {
      const roadCount = Math.max(1, authority.managedRoads.length);
      const utilization = authority.avgUtilization / roadCount;
      const avgSpeed = authority.avgSpeed / roadCount;
      const load = authority.totalVehicles / Math.max(1, roadCount * 180);
      const imbalance = clamp((utilization - 60) * 0.9 + (authority.crossBoundary * 4), 0, 80);

      return {
        ...authority,
        roadCount,
        utilization: Number(utilization.toFixed(1)),
        avgSpeed: Number(avgSpeed.toFixed(1)),
        load: Number(load.toFixed(2)),
        queuePressure: Number(authority.queuePressure.toFixed(1)),
        imbalance: Number(imbalance.toFixed(1)),
        status: utilization >= 85 ? 'Overloaded' : utilization >= 70 ? 'Stressed' : utilization >= 55 ? 'Balanced' : 'Underloaded',
        priority: utilization >= 85 ? 'High' : utilization >= 70 ? 'Medium' : 'Low'
      };
    });

    return authorities;
  }

  function computeBalance(authorities) {
    const averageUtilization = authorities.reduce((sum, authority) => sum + authority.utilization, 0) / Math.max(1, authorities.length);
    const high = Math.max(...authorities.map((authority) => authority.utilization));
    const low = Math.min(...authorities.map((authority) => authority.utilization));
    const spread = high - low;
    const imbalanceScore = clamp(((spread / Math.max(1, averageUtilization)) * 36) + (high > 90 ? 16 : 0), 0, 100);
    const networkBalance = clamp(100 - imbalanceScore, 0, 100);
    const displacementRisk = clamp((spread > 18 ? 70 : spread > 12 ? 46 : 22) + (authorities.filter((authority) => authority.utilization > 80).length * 6) - (authorities.filter((authority) => authority.utilization < 60).length * 4), 0, 100);

    return {
      averageUtilization: Number(averageUtilization.toFixed(1)),
      spread: Number(spread.toFixed(1)),
      imbalanceScore: Number(imbalanceScore.toFixed(1)),
      networkBalance: Number(networkBalance.toFixed(1)),
      displacementRisk: Number(displacementRisk.toFixed(1)),
      warning: displacementRisk >= 55 || spread >= 18,
      overloadedAuthority: [...authorities].sort((a, b) => b.utilization - a.utilization)[0],
      underloadedAuthority: [...authorities].sort((a, b) => a.utilization - b.utilization)[0]
    };
  }

  function createOptimizationPlan(authorities) {
    const snapshot = authorities.map((authority) => {
      const userTarget = authority.utilization >= 80 ? authority.utilization - 12 : authority.utilization + 8;
      const adjustedUtilization = clamp(userTarget, 35, 95);
      const expectedRelief = authority.utilization - adjustedUtilization;

      return {
        ...authority,
        optimizedUtilization: Number(adjustedUtilization.toFixed(1)),
        expectedRelief: Number(Math.abs(expectedRelief).toFixed(1)),
        recommendation: authority.utilization >= 80
          ? 'Shift inbound traffic to underloaded neighboring authority corridors'
          : 'Increase signal coordination and route balancing along inter-authority links'
      };
    });

    const before = authorities.reduce((sum, authority) => sum + authority.utilization, 0) / Math.max(1, authorities.length);
    const after = snapshot.reduce((sum, authority) => sum + authority.optimizedUtilization, 0) / Math.max(1, snapshot.length);
    const gain = clamp(before - after, 0, 25);

    return {
      plan: snapshot,
      expectedGain: Number(gain.toFixed(1)),
      beforeAverage: Number(before.toFixed(1)),
      afterAverage: Number(after.toFixed(1)),
      recommendationSummary: 'Coordinated diversion reduces queue pressure across overloaded authorities while preserving corridor flow for low-load zones.'
    };
  }

  function renderSummary(snapshot) {
    const metrics = {
      balanceScore: document.getElementById('authority-balance-score'),
      displacementRisk: document.getElementById('authority-displacement-risk'),
      alertCount: document.getElementById('authority-alert-count'),
      optimizationGain: document.getElementById('authority-optimization-gain')
    };

    if (metrics.balanceScore) metrics.balanceScore.textContent = `${snapshot.networkBalance.toFixed(0)}%`;
    if (metrics.displacementRisk) metrics.displacementRisk.textContent = `${snapshot.displacementRisk.toFixed(0)}%`;
    if (metrics.alertCount) metrics.alertCount.textContent = String(snapshot.warning ? '2' : '0');
    if (metrics.optimizationGain) metrics.optimizationGain.textContent = `${snapshot.optimization.expectedGain.toFixed(1)} pts`;
  }

  function renderBanner(balance, optimization) {
    const banner = document.getElementById('authority-displacement-banner');
    if (!banner) return;

    const detected = balance.warning || balance.displacementRisk >= 50;
    banner.classList.toggle('is-warning', detected);
    banner.classList.toggle('is-safe', !detected);
    banner.innerHTML = detected
      ? `
        <div class="alert-banner__content">
          <span class="alert-banner__icon">⚠</span>
          <div>
            <strong>TRAFFIC DISPLACEMENT DETECTED</strong>
            <p>Overloaded authority corridors are pushing vehicles toward adjacent jurisdictions. Coordinated optimization is recommended.</p>
          </div>
        </div>
      `
      : `
        <div class="alert-banner__content">
          <span class="alert-banner__icon">✓</span>
          <div>
            <strong>JURISDICTION LOAD IS STABLE</strong>
            <p>Current authority balance remains within the simulated operating envelope.</p>
          </div>
        </div>
      `;

    const summary = document.getElementById('authority-opt-summary');
    if (summary) {
      summary.textContent = optimization.recommendationSummary;
    }
  }

  function renderTable(authorities) {
    const tableBody = document.getElementById('authority-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = authorities.map((authority) => `
      <tr>
        <td>
          <div class="authority-row__label">
            <span class="authority-row__swatch" style="background:${authority.color};"></span>
            <div>
              <strong>${authority.name}</strong>
              <small>${authority.code}</small>
            </div>
          </div>
        </td>
        <td>${authority.utilization}%</td>
        <td>${authority.avgSpeed} km/h</td>
        <td>${authority.queuePressure}</td>
        <td>${authority.crossBoundary}</td>
        <td><span class="authority-status authority-status--${authority.status === 'Overloaded' ? 'critical' : authority.status === 'Stressed' ? 'warn' : 'good'}">${authority.status}</span></td>
      </tr>
    `).join('');
  }

  function renderPlan(plan) {
    const list = document.getElementById('authority-plan-list');
    if (!list) return;

    list.innerHTML = plan.map((authority) => `
      <li class="authority-plan-item">
        <div class="authority-plan-item__topline">
          <span class="authority-row__swatch" style="background:${authority.color};"></span>
          <strong>${authority.name}</strong>
          <span class="authority-plan-item__delta ${authority.optimizedUtilization < authority.utilization ? 'is-improving' : 'is-challenged'}">${authority.optimizedUtilization < authority.utilization ? '+' : '-'}${Math.abs(authority.optimizedUtilization - authority.utilization).toFixed(1)} pts</span>
        </div>
        <small>${authority.recommendation}</small>
        <div class="authority-plan-item__bar">
          <span style="width:${authority.optimizedUtilization}%"></span>
        </div>
      </li>
    `).join('');
  }

  function renderLogs(logs) {
    const list = document.getElementById('authority-log-list');
    if (!list) return;

    list.innerHTML = logs.map((entry) => `
      <li>
        <span class="authority-log__time">${entry.time}</span>
        <div>
          <strong>${entry.title}</strong>
          <p>${entry.detail}</p>
        </div>
      </li>
    `).join('');
  }

  function addLog(title, detail) {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.logs = [{ time: stamp, title, detail }, ...state.logs].slice(0, 6);
    renderLogs(state.logs);
  }

  function renderCurrent(authorities, balance, optimization) {
    const scenario = document.getElementById('authority-scenario');
    if (scenario) {
      const overloaded = authorities.filter((authority) => authority.utilization >= 80).length;
      const underloaded = authorities.filter((authority) => authority.utilization < 60).length;
      scenario.textContent = balance.warning
        ? `THERE ARE ${overloaded} OVERLOADED AUTHORITIES AND ${underloaded} UNDERLOADED AUTHORITIES` 
        : 'AUTHORITY LOADS ARE STABLE';
    }

    const highAuthority = balance.overloadedAuthority ? balance.overloadedAuthority.name : 'N/A';
    const lowAuthority = balance.underloadedAuthority ? balance.underloadedAuthority.name : 'N/A';
    document.getElementById('authority-highest-load')?.replaceChildren(document.createTextNode(highAuthority));
    document.getElementById('authority-lowest-load')?.replaceChildren(document.createTextNode(lowAuthority));
    document.getElementById('authority-balance-reduction')?.replaceChildren(document.createTextNode(`${optimization.expectedGain.toFixed(1)} pts`));
  }

  function buildSnapshot() {
    const authorities = buildAuthorityData();
    const balance = computeBalance(authorities);
    const optimization = createOptimizationPlan(authorities);

    state.snapshot = { authorities, balance, optimization };
    renderSummary({ ...balance, optimization });
    renderBanner(balance, optimization);
    renderTable(authorities);
    renderPlan(optimization.plan);
    renderCurrent(authorities, balance, optimization);
    return state.snapshot;
  }

  function bindActions() {
    const optimizeButton = document.getElementById('authority-optimize-btn');
    const scenarioButton = document.getElementById('authority-scenario-btn');
    const resetButton = document.getElementById('authority-reset-btn');

    if (optimizeButton) {
      optimizeButton.addEventListener('click', () => {
        const snapshot = buildSnapshot();
        state.lastAction = 'Coordinated optimization applied';
        addLog('Optimization applied', `Network balance improved from ${snapshot.balance.networkBalance.toFixed(0)}% to ${clamp(snapshot.balance.networkBalance + snapshot.optimization.expectedGain, 0, 100).toFixed(0)}% with a ${snapshot.optimization.expectedGain.toFixed(1)} point reduction in displacement risk.`);
      });
    }

    if (scenarioButton) {
      scenarioButton.addEventListener('click', () => {
        const snapshot = buildSnapshot();
        const trigger = snapshot.balance.warning ? 'Boundary diversion scenario' : 'Balanced corridor scenario';
        const detail = snapshot.balance.warning
          ? 'Authority imbalance is increasing around Nagpur Central and Cotton Market; coordinated adjustments are recommended.'
          : 'Current state remains within acceptable jurisdiction balance thresholds.';
        state.lastAction = trigger;
        addLog(trigger, detail);
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        state.logs = [];
        renderLogs(state.logs);
        state.lastAction = 'Simulation reset';
        addLog('Simulation reset', 'Authority load snapshot returned to the current corridor baseline.');
        buildSnapshot();
      });
    }
  }

  function init() {
    if (typeof document === 'undefined') return;
    renderLogs(state.logs);
    buildSnapshot();
    bindActions();
    addLog('Authority baseline loaded', 'Live road-level authority utilization has been projected across the current jurisdiction network.');
  }

  if (typeof window !== 'undefined') {
    window.FlowXAuthorityCoordination = {
      init,
      buildSnapshot,
      createOptimizationPlan,
      computeBalance,
      state
    };
  }
})();
