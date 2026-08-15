// Simple configurable scoring engine reused by route optimizer.
function scoreRoute(route, weights = {}, options = {}) {
  const w = Object.assign({ time: 0.5, congestion: 0.25, speed: 0.15, incidents: 0.1, prediction: 0.1 }, weights);
  const travelTime = Number(route.etaMinutes || 0);
  const congestion = Number(route.averageUtilization || 0);
  const speed = Number(route.avgSpeed || 0);
  const incidents = Number(route.incidents || 0);
  const predicted = Number(options.predictedTrafficLevel || 0);

  // Lower score is worse; produce higher-is-better score
  const timeScore = Math.max(0, 100 - travelTime);
  const congestionScore = Math.max(0, 100 - congestion);
  const speedScore = Math.min(100, speed);
  const incidentPenalty = incidents * 12;

  const raw = timeScore * w.time + congestionScore * w.congestion + speedScore * w.speed - incidentPenalty * w.incidents - (predicted * w.prediction);
  const normalized = Math.max(0, Math.min(100, Math.round(raw)));

  return { score: normalized, explanation: `Computed from time(${travelTime}m), congestion(${congestion}%), speed(${speed}km/h), incidents(${incidents})` };
}

module.exports = { scoreRoute };
