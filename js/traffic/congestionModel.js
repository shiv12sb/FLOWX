(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function calculateUtilization(currentVehicles, capacity) {
    const safeCapacity = Math.max(1, Number(capacity) || 1);
    return clamp((Number(currentVehicles) / safeCapacity) * 100, 0, 220);
  }

  function calculateDensity(currentVehicles, length, lanes) {
    const safeLength = Math.max(0.5, Number(length) || 1);
    const safeLanes = Math.max(1, Number(lanes) || 1);
    return clamp((Number(currentVehicles) / (safeLength * safeLanes)), 0, 200);
  }

  function getCongestionLevel(utilization) {
    const config = window.FlowXTrafficConfig?.congestionMap || [];
    const match = config.find((entry) => utilization >= entry.min && utilization < entry.max) || config[config.length - 1];
    return match ? match.name : 'FREE_FLOW';
  }

  function getStatusMeta(utilization) {
    const config = window.FlowXTrafficConfig?.congestionMap || [];
    const match = config.find((entry) => utilization >= entry.min && utilization < entry.max) || config[config.length - 1];
    return match || { name: 'FREE_FLOW', color: 'green', label: 'AVAILABLE' };
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficCongestion = { calculateUtilization, calculateDensity, getCongestionLevel, getStatusMeta };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateUtilization, calculateDensity, getCongestionLevel, getStatusMeta };
  }
})();
