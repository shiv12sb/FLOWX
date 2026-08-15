(function () {
  const signalConfig = {
    label: 'SIMULATED SIGNAL CONTROL',
    defaultMode: 'SMART',
    cycleLength: 120,
    yellowTime: 5,
    allRedTime: 2,
    minGreenTime: 15,
    maxGreenTime: 60,
    fixedMode: {
      northSouthGreen: 30,
      northSouthYellow: 5,
      eastWestGreen: 30,
      eastWestYellow: 5,
      allRed: 2
    },
    smartMode: {
      minGreen: 15,
      maxGreen: 60,
      yellow: 5,
      allRed: 2
    },
    weights: {
      density: 0.36,
      queue: 0.28,
      arrival: 0.22,
      waiting: 0.14
    },
    intersections: [
      {
        id: 'junction-central',
        name: 'Central Square',
        location: 'Nagpur Central',
        connectedRoads: ['wardha-road', 'central-avenue', 'sadar-nagpur', 'ring-road'],
        currentPhase: 'NORTH_SOUTH_GREEN',
        phaseStartTime: 0,
        signalMode: 'SMART',
        cycleLength: 120,
        minGreenTime: 15,
        maxGreenTime: 60,
        yellowTime: 5,
        allRedTime: 2,
        autoOptimize: true
      },
      {
        id: 'junction-ring',
        name: 'Ring Junction',
        location: 'Nagpur West',
        connectedRoads: ['ring-road', 'airport-corridor', 'sadar-nagpur', 'wardha-road'],
        currentPhase: 'EAST_WEST_GREEN',
        phaseStartTime: 18,
        signalMode: 'SMART',
        cycleLength: 120,
        minGreenTime: 15,
        maxGreenTime: 60,
        yellowTime: 5,
        allRedTime: 2,
        autoOptimize: true
      },
      {
        id: 'junction-market',
        name: 'Cotton Market',
        location: 'Commercial Core',
        connectedRoads: ['cotton-market', 'sadar-nagpur', 'central-avenue', 'wardha-road'],
        currentPhase: 'NORTH_SOUTH_GREEN',
        phaseStartTime: 8,
        signalMode: 'SMART',
        cycleLength: 120,
        minGreenTime: 15,
        maxGreenTime: 60,
        yellowTime: 5,
        allRedTime: 2,
        autoOptimize: true
      }
    ]
  };

  if (typeof window !== 'undefined') {
    window.FlowXSignalConfig = signalConfig;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = signalConfig;
  }
})();
