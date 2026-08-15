(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function getTimePeriodLabel(hour) {
    const periods = window.FlowXPredictionConfig?.timePeriods || [
      { label: 'NIGHT', start: 0, end: 6 },
      { label: 'EARLY MORNING', start: 6, end: 10 },
      { label: 'MIDDAY', start: 10, end: 16 },
      { label: 'EVENING PEAK', start: 16, end: 21 },
      { label: 'LATE EVENING', start: 21, end: 24 }
    ];

    for (const period of periods) {
      const start = Number(period.start) || 0;
      const end = Number(period.end) || 24;
      if (hour >= start && hour < end) return period.label;
      if (end === 24 && hour >= 21) return period.label;
    }

    return 'MIDDAY';
  }

  function calculateTrend(values) {
    if (!values || values.length < 2) return 0;
    const last = values[values.length - 1];
    const first = values[0];
    const delta = last - first;
    return Number(((delta / Math.max(1, values.length - 1)) || 0).toFixed(3));
  }

  function calculateAverage(values) {
    if (!values || !values.length) return 0;
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    return total / values.length;
  }

  function buildFeatures(road, historyBuffer, simulationState) {
    const recent = historyBuffer && Array.isArray(historyBuffer.records) ? historyBuffer.records.slice(-12) : [];
    const latest = recent[recent.length - 1] || {};
    const vehicleTrend = calculateTrend(recent.map((entry) => safeNumber(entry.vehicleCount, 0)));
    const utilizationTrend = calculateTrend(recent.map((entry) => safeNumber(entry.utilization, 0)));
    const speedTrend = calculateTrend(recent.map((entry) => safeNumber(entry.averageSpeed, 0)));
    const inflowTrend = calculateTrend(recent.map((entry) => safeNumber(entry.inflow, 0)));
    const outflowTrend = calculateTrend(recent.map((entry) => safeNumber(entry.outflow, 0)));

    const roadCapacity = safeNumber(road.capacityPerMinute, 220);
    const currentUtilization = safeNumber(road.utilization, safeNumber(latest.utilization, 0));
    const currentSpeed = safeNumber(road.averageSpeed, safeNumber(latest.averageSpeed, 30));
    const currentVehicleCount = safeNumber(road.currentVehicles, safeNumber(latest.vehicleCount, 0));
    const currentDensity = safeNumber(road.density, safeNumber(latest.density, 0));
    const currentDelay = safeNumber(road.delay, safeNumber(latest.delay, 0));
    const activeIncident = Boolean(road.incident || latest.incidentActive);

    const upstreamCongestion = (road.upstreamRoads || []).reduce((sum, id) => {
      const upstreamRoad = (simulationState && simulationState.roadsById) ? simulationState.roadsById[id] : null;
      return sum + safeNumber(upstreamRoad && upstreamRoad.utilization, 0);
    }, 0) / Math.max(1, (road.upstreamRoads || []).length);

    const downstreamCongestion = (road.downstreamRoads || []).reduce((sum, id) => {
      const downstreamRoad = (simulationState && simulationState.roadsById) ? simulationState.roadsById[id] : null;
      return sum + safeNumber(downstreamRoad && downstreamRoad.utilization, 0);
    }, 0) / Math.max(1, (road.downstreamRoads || []).length);

    const hour = simulationState && simulationState.clock ? Number(simulationState.clock.hour) : 8;

    return {
      roadId: road.id,
      roadName: road.name,
      hour,
      timePeriod: getTimePeriodLabel(hour),
      currentVehicleCount,
      currentUtilization,
      currentSpeed,
      currentDensity,
      currentDelay,
      capacity: roadCapacity,
      vehicleTrend,
      utilizationTrend,
      speedTrend,
      inflowTrend,
      outflowTrend,
      roadLength: safeNumber(road.length, 4),
      lanes: safeNumber(road.lanes, 2),
      roadType: road.roadType || 'arterial',
      activeIncident,
      upstreamCongestion,
      downstreamCongestion,
      incidentType: road.incident || (latest.incidentActive ? 'active' : null),
      sampleCount: recent.length,
      recentUtilization: recent.map((entry) => safeNumber(entry.utilization, 0)),
      recentSpeed: recent.map((entry) => safeNumber(entry.averageSpeed, 0))
    };
  }

  if (typeof window !== 'undefined') {
    window.FlowXPredictionFeatureEngineering = { buildFeatures, calculateTrend, calculateAverage, getTimePeriodLabel };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildFeatures, calculateTrend, calculateAverage, getTimePeriodLabel };
  }
})();
