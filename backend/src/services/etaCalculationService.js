function calculateETAForRoute(route) {
  if (!route || !route.distanceKm) return { etaMinutes: 0 };
  const distance = Number(route.distanceKm) || 0;
  const avgSpeed = Number(route.avgSpeed) || Math.max(20, distance / 0.5);
  const congestionFactor = Math.min(2, (route.averageUtilization || 50) / 50);
  const incidentDelay = Number(route.delay || 0);

  // Base travel time in minutes
  const baseTime = (distance / Math.max(1, avgSpeed)) * 60;
  const eta = Math.round(baseTime * congestionFactor + incidentDelay);

  return { etaMinutes: eta };
}

module.exports = { calculateETAForRoute };
