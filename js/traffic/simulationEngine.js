(function () {
  const BASE_ROADS = [
    { id: 'ring-road', name: 'Ring Road', roadType: 'highway', length: 4.5, lanes: 4, capacityPerMinute: 240, maxSpeed: 60, freeFlowSpeed: 60, currentVehicles: 640, upstreamRoads: ['airport-corridor'], downstreamRoads: ['sadar-nagpur'], intersectionId: 'junction-ring', authority: 'Nagpur West' },
    { id: 'wardha-road', name: 'Wardha Road', roadType: 'arterial', length: 3.7, lanes: 4, capacityPerMinute: 220, maxSpeed: 48, freeFlowSpeed: 50, currentVehicles: 760, upstreamRoads: ['ring-road'], downstreamRoads: ['sadar-nagpur'], intersectionId: 'junction-central', authority: 'Nagpur Central' },
    { id: 'central-avenue', name: 'Central Avenue', roadType: 'arterial', length: 3.4, lanes: 3, capacityPerMinute: 190, maxSpeed: 42, freeFlowSpeed: 45, currentVehicles: 420, upstreamRoads: ['ring-road'], downstreamRoads: ['sadar-nagpur'], intersectionId: 'junction-central', authority: 'Nagpur Central' },
    { id: 'sadar-nagpur', name: 'Sadar Nagpur', roadType: 'arterial', length: 4.2, lanes: 4, capacityPerMinute: 230, maxSpeed: 46, freeFlowSpeed: 48, currentVehicles: 520, upstreamRoads: ['ring-road', 'wardha-road', 'central-avenue'], downstreamRoads: ['cotton-market'], intersectionId: 'junction-central', authority: 'Nagpur Urban' },
    { id: 'cotton-market', name: 'Cotton Market', roadType: 'local', length: 2.8, lanes: 2, capacityPerMinute: 150, maxSpeed: 32, freeFlowSpeed: 35, currentVehicles: 610, upstreamRoads: ['sadar-nagpur'], downstreamRoads: [], intersectionId: 'junction-market', authority: 'Nagpur Market' },
    { id: 'airport-corridor', name: 'Airport Corridor', roadType: 'highway', length: 5.2, lanes: 4, capacityPerMinute: 260, maxSpeed: 65, freeFlowSpeed: 65, currentVehicles: 360, upstreamRoads: [], downstreamRoads: ['ring-road'], intersectionId: 'junction-ring', authority: 'Nagpur Airport' }
  ];

  function normalizeRoad(road) {
    const model = window.FlowXTrafficRoadModel?.createRoad || ((input) => input);
    return model(road);
  }

  const simulationEngine = {
    tickCount: 0,
    simulationTimeMinutes: 8 * 60,
    speedMultiplier: 1,
    isRunning: true,
    roads: [],
    roadsById: {},
    intersections: [],
    incidents: [],
    listeners: [],
    lastPublishedState: null,

    init() {
      this.roads = BASE_ROADS.map(normalizeRoad);
      this.roads.forEach((road) => { this.roadsById[road.id] = road; });
      this.intersections = (window.FlowXTrafficConfig?.defaultIntersections || []).map((intersection) => window.FlowXTrafficIntersection?.createIntersection(intersection));
      this.recalculateRoadMetrics();
      this.publishState();
      return this.getState();
    },

    subscribe(listener) {
      if (typeof listener === 'function') {
        this.listeners.push(listener);
      }
    },

    notify() {
      const state = this.getState();
      this.listeners.forEach((listener) => listener(state));
      this.lastPublishedState = state;
    },

    setSpeed(multiplier) {
      this.speedMultiplier = Number(multiplier) || 1;
      return this.speedMultiplier;
    },

    setWeatherScenario(scenarioId) {
      if (window.FlowXWeatherEngine && typeof window.FlowXWeatherEngine.applyToSimulation === 'function') {
        const scenarioState = window.FlowXWeatherEngine.applyToSimulation(this, scenarioId);
        this.weatherState = scenarioState;
      }
      return this.weatherState || null;
    },

    start() {
      this.isRunning = true;
    },

    pause() {
      this.isRunning = false;
    },

    reset() {
      this.tickCount = 0;
      this.simulationTimeMinutes = 8 * 60;
      this.roads = BASE_ROADS.map(normalizeRoad);
      this.roads.forEach((road) => { this.roadsById[road.id] = road; });
      this.intersections = (window.FlowXTrafficConfig?.defaultIntersections || []).map((intersection) => window.FlowXTrafficIntersection?.createIntersection(intersection));
      this.incidents = [];
      this.recalculateRoadMetrics();
      this.publishState();
    },

    addIncident(roadId, type) {
      const road = this.roadsById[roadId];
      if (!road) return false;
      road.incident = type;
      this.incidents = [...new Set(this.incidents.concat(`${roadId}:${type}`))];
      this.recalculateRoadMetrics();
      this.publishState();
      return true;
    },

    clearIncident(roadId) {
      const road = this.roadsById[roadId];
      if (!road) return false;
      road.incident = null;
      this.incidents = this.incidents.filter((entry) => !entry.startsWith(`${roadId}:`));
      this.recalculateRoadMetrics();
      this.publishState();
      return true;
    },

    clearAllIncidents() {
      this.roads.forEach((road) => { road.incident = null; });
      this.incidents = [];
      this.recalculateRoadMetrics();
      this.publishState();
    },

    getSimulationClock() {
      const totalMinutes = this.simulationTimeMinutes;
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      const timeText = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return { hour, minute, totalMinutes, timeText };
    },

    updateIntersections() {
      this.intersections = this.intersections.map((intersection) => {
        const updated = JSON.parse(JSON.stringify(intersection));
        return window.FlowXTrafficIntersection.updateSignalState(updated, this.simulationTimeMinutes / 10);
      });

      this.intersections.forEach((intersection) => {
        const multiplier = window.FlowXTrafficIntersection.calculateIntersectionEffect(intersection, this.roadsById);
        this.intersections.forEach((item) => { item.effectMultiplier = multiplier; });
      });
    },

    recalculateRoadMetrics() {
      const weatherEngine = window.FlowXWeatherEngine;
      const weatherScenario = weatherEngine && typeof weatherEngine.getCurrentScenario === 'function'
        ? weatherEngine.getCurrentScenario()
        : null;

      this.roads.forEach((road) => {
        const weatherImpact = weatherScenario ? weatherEngine.calculateRoadImpact(road, weatherScenario) : null;
        const baseCapacity = Math.max(1, road.capacityPerMinute * (road.incident ? (1 - (window.FlowXTrafficConfig?.incidentEffects?.[road.incident] || 0.2)) : 1));
        const weatherAdjustedCapacity = weatherImpact ? Math.max(1, weatherImpact.effectiveCapacity) : baseCapacity;
        const capacity = Math.max(1, weatherAdjustedCapacity);

        road.weatherScenario = weatherImpact ? weatherImpact.scenarioLabel : 'CLEAR';
        road.weatherImpactScore = weatherImpact ? Number(weatherImpact.impactScore) : 0;
        road.weatherVisibility = weatherImpact ? Number(weatherImpact.visibility) : 100;
        road.weatherAdjustedSpeed = weatherImpact ? Number(weatherImpact.effectiveSpeed) : Number((road.averageSpeed || road.freeFlowSpeed || 45).toFixed(1));
        road.weatherAdjustedCapacity = Number(weatherAdjustedCapacity.toFixed(0));

        road.utilization = window.FlowXTrafficCongestion.calculateUtilization(road.currentVehicles, capacity);
        road.density = window.FlowXTrafficCongestion.calculateDensity(road.currentVehicles, road.length, road.lanes);
        const statusInfo = window.FlowXTrafficCongestion.getStatusMeta(road.utilization);
        road.congestionLevel = statusInfo.name;
        road.status = statusInfo.color === 'green' ? 'GREEN' : statusInfo.color === 'orange' ? 'ORANGE' : 'RED';
        road.averageSpeed = window.FlowXTrafficSpeed.calculateAverageSpeed(road);
        road.delay = window.FlowXTrafficSpeed.calculateDelay(road);
      });

      const summary = weatherEngine && typeof weatherEngine.getNetworkSummary === 'function'
        ? weatherEngine.getNetworkSummary(this.roads, weatherScenario)
        : null;
      this.weatherState = summary ? { currentScenario: weatherScenario, summary } : this.weatherState || { currentScenario: weatherScenario };
    },

    applyTrafficFlow() {
      const roadsById = this.roadsById;
      this.roads.forEach((road) => {
        const { inflow, outflow } = window.FlowXTrafficFlow.computeFlow(road, this, roadsById);
        road.vehiclesEntering = inflow;
        road.vehiclesExiting = outflow;

        const futureCount = road.currentVehicles + inflow - outflow;
        road.currentVehicles = clamp(futureCount, 0, road.maxVehicles || Math.round(road.capacityPerMinute * 1.45));
      });

      this.propagateCongestion();
      this.recalculateRoadMetrics();
    },

    propagateCongestion() {
      const roadsById = this.roadsById;
      this.roads.forEach((road) => {
        const upstreamPressure = (road.upstreamRoads || []).reduce((sum, id) => sum + (roadsById[id]?.utilization || 0), 0);
        const downstreamPenalty = (road.downstreamRoads || []).reduce((sum, id) => sum + (roadsById[id]?.utilization || 0), 0);
        const adjustment = ((upstreamPressure / 100) - (downstreamPenalty / 120)) * 0.08;
        const adjusted = Number((road.currentVehicles + adjustment * road.capacityPerMinute).toFixed(0));
        road.currentVehicles = Math.max(0, Math.min(adjusted, road.maxVehicles || road.capacityPerMinute * 1.45));
      });
    },

    tick() {
      if (!this.isRunning) return this.getState();

      this.tickCount += 1;
      this.simulationTimeMinutes += 5 * this.speedMultiplier;
      this.updateIntersections();
      this.applyTrafficFlow();
      this.publishState();
      return this.getState();
    },

    getState() {
      const totalVehicles = this.roads.reduce((sum, road) => sum + road.currentVehicles, 0);
      const congestedRoads = this.roads.filter((road) => road.status !== 'GREEN').length;
      const averageNetworkSpeed = this.roads.reduce((sum, road) => sum + road.averageSpeed, 0) / Math.max(1, this.roads.length);
      const networkUtilization = this.roads.reduce((sum, road) => sum + road.utilization, 0) / Math.max(1, this.roads.length);

      return {
        tickCount: this.tickCount,
        isRunning: this.isRunning,
        speedMultiplier: this.speedMultiplier,
        clock: this.getSimulationClock(),
        totalVehicles,
        congestedRoads,
        averageNetworkSpeed: Number(averageNetworkSpeed.toFixed(1)),
        networkUtilization: Number(networkUtilization.toFixed(1)),
        roads: this.roads.map((road) => ({ ...road })),
        intersections: this.intersections.map((intersection) => ({ ...intersection })),
        incidents: [...this.incidents],
        weatherState: this.weatherState || null
      };
    },

    publishState() {
      this.notify();
    }
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  if (typeof window !== 'undefined') {
    window.FlowXTrafficEngine = simulationEngine;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = simulationEngine;
  }
})();
