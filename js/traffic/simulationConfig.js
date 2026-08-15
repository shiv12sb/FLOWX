(function () {
  const simulationConfig = {
    label: 'SIMULATED TRAFFIC MODE',
    tickMs: 2200,
    defaultSpeed: 1,
    speedOptions: [1, 2, 5, 10],
    timeProfiles: {
      night: { start: 0, end: 6, multiplier: 0.34 },
      normal: { start: 6, end: 7, multiplier: 0.56 },
      morning: { start: 7, end: 10, multiplier: 1.02 },
      midday: { start: 10, end: 16, multiplier: 0.7 },
      evening: { start: 16, end: 21, multiplier: 1.17 },
      lateEvening: { start: 21, end: 24, multiplier: 0.48 }
    },
    roadTypeConfig: {
      highway: { capacityPerLane: 62, freeFlowFactor: 1, demandFactor: 1.18 },
      arterial: { capacityPerLane: 48, freeFlowFactor: 0.92, demandFactor: 1.04 },
      local: { capacityPerLane: 31, freeFlowFactor: 0.78, demandFactor: 0.86 }
    },
    congestionMap: [
      { name: 'FREE_FLOW', min: 0, max: 35, color: 'green', label: 'AVAILABLE' },
      { name: 'MODERATE', min: 35, max: 60, color: 'orange', label: 'HIGH TRAFFIC' },
      { name: 'HIGH', min: 60, max: 80, color: 'orange', label: 'HIGH TRAFFIC' },
      { name: 'SEVERE', min: 80, max: 110, color: 'red', label: 'OVER CAPACITY' },
      { name: 'GRIDLOCK', min: 110, max: 999, color: 'red', label: 'GRIDLOCK' }
    ],
    signalCycle: {
      green: 40,
      yellow: 5,
      red: 45
    },
    incidentEffects: {
      accident: 0.3,
      laneClosure: 0.42,
      roadWork: 0.24
    },
    colorMap: {
      green: '#22c55e',
      orange: '#f97316',
      red: '#ef4444'
    },
    constants: {
      minSpeed: 5,
      maxDelay: 120,
      minCapacity: 120,
      maxVehicleCapFactor: 1.45
    },
    defaultIntersections: [
      { id: 'junction-central', name: 'Central Junction', connectedRoads: ['wardha-road', 'central-avenue', 'sadar-nagpur'], capacity: 40, processingRate: 28, queue: 0, signalState: 'GREEN' },
      { id: 'junction-ring', name: 'Ring Junction', connectedRoads: ['ring-road', 'airport-corridor'], capacity: 30, processingRate: 24, queue: 0, signalState: 'YELLOW' },
      { id: 'junction-market', name: 'Cotton Market', connectedRoads: ['cotton-market', 'sadar-nagpur'], capacity: 36, processingRate: 26, queue: 0, signalState: 'RED' }
    ]
  };

  if (typeof window !== 'undefined') {
    window.FlowXTrafficConfig = simulationConfig;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = simulationConfig;
  }
})();
