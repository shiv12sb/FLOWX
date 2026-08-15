(function () {
  const predictionConfig = {
    label: 'SIMULATED AI / PREDICTION MODE',
    mode: 'DEMO PREDICTION MODE',
    maxHistoryPerRoad: 120,
    minObservationsForForecast: 10,
    updateIntervalMs: 12000,
    forecastHorizonMinutes: [15, 30, 45],
    timePeriods: [
      { id: 'night', label: 'NIGHT', start: 0, end: 6 },
      { id: 'earlyMorning', label: 'EARLY MORNING', start: 6, end: 10 },
      { id: 'midday', label: 'MIDDAY', start: 10, end: 16 },
      { id: 'evening', label: 'EVENING PEAK', start: 16, end: 21 },
      { id: 'lateEvening', label: 'LATE EVENING', start: 21, end: 24 }
    ],
    riskBands: [
      { label: 'LOW', min: 0, max: 30 },
      { label: 'MODERATE', min: 31, max: 60 },
      { label: 'HIGH', min: 61, max: 80 },
      { label: 'CRITICAL', min: 81, max: 100 }
    ],
    weights: {
      utilization: 0.38,
      utilizationTrend: 0.2,
      speedDecline: 0.18,
      incident: 0.14,
      upstream: 0.1
    },
    scenarioOptions: [10, 20, 30],
    utilizationThresholds: {
      freeFlow: 35,
      moderate: 60,
      high: 80,
      severe: 100,
      gridlock: 120
    }
  };

  if (typeof window !== 'undefined') {
    window.FlowXPredictionConfig = predictionConfig;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = predictionConfig;
  }
})();
