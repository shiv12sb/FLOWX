(function () {
  const state = {
    selectedIntersectionId: null,
    currentMode: 'SMART'
  };

  function formatPercent(value) {
    return `${Math.max(0, Number(value || 0).toFixed(0))}%`;
  }

  function getSelectedIntersection(intersections) {
    const selected = intersections.find((intersection) => intersection.id === state.selectedIntersectionId) || intersections[0];
    if (selected) state.selectedIntersectionId = selected.id;
    return selected || null;
  }

  function renderIntersectionList(intersections) {
    const container = document.getElementById('intersection-list');
    if (!container) return;

    container.innerHTML = intersections.map((intersection) => {
      const isActive = intersection.id === state.selectedIntersectionId;
      const loadLabel = intersection.density >= 75 ? 'HIGH LOAD' : intersection.density >= 50 ? 'MODERATE' : 'LOW LOAD';
      return `
        <article class="card signal-intersection-card ${isActive ? 'is-active' : ''}" data-intersection-id="${intersection.id}">
          <div class="card__header">
            <h3 class="card__title">${intersection.name}</h3>
            <span class="card__badge">${intersection.signalMode}</span>
          </div>
          <div class="card__body">
            <div class="signal-card__row">
              <span>Current Mode</span>
              <strong>${intersection.signalMode}</strong>
            </div>
            <div class="signal-card__row">
              <span>Traffic Density</span>
              <strong>${formatPercent(intersection.density)}</strong>
            </div>
            <div class="signal-card__row">
              <span>Queue</span>
              <strong>${intersection.queueLength} vehicles</strong>
            </div>
            <div class="signal-card__row">
              <span>Current Phase</span>
              <strong>${intersection.currentPhase.replace(/_/g, ' ')}</strong>
            </div>
            <div class="signal-card__row">
              <span>Remaining</span>
              <strong>${intersection.remaining || 24} sec</strong>
            </div>
            <div class="signal-card__row">
              <span>Status</span>
              <strong>${loadLabel}</strong>
            </div>
            <button type="button" class="button button--ghost signal-view-btn" data-intersection-id="${intersection.id}">VIEW INTERSECTION</button>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.signal-view-btn').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedIntersectionId = button.dataset.intersectionId;
        renderView();
      });
    });
  }

  function renderSignalVisual(intersection) {
    const container = document.getElementById('signal-visual');
    if (!container) return;

    const north = intersection.approaches.NORTH?.status || 'LOW';
    const south = intersection.approaches.SOUTH?.status || 'LOW';
    const east = intersection.approaches.EAST?.status || 'LOW';
    const west = intersection.approaches.WEST?.status || 'LOW';

    const activePhase = intersection.currentPhase;
    const northLight = activePhase.includes('NORTH_SOUTH') ? 'green' : 'red';
    const southLight = activePhase.includes('NORTH_SOUTH') ? 'green' : 'red';
    const eastLight = activePhase.includes('EAST_WEST') ? 'green' : 'red';
    const westLight = activePhase.includes('EAST_WEST') ? 'green' : 'red';

    container.innerHTML = `
      <div class="signal-visual__card">
        <div class="signal-direction">
          <span class="signal-direction__label">NORTH</span>
          <span class="signal-light signal-light--${northLight}">${northLight.toUpperCase()}</span>
        </div>
        <div class="signal-direction signal-direction--vertical">
          <span class="signal-direction__label">SOUTH</span>
          <span class="signal-light signal-light--${southLight}">${southLight.toUpperCase()}</span>
        </div>
        <div class="signal-direction signal-direction--horizontal">
          <span class="signal-direction__label">WEST</span>
          <span class="signal-light signal-light--${westLight}">${westLight.toUpperCase()}</span>
        </div>
        <div class="signal-direction signal-direction--horizontal">
          <span class="signal-direction__label">EAST</span>
          <span class="signal-light signal-light--${eastLight}">${eastLight.toUpperCase()}</span>
        </div>
      </div>
    `;
  }

  function renderApproaches(intersection) {
    const container = document.getElementById('signal-approaches');
    if (!container) return;

    if (!intersection || !intersection.approaches) {
      container.innerHTML = '';
      return;
    }

    const directions = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
    container.innerHTML = directions.map((direction) => {
      const approach = intersection.approaches[direction];
      return `
        <article class="signal-approach-card">
          <div class="signal-approach-card__header">
            <strong>${direction}</strong>
            <span class="badge badge--info">${approach?.status || 'LOW'}</span>
          </div>
          <div class="signal-approach-card__metrics">
            <span>Density: ${formatPercent(approach?.density || 0)}</span>
            <span>Queue: ${approach?.queueLength || 0}</span>
            <span>Wait: ${approach?.waitingTime || 0} sec</span>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderRecommendation(intersection) {
    const container = document.getElementById('signal-recommendation');
    if (!container) return;

    const nsGreen = intersection.northSouthGreen || 32;
    const ewGreen = intersection.eastWestGreen || 26;

    container.innerHTML = `
      <div class="signal-recommendation-panel">
        <div class="signal-recommendation-panel__title">SIGNAL RECOMMENDATION</div>
        <p>${intersection.recommendation || 'Signal demand is balanced.'}</p>
        <div class="signal-recommendation-panel__split">
          <span>North-South Green: <strong>${nsGreen} sec</strong></span>
          <span>East-West Green: <strong>${ewGreen} sec</strong></span>
        </div>
        <p class="signal-recommendation-panel__footnote">SIMULATED EXPECTED IMPACT — Reduced queue, reduced waiting time, improved throughput.</p>
      </div>
    `;
  }

  function renderMetrics(intersections) {
    const summary = window.FlowXSignalEngine?.summary || {};
    const avgWaitReduction = summary.averageWaitReduction || 0;
    const signalEfficiency = summary.signalEfficiency || 0;

    document.getElementById('signal-dashboard-optimized').textContent = summary.optimizedIntersections || 0;
    document.getElementById('signal-dashboard-density').textContent = summary.highDensityJunctions || 0;
    document.getElementById('signal-dashboard-wait').textContent = `${avgWaitReduction}%`;
    document.getElementById('signal-dashboard-efficiency').textContent = `${signalEfficiency}%`;

    const selected = getSelectedIntersection(intersections);
    if (!selected) return;

    document.getElementById('signal-intersection-name').textContent = selected.name || '—';
    document.getElementById('signal-current-mode').textContent = selected.signalMode;
    const modeElem = document.getElementById('signal-mode');
    if (modeElem) modeElem.textContent = selected.signalMode;
    document.getElementById('signal-current-phase').textContent = selected.currentPhase.replace(/_/g, ' ');
    document.getElementById('signal-remaining').textContent = `${selected.remaining || 24} sec`;
    document.getElementById('signal-cycle').textContent = `${selected.cycleLength || 120} sec`;
    document.getElementById('signal-average-wait').textContent = `${selected.averageWait || 0} sec`;
    document.getElementById('signal-average-queue').textContent = `${selected.queueLength || 0}`;
    document.getElementById('signal-throughput').textContent = `${Math.round((selected.density || 0) * 1.5)} veh/hr`;
    document.getElementById('signal-efficiency').textContent = `${selected.signalEfficiency || 0}%`; 
    document.getElementById('signal-congestion').textContent = selected.density >= 75 ? 'HIGH' : selected.density >= 50 ? 'MODERATE' : 'LOW';
  }

  function renderComparison(engineState) {
    const comparison = engineState?.comparison || {};
    const fixed = comparison.fixed || {};
    const smart = comparison.smart || {};

    const fixedBlock = document.getElementById('comparison-fixed');
    const smartBlock = document.getElementById('comparison-smart');
    if (fixedBlock && smartBlock) {
      fixedBlock.innerHTML = `
        <div class="comparison-table__header">FIXED SIGNAL</div>
        <div class="comparison-table__row"><span>Waiting</span><strong>${fixed.waiting || 0} sec</strong></div>
        <div class="comparison-table__row"><span>Queue</span><strong>${fixed.queue || 0}</strong></div>
        <div class="comparison-table__row"><span>Speed</span><strong>${fixed.speed || 0} km/h</strong></div>
        <div class="comparison-table__row"><span>Throughput</span><strong>${fixed.throughput || 0}</strong></div>
        <div class="comparison-table__row"><span>Congestion</span><strong>${fixed.congestion || 0}%</strong></div>
      `;

      smartBlock.innerHTML = `
        <div class="comparison-table__header">SMART SIGNAL</div>
        <div class="comparison-table__row"><span>Waiting</span><strong>${smart.waiting || 0} sec</strong></div>
        <div class="comparison-table__row"><span>Queue</span><strong>${smart.queue || 0}</strong></div>
        <div class="comparison-table__row"><span>Speed</span><strong>${smart.speed || 0} km/h</strong></div>
        <div class="comparison-table__row"><span>Throughput</span><strong>${smart.throughput || 0}</strong></div>
        <div class="comparison-table__row"><span>Congestion</span><strong>${smart.congestion || 0}%</strong></div>
      `;
    }
  }

  function renderEventLog(events) {
    const container = document.getElementById('signal-event-log');
    if (!container) return;
    container.innerHTML = (events || []).map((event) => `
      <div class="event-log__item">
        <span>${event.time}</span>
        <strong>${event.message}</strong>
      </div>
    `).join('');
  }

  function renderView() {
    const engineState = window.FlowXSignalEngine?.getState?.();
    if (!engineState) return;

    const intersections = engineState.intersections || [];
    const selected = getSelectedIntersection(intersections);

    if (!selected) return;

    renderIntersectionList(intersections);
    renderSignalVisual(selected);
    renderApproaches(selected);
    renderRecommendation(selected);
    renderMetrics(intersections);
    renderComparison(engineState);
    renderEventLog(engineState.eventLog || []);
  }

  function bindControls() {
    const applyBtn = document.getElementById('apply-smart-signal');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        window.FlowXSignalEngine?.applySmartSignal?.();
        renderView();
      });
    }

    const modeButton = document.getElementById('mode-toggle');
    if (modeButton) {
      modeButton.addEventListener('click', () => {
        const nextMode = state.currentMode === 'SMART' ? 'FIXED' : 'SMART';
        state.currentMode = nextMode;
        window.FlowXSignalEngine?.setMode?.(nextMode);
        renderView();
      });
    }

    const autoBtn = document.getElementById('auto-optimize-toggle');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        window.FlowXSignalEngine?.toggleAutoOptimize?.();
        renderView();
      });
    }

    const resetBtn = document.getElementById('reset-signal-sim');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.FlowXSignalEngine?.resetSignalSimulation?.();
        renderView();
      });
    }

    const emergencyBtn = document.getElementById('emergency-priority-btn');
    if (emergencyBtn) {
      emergencyBtn.addEventListener('click', async () => {
        const selected = getSelectedIntersection(window.FlowXSignalEngine.intersections || []);
        if (!selected) return alert('No intersection selected');
        const direction = prompt('Enter emergency direction (NORTH, SOUTH, EAST, WEST):', 'NORTH');
        if (!direction) return;
        try {
          const token = localStorage.getItem('authToken');
          const resp = await fetch(`/api/signals/${encodeURIComponent(selected.id)}/emergency`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token?{ Authorization: `Bearer ${token}` }: {}) },
            body: JSON.stringify({ direction: direction.toUpperCase() })
          });
          const json = await resp.json();
          if (json && json.success) {
            selected.recommendedPlan = json.data;
            selected.recommendation = (selected.recommendation || '') + '\nEmergency priority recommended.';
            alert('Emergency priority suggestion received');
            renderView();
          } else {
            alert('Emergency request failed');
          }
        } catch (e) { alert('Emergency request error'); }
      });
    }
  }

  function init() {
    if (!document.getElementById('intersection-list')) return;
    window.FlowXSignalEngine?.init?.();
    state.currentMode = window.FlowXSignalEngine?.mode || 'SMART';
    bindControls();
    renderView();

    window.setInterval(() => {
      if (window.FlowXTrafficEngine && !window.FlowXTrafficEngine.isRunning) return;
      if (window.FlowXSignalEngine) {
        window.FlowXSignalEngine.refresh();
        renderView();
      }
    }, 5000);
  }

  if (typeof window !== 'undefined') {
    window.FlowXSignalView = { init, renderView };
    document.addEventListener('DOMContentLoaded', init);
  }
})();
