(function () {
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const weatherProfiles = {
    clear: {
      id: 'clear',
      label: 'Clear',
      icon: '☀️',
      temp: 30,
      humidity: 48,
      wind: 12,
      visibility: 1,
      speedReduction: 0,
      capacityReduction: 0,
      impactScore: 8,
      description: 'Clear visibility with stable road efficiency and low disruption.',
      alert: 'Low weather impact'
    },
    lightRain: {
      id: 'light-rain',
      label: 'Light Rain',
      icon: '🌦️',
      temp: 27,
      humidity: 68,
      wind: 16,
      visibility: 0.82,
      speedReduction: 0.12,
      capacityReduction: 0.18,
      impactScore: 32,
      description: 'Intermittent rain slightly reduces driver comfort and roadway capacity.',
      alert: 'Reduced speed and slower discharge'
    },
    heavyRain: {
      id: 'heavy-rain',
      label: 'Heavy Rain',
      icon: '🌧️',
      temp: 24,
      humidity: 82,
      wind: 22,
      visibility: 0.58,
      speedReduction: 0.22,
      capacityReduction: 0.3,
      impactScore: 54,
      description: 'Heavy rainfall adds queue pressure and lowers effective corridor throughput.',
      alert: 'Queue pressure building'
    },
    fog: {
      id: 'fog',
      label: 'Fog',
      icon: '🌫️',
      temp: 22,
      humidity: 76,
      wind: 10,
      visibility: 0.42,
      speedReduction: 0.28,
      capacityReduction: 0.2,
      impactScore: 61,
      description: 'Low visibility increases stopping distance and lifts risk around junctions.',
      alert: 'Visibility constraints on urban corridors'
    },
    storm: {
      id: 'storm',
      label: 'Storm',
      icon: '⛈️',
      temp: 21,
      humidity: 88,
      wind: 30,
      visibility: 0.33,
      speedReduction: 0.38,
      capacityReduction: 0.42,
      impactScore: 82,
      description: 'Severe weather drives maximum disruption, with high delay and network risk.',
      alert: 'High-risk operation mode'
    }
  };

  const state = {
    currentScenario: 'light-rain',
    history: [],
    alerts: []
  };

  function getScenario(scenarioId = state.currentScenario) {
    return weatherProfiles[scenarioId] || weatherProfiles.clear;
  }

  function setScenario(scenarioId) {
    const next = getScenario(scenarioId);
    state.currentScenario = next.id;
    state.history = [{
      id: next.id,
      at: new Date().toISOString(),
      label: next.label,
      impactScore: next.impactScore
    }, ...state.history].slice(0, 8);
    state.alerts = [{
      id: next.id,
      title: `${next.label} weather scenario active`,
      detail: next.alert
    }, ...state.alerts].slice(0, 4);
    return next;
  }

  function getCurrentScenario() {
    return getScenario(state.currentScenario);
  }

  function calculateRoadImpact(road, scenario = getCurrentScenario()) {
    const speedBase = safeNumber(road.freeFlowSpeed || road.maxSpeed || 45, 45);
    const capacityBase = safeNumber(road.capacityPerMinute || 220, 220);
    const roadTypeModifier = road.roadType === 'local' ? 1.22 : road.roadType === 'highway' ? 0.84 : 1;
    const speedReduction = safeNumber(scenario.speedReduction, 0) * roadTypeModifier;
    const capacityReduction = safeNumber(scenario.capacityReduction, 0) * (road.roadType === 'local' ? 1.28 : road.roadType === 'highway' ? 0.86 : 1);
    const visibilityFactor = safeNumber(scenario.visibility, 1);
    const effectiveSpeed = clamp(speedBase * (1 - speedReduction), 8, speedBase * 1.1);
    const effectiveCapacity = clamp(capacityBase * (1 - capacityReduction), Math.max(40, capacityBase * 0.38), capacityBase * 1.18);
    const utilization = clamp(((safeNumber(road.currentVehicles, 0) / Math.max(1, effectiveCapacity)) * 100), 0, 220);
    const impactScore = clamp(
      Math.round((safeNumber(scenario.impactScore, 0) * 0.7) + (1 - visibilityFactor) * 35 + (utilization / 3.8)),
      0,
      100
    );

    return {
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      speedReduction,
      capacityReduction,
      visibility: Number((visibilityFactor * 100).toFixed(0)),
      effectiveSpeed: Number(effectiveSpeed.toFixed(1)),
      effectiveCapacity: Number(effectiveCapacity.toFixed(0)),
      utilization: Number(utilization.toFixed(1)),
      impactScore,
      hotspot: impactScore >= 65,
      routePenalty: Number((speedReduction * 18 + (1 - visibilityFactor) * 12).toFixed(1)),
      condition: impactScore >= 70 ? 'SEVERE' : impactScore >= 45 ? 'MODERATE' : 'LOW'
    };
  }

  function getNetworkSummary(roads, scenario = getCurrentScenario()) {
    const impacts = roads.map((road) => ({
      id: road.id,
      name: road.name,
      impact: calculateRoadImpact(road, scenario),
      currentVehicles: safeNumber(road.currentVehicles, 0),
      averageSpeed: safeNumber(road.averageSpeed, 0)
    }));

    const averageImpact = impacts.length
      ? impacts.reduce((sum, item) => sum + item.impact.impactScore, 0) / impacts.length
      : 0;

    const hotspotRoads = impacts
      .filter((item) => item.impact.hotspot)
      .sort((a, b) => b.impact.impactScore - a.impact.impactScore)
      .slice(0, 3)
      .map((item) => ({ id: item.id, name: item.name, impactScore: item.impact.impactScore }));

    return {
      scenario: scenario.id,
      averageImpact: Number(averageImpact.toFixed(1)),
      hotspotRoads,
      impactedRoads: impacts.filter((item) => item.impact.impactScore >= 30).length,
      alertLevel: averageImpact >= 65 ? 'SEVERE' : averageImpact >= 40 ? 'MODERATE' : 'LOW'
    };
  }

  function applyToSimulation(simulationEngine, scenarioId = state.currentScenario) {
    if (!simulationEngine || typeof simulationEngine !== 'object') return null;
    const scenario = setScenario(scenarioId);
    const nextState = {
      scenarioId: scenario.id,
      currentScenario: scenario,
      summary: getNetworkSummary(simulationEngine.roads || [], scenario)
    };

    simulationEngine.weatherState = nextState;
    if (typeof simulationEngine.recalculateRoadMetrics === 'function') {
      simulationEngine.recalculateRoadMetrics();
    }
    return nextState;
  }

  if (typeof window !== 'undefined') {
    window.FlowXWeatherConfig = {
      profiles: weatherProfiles,
      defaultScenario: 'light-rain'
    };

    window.FlowXWeatherEngine = {
      profiles: weatherProfiles,
      getScenario,
      setScenario,
      getCurrentScenario,
      calculateRoadImpact,
      getNetworkSummary,
      applyToSimulation,
      state
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      weatherProfiles,
      getScenario,
      setScenario,
      getCurrentScenario,
      calculateRoadImpact,
      getNetworkSummary,
      applyToSimulation,
      state
    };
  }
})();
