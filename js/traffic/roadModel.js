(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function getRoadTypeConfig(roadType) {
    const { roadTypeConfig = {} } = window.FlowXTrafficConfig || {};
    return roadTypeConfig[roadType] || roadTypeConfig.arterial || roadTypeConfig.highway;
  }

  function createRoad(rawRoad) {
    const config = getRoadTypeConfig(rawRoad.roadType || 'arterial');
    const lanes = Math.max(1, safeNumber(rawRoad.lanes, 2));
    const length = Math.max(1, safeNumber(rawRoad.length, 3.8));
    const freeFlowSpeed = Math.max(12, safeNumber(rawRoad.freeFlowSpeed, rawRoad.maxSpeed || 55));
    const capacityPerMinute = Math.max(
      120,
      Math.round((rawRoad.capacityPerMinute || 220) * (1 + (lanes - 2) * 0.1) * (config.capacityPerLane / (config.capacityPerLane || 48)))
    );
    const currentVehicles = clamp(
      Math.round(safeNumber(rawRoad.currentVehicles, capacityPerMinute * 0.62)),
      0,
      Math.round(capacityPerMinute * (window.FlowXTrafficConfig?.constants?.maxVehicleCapFactor || 1.45))
    );

    return {
      id: rawRoad.id,
      name: rawRoad.name,
      roadType: rawRoad.roadType || 'arterial',
      length,
      lanes,
      capacityPerMinute,
      maxSpeed: Math.max(25, safeNumber(rawRoad.maxSpeed, 60)),
      freeFlowSpeed,
      currentVehicles,
      vehiclesEntering: 0,
      vehiclesExiting: 0,
      utilization: 0,
      averageSpeed: freeFlowSpeed,
      density: 0,
      congestionLevel: 'FREE_FLOW',
      delay: 0,
      status: 'GREEN',
      upstreamRoads: rawRoad.upstreamRoads || [],
      downstreamRoads: rawRoad.downstreamRoads || [],
      intersectionId: rawRoad.intersectionId || null,
      authority: rawRoad.authority || 'Nagpur Metro',
      incident: rawRoad.incident || null,
      freeFlowTravelTime: Math.max(2, (length * 60) / freeFlowSpeed),
      maxVehicles: Math.round(capacityPerMinute * (window.FlowXTrafficConfig?.constants?.maxVehicleCapFactor || 1.45))
    };
  }

  function applyIncident(road, incidentType) {
    if (!incidentType) {
      road.incident = null;
      return road;
    }

    road.incident = incidentType;
    return road;
  }

  function clearIncident(road) {
    road.incident = null;
    return road;
  }

  function getStatusColor(value) {
    const statusMap = {
      green: '#22c55e',
      orange: '#f97316',
      red: '#ef4444'
    };

    return statusMap[value] || statusMap.green;
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficRoadModel = {
      createRoad,
      applyIncident,
      clearIncident,
      clamp,
      getStatusColor
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createRoad,
      applyIncident,
      clearIncident,
      clamp,
      getStatusColor
    };
  }
})();
