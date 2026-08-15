(function () {
  const WEATHER_KEY = 'flowx-weather-scenario';

  function getStoredScenario() {
    try {
      return localStorage.getItem(WEATHER_KEY) || 'light-rain';
    } catch (error) {
      return 'light-rain';
    }
  }

  function persistScenario(value) {
    try {
      localStorage.setItem(WEATHER_KEY, value);
    } catch (error) {
      // no-op for local-only demo
    }
  }

  function renderWeatherDashboard(snapshot) {
    const scenario = snapshot?.currentScenario || window.FlowXWeatherEngine?.getCurrentScenario?.();
    if (!scenario) return;

    const tempEl = document.querySelector('[data-weather="temperature"]');
    const iconEl = document.querySelector('[data-weather="icon"]');
    const labelEl = document.querySelector('[data-weather="label"]');
    const impactEl = document.querySelector('[data-weather="impact"]');
    const visibilityEl = document.querySelector('[data-weather="visibility"]');
    const summaryEl = document.querySelector('[data-weather="summary"]');
    const historyEl = document.querySelector('[data-weather="history"]');

    if (tempEl) tempEl.textContent = `${scenario.temp}°C`;
    if (iconEl) iconEl.textContent = scenario.icon;
    if (labelEl) labelEl.textContent = scenario.label;
    if (impactEl) impactEl.textContent = `${scenario.impactScore} impact`;
    if (visibilityEl) visibilityEl.textContent = `${Math.round((scenario.visibility || 1) * 100)}% visibility`;
    if (summaryEl) summaryEl.textContent = scenario.description;

    if (historyEl) {
      const records = window.FlowXWeatherEngine?.state?.history || [];
      historyEl.innerHTML = records.length
        ? records.map((entry) => `<div class="weather-history__item"><span>${entry.label}</span><strong>${entry.impactScore}</strong></div>`).join('')
        : '<div class="weather-history__item"><span>Clear</span><strong>8</strong></div>';
    }
  }

  function updateScenarioFromControl(scenarioId) {
    const engine = window.FlowXWeatherEngine;
    if (!engine) return;

    engine.setScenario(scenarioId);
    persistScenario(scenarioId);
    renderWeatherDashboard(engine.getCurrentScenario());

    if (window.FlowXTrafficEngine && typeof window.FlowXTrafficEngine.recalculateRoadMetrics === 'function') {
      window.FlowXWeatherEngine.applyToSimulation(window.FlowXTrafficEngine, scenarioId);
      window.FlowXTrafficEngine.publishState?.();
    }
  }

  function bindWeatherControls() {
    const controls = document.querySelectorAll('[data-weather-scenario]');
    controls.forEach((button) => {
      button.addEventListener('click', () => {
        updateScenarioFromControl(button.dataset.weatherScenario);
        controls.forEach((item) => item.classList.toggle('is-active', item === button));
      });
    });

    const resetBtn = document.querySelector('[data-weather-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        updateScenarioFromControl('clear');
      });
    }
  }

  function initWeatherPage() {
    const stored = getStoredScenario();
    const engine = window.FlowXWeatherEngine;
    if (engine) {
      engine.setScenario(stored);
      renderWeatherDashboard(engine.getCurrentScenario());
      bindWeatherControls();

      if (window.FlowXTrafficEngine) {
        window.FlowXWeatherEngine.applyToSimulation(window.FlowXTrafficEngine, stored);
      }
    }
  }

  window.FlowXWeatherView = {
    renderWeatherDashboard,
    bindWeatherControls,
    initWeatherPage,
    updateScenarioFromControl
  };
})();
