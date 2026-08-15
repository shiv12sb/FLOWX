(function () {
  function createIntersection(raw) {
    return {
      id: raw.id,
      name: raw.name,
      connectedRoads: raw.connectedRoads || [],
      capacity: Number(raw.capacity) || 30,
      processingRate: Number(raw.processingRate) || 20,
      currentQueue: Number(raw.currentQueue) || 0,
      signalState: raw.signalState || 'GREEN',
      cyclePhase: 0,
      cycleLength: 90,
      greenDuration: window.FlowXTrafficConfig?.signalCycle?.green || 40,
      yellowDuration: window.FlowXTrafficConfig?.signalCycle?.yellow || 5,
      redDuration: window.FlowXTrafficConfig?.signalCycle?.red || 45
    };
  }

  function updateSignalState(intersection, totalMinutes) {
    const cycle = (window.FlowXTrafficConfig?.signalCycle || { green: 40, yellow: 5, red: 45 });
    const totalSeconds = totalMinutes * 60;
    const cycleLength = cycle.green + cycle.yellow + cycle.red;
    const phase = totalSeconds % cycleLength;

    if (phase < cycle.green) intersection.signalState = 'GREEN';
    else if (phase < cycle.green + cycle.yellow) intersection.signalState = 'YELLOW';
    else intersection.signalState = 'RED';

    return intersection;
  }

  function calculateIntersectionEffect(intersection, roadsById) {
    const connectedRoads = (intersection.connectedRoads || []).map((id) => roadsById[id]).filter(Boolean);
    const activeLoad = connectedRoads.reduce((sum, road) => sum + (Number(road.utilization) || 0), 0);
    const signalMultiplier = intersection.signalState === 'GREEN' ? 1.1 : intersection.signalState === 'YELLOW' ? 0.7 : 0.42;
    const queuePenalty = Math.min(activeLoad / 240, 0.45);
    return Number((signalMultiplier * (1 - queuePenalty)).toFixed(2));
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficIntersection = { createIntersection, updateSignalState, calculateIntersectionEffect };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createIntersection, updateSignalState, calculateIntersectionEffect };
  }
})();
