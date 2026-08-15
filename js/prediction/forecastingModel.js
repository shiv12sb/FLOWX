(function () {
  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function weightedAverage(values) {
    if (!values || !values.length) return 0;
    const weights = values.map((_, index) => index + 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const weightedSum = values.reduce((sum, value, index) => sum + (Number(value || 0) * weights[index]), 0);
    return weightedSum / totalWeight;
  }

  function trendSlope(values) {
    if (!values || values.length < 2) return 0;
    const step = Math.max(1, values.length - 1);
    const delta = values[values.length - 1] - values[0];
    return delta / step;
  }

  function forecastSeries(values, horizonMinutes) {
    if (!values || values.length < 3) return null;
    const recent = values.slice(-8);
    const base = weightedAverage(recent);
    const slope = trendSlope(recent);
    const horizonFactor = horizonMinutes / 5;
    return Number((base + (slope * horizonFactor)).toFixed(2));
  }

  function predictRoadForecast(features, horizonMinutes) {
    const vehicleBase = forecastSeries(features.recentVehicleValues || [features.currentVehicleCount], horizonMinutes);
    const utilizationBase = forecastSeries(features.recentUtilization || [features.currentUtilization], horizonMinutes);
    const speedBase = forecastSeries(features.recentSpeed || [features.currentSpeed], horizonMinutes);

    const predictedVehicleCount = clamp(
      safeNumber(vehicleBase, features.currentVehicleCount) + (features.vehicleTrend || 0) * (horizonMinutes / 5),
      0,
      features.capacity * 1.8
    );

    const predictedUtilization = clamp(
      safeNumber(utilizationBase, features.currentUtilization) + (features.utilizationTrend || 0) * (horizonMinutes / 5),
      0,
      180
    );

    const speedReduction = Math.max(0, (predictedUtilization - 35) * 0.18);
    const predictedSpeed = clamp(
      safeNumber(speedBase, features.currentSpeed) - speedReduction + (features.speedTrend || 0) * (horizonMinutes / 10),
      0,
      features.roadMaxSpeed || 65
    );

    const predictedDelay = clamp(
      features.currentDelay + Math.max(0, predictedUtilization - features.currentUtilization) * 0.75,
      0,
      90
    );

    const status = predictedUtilization >= 120 ? 'GRIDLOCK' : predictedUtilization >= 100 ? 'SEVERE' : predictedUtilization >= 80 ? 'HIGH' : predictedUtilization >= 60 ? 'MODERATE' : 'FREE_FLOW';

    return {
      horizonMinutes,
      predictedVehicleCount: Number(predictedVehicleCount.toFixed(0)),
      predictedUtilization: Number(predictedUtilization.toFixed(1)),
      predictedAverageSpeed: Number(predictedSpeed.toFixed(1)),
      predictedDelay: Number(predictedDelay.toFixed(1)),
      predictedCongestionLevel: status,
      predictedStatusColor: status === 'FREE_FLOW' ? 'green' : status === 'MODERATE' ? 'orange' : 'red'
    };
  }

  if (typeof window !== 'undefined') {
    window.FlowXForecastingModel = { predictRoadForecast, trendSlope, weightedAverage, forecastSeries };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { predictRoadForecast, trendSlope, weightedAverage, forecastSeries };
  }
})();
