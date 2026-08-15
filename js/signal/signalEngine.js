(function () {
  const signalConfig = window.FlowXSignalConfig || require('./signalConfig');

  function buildRoadLookup() {
    const engine = window.FlowXTrafficEngine;
    if (!engine || !engine.roads) return {};
    return engine.roads.reduce((lookup, road) => {
      lookup[road.id] = road;
      return lookup;
    }, {});
  }

  function logEvent(entry, message) {
    const stamp = new Date();
    const time = stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    entry.eventLog.unshift({ time, message });
    entry.eventLog = entry.eventLog.slice(0, 8);
  }

  function buildIntersectionSignals() {
    const roadLookup = buildRoadLookup();
    const signalModel = window.FlowXSignalModel;
    return (signalConfig.intersections || []).map((intersection) => {
      const built = signalModel.buildIntersectionState(intersection, roadLookup, signalConfig);
      return signalModel.evaluateIntersection(built, roadLookup, signalConfig);
    });
  }

  function computeSummary(intersections) {
    if (!intersections.length) {
      return {
        optimizedIntersections: 0,
        highDensityJunctions: 0,
        averageWaitReduction: 0,
        signalEfficiency: 0,
        mode: 'SMART'
      };
    }

    const optimizedIntersections = intersections.filter((item) => item.signalMode === 'SMART').length;
    const highDensityJunctions = intersections.filter((item) => item.density >= 70).length;
    const avgWait = intersections.reduce((sum, item) => sum + (item.averageWait || 0), 0) / intersections.length;
    const signalEfficiency = intersections.reduce((sum, item) => sum + (item.signalEfficiency || 0), 0) / intersections.length;

    return {
      optimizedIntersections,
      highDensityJunctions,
      averageWaitReduction: Number(Math.max(0, 100 - (avgWait / 2.3)).toFixed(1)),
      signalEfficiency: Number(signalEfficiency.toFixed(1)),
      mode: 'SMART'
    };
  }

  const signalEngine = {
    intersections: [],
    mode: 'SMART',
    autoOptimize: true,
    eventLog: [],
    summary: { optimizedIntersections: 0, highDensityJunctions: 0, averageWaitReduction: 0, signalEfficiency: 0 },

    init() {
      this.intersections = buildIntersectionSignals();
      this.summary = computeSummary(this.intersections);
      this.eventLog = [{ time: '00:00:00', message: 'Signal system initialized in SMART MODE' }];
      return this.getState();
    },

    refresh() {
      const trafficState = window.FlowXTrafficEngine?.getState?.();
      if (!trafficState) return this.getState();

      const roadLookup = buildRoadLookup();
      const signalModel = window.FlowXSignalModel;
      const weatherScenario = window.FlowXWeatherEngine && typeof window.FlowXWeatherEngine.getCurrentScenario === 'function'
        ? window.FlowXWeatherEngine.getCurrentScenario()
        : null;

      this.intersections = this.intersections.length
        ? this.intersections.map((intersection) => {
            const rebuilt = signalModel.evaluateIntersection(intersection, roadLookup, signalConfig);
            rebuilt.signalMode = this.mode;
            if (weatherScenario) {
              const weatherLift = (weatherScenario.impactScore || 0) / 100;
              rebuilt.averageWait = Number(((rebuilt.averageWait || 0) * (1 + weatherLift * 0.65)).toFixed(1));
              rebuilt.signalEfficiency = Number(Math.max(0, (rebuilt.signalEfficiency || 0) * (1 - weatherLift * 0.25)).toFixed(1));
            }
            return rebuilt;
          })
        : buildIntersectionSignals();

      this.summary = computeSummary(this.intersections);
      this.intersections.forEach((intersection) => {
        if (this.autoOptimize && intersection.signalMode === 'SMART') {
          const nsDemand = (intersection.approaches.NORTH.demandScore + intersection.approaches.SOUTH.demandScore) / 2;
          const ewDemand = (intersection.approaches.EAST.demandScore + intersection.approaches.WEST.demandScore) / 2;
          const weatherText = weatherScenario ? ` Weather effect: ${weatherScenario.label}.` : '';
          intersection.recommendation = nsDemand > ewDemand
            ? `North-South traffic demand is significantly higher than East-West demand. Recommended North-South Green: ${intersection.northSouthGreen || 32} sec.${weatherText}`
            : `East-West demand is elevated. Recommended East-West Green: ${intersection.eastWestGreen || 32} sec.${weatherText}`;
        }
      });

      return this.getState();
    },

    setMode(mode) {
      this.mode = mode === 'SMART' ? 'SMART' : 'FIXED';
      this.intersections = this.intersections.map((intersection) => {
        intersection.signalMode = this.mode;
        if (this.mode === 'FIXED') {
          intersection.currentPhase = 'NORTH_SOUTH_GREEN';
          intersection.northSouthGreen = signalConfig.fixedMode.northSouthGreen;
          intersection.eastWestGreen = signalConfig.fixedMode.eastWestGreen;
        }
        return intersection;
      });
      logEvent(this, `Signal mode switched to ${this.mode}`);
      return this.getState();
    },

    toggleAutoOptimize() {
      this.autoOptimize = !this.autoOptimize;
      logEvent(this, this.autoOptimize ? 'AUTO OPTIMIZE enabled' : 'AUTO OPTIMIZE disabled');
      return this.getState();
    },

    applySmartSignal() {
      this.mode = 'SMART';
      this.intersections = this.intersections.map((intersection) => ({
        ...intersection,
        signalMode: 'SMART'
      }));
      logEvent(this, '✓ SMART SIGNAL SIMULATION ACTIVE');
      return this.getState();
    },

    resetSignalSimulation() {
      this.mode = 'FIXED';
      this.intersections = buildIntersectionSignals().map((intersection) => ({
        ...intersection,
        signalMode: 'FIXED'
      }));
      this.summary = computeSummary(this.intersections);
      logEvent(this, 'Signal simulation reset to fixed baseline');
      return this.getState();
    },

    beforeAfterComparison() {
      const trafficState = window.FlowXTrafficEngine?.getState?.();
      const roads = trafficState?.roads || [];
      const currentWait = roads.reduce((sum, road) => sum + ((road.averageSpeed || 0) > 0 ? (100 - road.averageSpeed) * 0.8 : 0), 0) / Math.max(1, roads.length);
      const fixedWait = Math.max(20, currentWait + 26);
      const smartWait = Math.max(12, currentWait + 14);
      const allMetrics = roads.map((road) => ({
        baselineQueue: Math.max(10, Math.round((road.currentVehicles || 0) * 0.32)),
        optimizedQueue: Math.max(6, Math.round((road.currentVehicles || 0) * 0.18)),
        baselineSpeed: Number((road.averageSpeed || 0).toFixed(1)),
        optimizedSpeed: Number(Math.min(60, (road.averageSpeed || 0) + 9).toFixed(1)),
        throughput: Math.max(0, Number((road.vehiclesExiting || 0) * 0.9))
      }));

      const baselineQueue = allMetrics.reduce((sum, value) => sum + value.baselineQueue, 0) / Math.max(1, allMetrics.length);
      const optimizedQueue = allMetrics.reduce((sum, value) => sum + value.optimizedQueue, 0) / Math.max(1, allMetrics.length);
      const baselineSpeed = allMetrics.reduce((sum, value) => sum + value.baselineSpeed, 0) / Math.max(1, allMetrics.length);
      const optimizedSpeed = allMetrics.reduce((sum, value) => sum + value.optimizedSpeed, 0) / Math.max(1, allMetrics.length);
      const throughput = allMetrics.reduce((sum, value) => sum + value.throughput, 0) / Math.max(1, allMetrics.length);

      return {
        fixed: {
          waiting: Number(fixedWait.toFixed(1)),
          queue: Number(baselineQueue.toFixed(1)),
          speed: Number(baselineSpeed.toFixed(1)),
          throughput: Number(throughput.toFixed(1)),
          congestion: 64
        },
        smart: {
          waiting: Number(smartWait.toFixed(1)),
          queue: Number(optimizedQueue.toFixed(1)),
          speed: Number(optimizedSpeed.toFixed(1)),
          throughput: Number((throughput * 1.14).toFixed(1)),
          congestion: 39
        }
      };
    },

    getState() {
      return {
        intersections: this.intersections,
        mode: this.mode,
        autoOptimize: this.autoOptimize,
        eventLog: this.eventLog,
        summary: this.summary,
        comparison: this.beforeAfterComparison()
      };
    }
  };

  if (typeof window !== 'undefined') {
    window.FlowXSignalEngine = signalEngine;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = signalEngine;
  }
})();
