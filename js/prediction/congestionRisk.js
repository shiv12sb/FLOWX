(function () {
  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function calculateRiskScore(features, forecast) {
    const config = window.FlowXPredictionConfig?.weights || {
      utilization: 0.38,
      utilizationTrend: 0.2,
      speedDecline: 0.18,
      incident: 0.14,
      upstream: 0.1
    };

    const utilizationFactor = clamp((forecast.predictedUtilization / 180) * 100, 0, 100) * config.utilization;
    const trendFactor = clamp(Math.abs(features.utilizationTrend || 0) * 18, 0, 100) * config.utilizationTrend;
    const speedDeclineFactor = clamp(((features.currentSpeed - forecast.predictedAverageSpeed) / Math.max(1, features.currentSpeed)) * 100, 0, 100) * config.speedDecline;
    const incidentFactor = features.activeIncident ? 18 * config.incident : 0;
    const upstreamFactor = clamp((features.upstreamCongestion / 120) * 100, 0, 100) * config.upstream;

    const score = clamp(utilizationFactor + trendFactor + speedDeclineFactor + incidentFactor + upstreamFactor, 0, 100);
    const risk = score <= 30 ? 'LOW' : score <= 60 ? 'MODERATE' : score <= 80 ? 'HIGH' : 'CRITICAL';

    return {
      riskScore: Number(score.toFixed(0)),
      riskLabel: risk,
      level: risk
    };
  }

  function calculateCapacityBreach(features, forecast) {
    if (forecast.predictedUtilization < 100) {
      return { breachExpected: false, message: 'No capacity breach expected within forecast window.' };
    }

    const rate = Math.max(0.1, (forecast.predictedUtilization - features.currentUtilization) / Math.max(1, forecast.horizonMinutes / 15));
    const minutesToBreach = Math.max(0, Math.ceil((100 - features.currentUtilization) / Math.max(rate, 0.5)));

    return {
      breachExpected: true,
      minutesToBreach,
      message: `${features.roadName} is expected to exceed capacity in approximately ${minutesToBreach} minutes.`
    };
  }

  if (typeof window !== 'undefined') {
    window.FlowXPredictionRisk = { calculateRiskScore, calculateCapacityBreach };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateRiskScore, calculateCapacityBreach };
  }
})();
