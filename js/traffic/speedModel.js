(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function calculateAverageSpeed(road) {
    const utilization = Number(road.utilization) || 0;
    const freeFlow = Number(road.freeFlowSpeed) || 45;
    const maxSpeed = Number(road.maxSpeed) || freeFlow;

    let factor = 1;

    if (utilization <= 50) factor = 0.95;
    else if (utilization <= 70) factor = 0.82;
    else if (utilization <= 100) factor = 0.68;
    else if (utilization <= 120) factor = 0.45;
    else factor = 0.18;

    const speed = freeFlow * factor * (1 - Math.min(utilization / 200, 0.35));
    const capped = clamp(speed, 8, maxSpeed);
    return Number(capped.toFixed(1));
  }

  function calculateDelay(road) {
    const freeFlowTravelTime = Number(road.freeFlowTravelTime) || 10;
    const currentTravelTime = Math.max(freeFlowTravelTime, freeFlowTravelTime * (1 + (Number(road.utilization) || 0) / 120));
    const delay = Math.max(0, currentTravelTime - freeFlowTravelTime);
    return Number(delay.toFixed(1));
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficSpeed = { calculateAverageSpeed, calculateDelay };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateAverageSpeed, calculateDelay };
  }
})();
