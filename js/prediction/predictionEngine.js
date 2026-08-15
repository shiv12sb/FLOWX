(function () {
  const DEFAULT_HISTORY = {
    maxSize: 120,
    records: []
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function getRoadStateFromSimulation() {
    const engine = window.FlowXTrafficEngine;
    if (engine && engine.getState) {
      const snapshot = engine.getState();
      if (snapshot && Array.isArray(snapshot.roads)) {
        return snapshot.roads;
      }
    }
    return [];
  }

  function createPredictionState() {
    return {
      historyByRoad: {},
      lastPrediction: {},
      predictionInterval: null,
      lastUpdatedAt: null,
      isInitialized: false,
      initializedObservations: 0
    };
  }

  const predictionState = createPredictionState();

  function getTimeStamp() {
    const now = new Date();
    return now.toISOString();
  }

  function getPredictionWindowMinutes() {
    return window.FlowXPredictionConfig?.forecastHorizonMinutes || [15, 30, 45];
  }

  function collectRoadSnapshot(road, simulationState) {
    return {
      timestamp: getTimeStamp(),
      simulationTime: simulationState && simulationState.clock ? simulationState.clock.totalMinutes : 0,
      vehicleCount: safeNumber(road.currentVehicles, 0),
      utilization: safeNumber(road.utilization, 0),
      averageSpeed: safeNumber(road.averageSpeed, 0),
      density: safeNumber(road.density, 0),
      delay: safeNumber(road.delay, 0),
      congestionLevel: road.congestionLevel || 'FREE_FLOW',
      status: road.status || 'GREEN',
      inflow: safeNumber(road.vehiclesEntering, 0),
      outflow: safeNumber(road.vehiclesExiting, 0),
      incidentActive: Boolean(road.incident),
      weatherImpactScore: safeNumber(road.weatherImpactScore, 0),
      weatherScenario: road.weatherScenario || 'CLEAR',
      weatherVisibility: safeNumber(road.weatherVisibility, 100)
    };
  }

  function ensureRoadHistory(roadId) {
    if (!predictionState.historyByRoad[roadId]) {
      predictionState.historyByRoad[roadId] = {
        maxSize: window.FlowXPredictionConfig?.maxHistoryPerRoad || 120,
        records: []
      };
    }

    return predictionState.historyByRoad[roadId];
  }

  function pushHistoryForRoad(road, simulationState) {
    const history = ensureRoadHistory(road.id);
    const snapshot = collectRoadSnapshot(road, simulationState);

    history.records.push(snapshot);

    if (history.records.length > history.maxSize) {
      history.records = history.records.slice(history.records.length - history.maxSize);
    }

    predictionState.initializedObservations = Math.max(predictionState.initializedObservations, history.records.length);
  }

  function getRoadHistory(roadId) {
    return predictionState.historyByRoad[roadId] || { maxSize: 120, records: [] };
  }

  function buildForecastForRoad(road, simulationState) {
    const history = getRoadHistory(road.id);
    const features = window.FlowXPredictionFeatureEngineering.buildFeatures(road, history, simulationState);
    const recentValues = history.records.slice(-12);

    features.recentVehicleValues = recentValues.map((entry) => safeNumber(entry.vehicleCount, 0));

    const forecasts = getPredictionWindowMinutes().map((minutes) => {
      const forecast = window.FlowXForecastingModel.predictRoadForecast({
        ...features,
        roadMaxSpeed: safeNumber(road.maxSpeed, 65),
        recentVehicleValues: features.recentVehicleValues,
        recentSpeed: recentValues.map((entry) => safeNumber(entry.averageSpeed, 0)),
        recentUtilization: recentValues.map((entry) => safeNumber(entry.utilization, 0))
      }, minutes);

      const risk = window.FlowXPredictionRisk.calculateRiskScore(features, forecast);
      const breach = window.FlowXPredictionRisk.calculateCapacityBreach(features, forecast);
      const explanation = window.FlowXPredictionExplanation.buildExplanation(features, forecast, risk, breach);

      return {
        minutes,
        forecast,
        risk,
        breach,
        explanation,
        modelConfidence: calculateModelConfidence(history.records.length, features)
      };
    });

    const primaryRisk = forecasts.reduce((worst, current) => {
      return (current.risk.riskScore > worst.risk.riskScore) ? current : worst;
    }, forecasts[0] || { risk: { riskScore: 0, riskLabel: 'LOW' } });

    return {
      roadId: road.id,
      roadName: road.name,
      currentUtilization: safeNumber(road.utilization, 0),
      currentSpeed: safeNumber(road.averageSpeed, 0),
      currentVehicleCount: safeNumber(road.currentVehicles, 0),
      currentStatus: road.status || 'GREEN',
      historyLength: history.records.length,
      hasSufficientHistory: history.records.length >= (window.FlowXPredictionConfig?.minObservationsForForecast || 10),
      forecasts,
      riskLevel: primaryRisk.risk.riskLabel,
      riskScore: primaryRisk.risk.riskScore,
      modelConfidence: primaryRisk.modelConfidence,
      breach: primaryRisk.breach,
      explanation: primaryRisk.explanation
    };
  }

  function calculateModelConfidence(historyLength, features) {
    const base = clamp(historyLength / 20, 0, 1);
    const trendConsistency = clamp(100 - Math.abs((features.utilizationTrend || 0) * 12), 0, 100);
    const completeness = clamp((features.sampleCount || 0) / 12, 0, 1) * 100;
    const confidence = (base * 40) + (trendConsistency * 0.25) + (completeness * 0.35);
    return Number(clamp(confidence, 0, 100).toFixed(0));
  }

  function getPredictionSummary(roads, simulationState) {
    const predictions = roads.map((road) => buildForecastForRoad(road, simulationState));
    const highRiskRoads = predictions.filter((item) => item.riskScore >= 60).sort((a, b) => b.riskScore - a.riskScore);
    const breachRoads = predictions.filter((item) => item.breach && item.breach.breachExpected).length;
    const avgPredictedUtilization = predictions.length ? predictions.reduce((sum, item) => sum + (item.forecasts[0]?.forecast.predictedUtilization || item.currentUtilization), 0) / predictions.length : 0;
    const nextExpectedCongestion = highRiskRoads.length ? highRiskRoads[0].forecasts[0].breach.minutesToBreach || 18 : 0;

    return {
      predictions,
      highRiskRoads,
      capacityBreaches: breachRoads,
      averagePredictedUtilization: Number(avgPredictedUtilization.toFixed(1)),
      nextExpectedCongestion: nextExpectedCongestion,
      generatedAt: getTimeStamp(),
      totalRoads: roads.length,
      mode: window.FlowXPredictionConfig?.mode || 'DEMO PREDICTION MODE',
      label: window.FlowXPredictionConfig?.label || 'SIMULATED AI / PREDICTION MODE'
    };
  }

  function collectSimulationHistory() {
    const simulationState = window.FlowXTrafficEngine && window.FlowXTrafficEngine.getState ? window.FlowXTrafficEngine.getState() : null;
    if (!simulationState || !Array.isArray(simulationState.roads)) return null;

    simulationState.roads.forEach((road) => {
      pushHistoryForRoad(road, simulationState);
    });

    predictionState.isInitialized = true;
    predictionState.lastUpdatedAt = getTimeStamp();
    return simulationState;
  }

  function initializePredictionEngine() {
    if (predictionState.isInitialized) return predictionState;
    collectSimulationHistory();
    predictionState.isInitialized = true;
    return predictionState;
  }

  function refreshPredictionState() {
    const simulationState = collectSimulationHistory();
    if (!simulationState) return null;

    const roads = simulationState.roads || [];
    return getPredictionSummary(roads, simulationState);
  }

  function resetPredictionState() {
    predictionState.historyByRoad = {};
    predictionState.lastPrediction = {};
    predictionState.lastUpdatedAt = null;
    predictionState.isInitialized = false;
    predictionState.initializedObservations = 0;
  }

  if (typeof window !== 'undefined') {
    window.FlowXPredictionEngine = {
      createPredictionState,
      collectSimulationHistory,
      initializePredictionEngine,
      refreshPredictionState,
      resetPredictionState,
      getPredictionSummary,
      getRoadHistory,
      buildForecastForRoad,
      getRoadStateFromSimulation,
      getPredictionWindowMinutes
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createPredictionState,
      collectSimulationHistory,
      initializePredictionEngine,
      refreshPredictionState,
      resetPredictionState,
      getPredictionSummary,
      getRoadHistory,
      buildForecastForRoad,
      getRoadStateFromSimulation,
      getPredictionWindowMinutes
    };
  }
})();
