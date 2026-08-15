(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function computeFlow(road, simulationState, roadsById) {
    const downstreamRoad = (road.downstreamRoads || []).map((id) => roadsById[id]).find(Boolean);
    const downstreamCapacity = downstreamRoad ? downstreamRoad.capacityPerMinute : road.capacityPerMinute;
    const downstreamPressure = downstreamRoad ? downstreamRoad.utilization : 0;
    const signalMultiplier = simulationState.intersectionEffects?.[road.id] || 1;
    const incidentReduction = road.incident ? (window.FlowXTrafficConfig.incidentEffects[road.incident] || 0.2) : 0;

    const flowBase = road.currentVehicles * 0.08;
    const availableOutflow = Math.max(0, road.capacityPerMinute * 0.22 * signalMultiplier * (1 - incidentReduction));
    const downstreamConstraint = Math.max(0, (downstreamCapacity * 0.24) * (1 - downstreamPressure / 180));

    const outflow = clamp(Math.round(flowBase + availableOutflow + downstreamConstraint * 0.18), 0, Math.max(25, road.capacityPerMinute * 0.64));
    const inflow = Math.max(0, Math.round(window.FlowXTrafficVehicleGenerator.computeVehicleGeneration(road, simulationState) * (1 - Math.min(downstreamPressure / 160, 0.5))));

    return { inflow, outflow };
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficFlow = { computeFlow };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeFlow };
  }
})();
