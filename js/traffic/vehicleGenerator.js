(function () {
  function getTimeProfile(hour) {
    const profiles = window.FlowXTrafficConfig?.timeProfiles || {};

    if (hour >= 7 && hour < 10) return profiles.morning || { multiplier: 1 };
    if (hour >= 10 && hour < 16) return profiles.midday || { multiplier: 0.72 };
    if (hour >= 16 && hour < 21) return profiles.evening || { multiplier: 1.18 };
    if (hour >= 21 || hour < 7) return profiles.night || { multiplier: 0.34 };
    return profiles.normal || { multiplier: 0.6 };
  }

  function deterministicWave(seed, tickCount) {
    const base = Math.sin((seed + tickCount + 1) * 12.9898) * 43758.5453;
    return base - Math.floor(base);
  }

  function computeVehicleGeneration(road, simulationState) {
    const hour = Math.floor((simulationState.simulationTimeMinutes % 1440) / 60);
    const profile = getTimeProfile(hour);
    const upstreamLoad = (road.upstreamRoads || []).reduce((sum, id) => {
      const upstreamRoad = simulationState.roadsById[id];
      return sum + (upstreamRoad ? upstreamRoad.utilization : 0);
    }, 0) / Math.max(1, (road.upstreamRoads || []).length);

    const incidentPenalty = road.incident ? (window.FlowXTrafficConfig.incidentEffects[road.incident] || 0.2) : 0;
    const congestionPenalty = Math.min(road.utilization / 150, 0.7);
    const demandFactor = road.roadType === 'highway' ? 1.16 : road.roadType === 'local' ? 0.82 : 1.02;
    const randomBias = deterministicWave(road.id.length + road.name.length, simulationState.tickCount || 0) * 18;

    const inflow = Math.round(
      (road.capacityPerMinute * 0.18 * profile.multiplier * demandFactor * (1 + upstreamLoad / 180)) *
      (1 - congestionPenalty) *
      (1 - incidentPenalty) +
      randomBias
    );

    return Math.max(0, Math.min(inflow, Math.round(road.capacityPerMinute * 0.7)));
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficVehicleGenerator = { computeVehicleGeneration, getTimeProfile, deterministicWave };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeVehicleGeneration, getTimeProfile, deterministicWave };
  }
})();
