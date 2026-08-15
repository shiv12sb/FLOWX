(function () {
  function buildExplanation(features, forecast, risk, breach) {
    const reasons = [];

    if ((features.vehicleTrend || 0) > 0) reasons.push('↑ Vehicle inflow increasing');
    if ((features.utilizationTrend || 0) > 0) reasons.push('↑ Utilization trend rising');
    if ((features.speedTrend || 0) < 0) reasons.push('↓ Average speed decreasing');
    if (features.activeIncident) reasons.push('⚠ Incident or lane disruption active');
    if ((features.upstreamCongestion || 0) > 65) reasons.push('↑ Upstream congestion feeding the corridor');
    if ((features.downstreamCongestion || 0) > 75) reasons.push('↑ Downstream queue pressure');

    if (!reasons.length) {
      reasons.push('Traffic remains relatively stable, though the corridor is still approaching threshold demand.');
    }

    let explainer = `⚠ ${risk.riskLabel} CONGESTION RISK\n${features.roadName} is likely to become congested in the next ${forecast.horizonMinutes} minutes.`;
    if (breach.breachExpected) {
      explainer += `\n${breach.message}`;
    }

    return {
      summary: explainer,
      reasons: reasons.slice(0, 5),
      modelFactors: {
        utilization: features.currentUtilization,
        trend: features.utilizationTrend,
        speed: features.currentSpeed,
        incident: features.activeIncident,
        upstreamCongestion: features.upstreamCongestion,
        downstreamCongestion: features.downstreamCongestion
      }
    };
  }

  if (typeof window !== 'undefined') {
    window.FlowXPredictionExplanation = { buildExplanation };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildExplanation };
  }
})();
