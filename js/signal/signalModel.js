(function () {
  const PHASES = {
    NORTH_SOUTH_GREEN: 'NORTH_SOUTH_GREEN',
    NORTH_SOUTH_YELLOW: 'NORTH_SOUTH_YELLOW',
    EAST_WEST_GREEN: 'EAST_WEST_GREEN',
    EAST_WEST_YELLOW: 'EAST_WEST_YELLOW',
    ALL_RED: 'ALL_RED'
  };

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function safeDivide(numerator, denominator, fallback = 0) {
    return denominator > 0 ? numerator / denominator : fallback;
  }

  function directionMap() {
    return {
      NORTH: 'NORTH',
      SOUTH: 'SOUTH',
      EAST: 'EAST',
      WEST: 'WEST'
    };
  }

  function getRoadByApproach(intersection, roadLookup, direction) {
    const roadIds = intersection.connectedRoads || [];
    const directionIndex = {
      NORTH: 0,
      SOUTH: 1,
      EAST: 2,
      WEST: 3
    };
    const selectedIndex = directionIndex[direction] ?? 0;
    const roadId = roadIds[selectedIndex] || roadIds[0];
    return roadLookup[roadId] || null;
  }

  function createApproachMetrics(intersection, direction, road, signalMode, currentPhase) {
    const density = clamp(Number(road?.density) || Number(road?.utilization) || 0, 0, 100);
    const vehicleCount = Math.max(0, Math.round((road?.currentVehicles || 0) * 0.32 + (road?.utilization || 0) * 0.8));
    const queueLength = Math.max(0, Math.round((road?.currentVehicles || 0) * 0.18 + (density * 0.42)));
    const utilization = clamp(Number(road?.utilization) || 0, 0, 100);
    const averageSpeed = Math.max(0, Number(road?.averageSpeed) || 0);
    const arrivalRate = Math.max(0, Number(road?.vehiclesEntering) || 0);
    const departureRate = Math.max(0, Number(road?.vehiclesExiting) || 0);
    const redPenalty = currentPhase && !currentPhase.includes(direction === 'NORTH' || direction === 'SOUTH' ? 'NORTH_SOUTH' : 'EAST_WEST') ? 18 : 0;
    const waitingTime = Math.max(0, Math.round(queueLength * 0.9 + redPenalty + safeDivide(arrivalRate, 3, 0)));

    let status = 'LOW';
    if (density >= 75) status = 'HIGH';
    else if (density >= 45) status = 'MEDIUM';

    return {
      direction,
      roadId: road?.id || null,
      roadName: road?.name || direction,
      vehicleCount,
      density: Number(density.toFixed(1)),
      queueLength,
      utilization: Number(utilization.toFixed(1)),
      averageSpeed: Number(averageSpeed.toFixed(1)),
      arrivalRate,
      departureRate,
      waitingTime,
      status,
      signalMode
    };
  }

  function calculateDemandScore(metrics, config) {
    const weights = config.weights || {
      density: 0.36,
      queue: 0.28,
      arrival: 0.22,
      waiting: 0.14
    };

    const densityScore = clamp((metrics.density || 0) / 100, 0, 1) * weights.density;
    const queueScore = clamp((metrics.queueLength || 0) / 140, 0, 1) * weights.queue;
    const arrivalScore = clamp((metrics.arrivalRate || 0) / 90, 0, 1) * weights.arrival;
    const waitingScore = clamp((metrics.waitingTime || 0) / 90, 0, 1) * weights.waiting;

    return Number((densityScore + queueScore + arrivalScore + waitingScore).toFixed(3));
  }

  function calculateOptimalGreenTime(approach, minimumGreen, maximumGreen, cycleLength) {
    const demandScore = clamp(approach.demandScore || 0, 0, 1);
    const greenRange = Math.max(1, maximumGreen - minimumGreen);
    const recommendedGreen = minimumGreen + (demandScore * greenRange);
    const cycleAllowance = Math.max(15, cycleLength * 0.45);
    return clamp(Math.round(recommendedGreen), minimumGreen, Math.min(maximumGreen, cycleAllowance));
  }

  function buildIntersectionState(intersectionConfig, roadLookup, signalConfig) {
    const intersection = {
      id: intersectionConfig.id,
      name: intersectionConfig.name,
      location: intersectionConfig.location || 'City network',
      connectedRoads: intersectionConfig.connectedRoads || [],
      currentPhase: intersectionConfig.currentPhase || 'NORTH_SOUTH_GREEN',
      signalMode: intersectionConfig.signalMode || signalConfig.defaultMode || 'SMART',
      cycleLength: Number(intersectionConfig.cycleLength) || Number(signalConfig.cycleLength) || 120,
      minGreenTime: Number(intersectionConfig.minGreenTime) || Number(signalConfig.minGreenTime) || 15,
      maxGreenTime: Number(intersectionConfig.maxGreenTime) || Number(signalConfig.maxGreenTime) || 60,
      yellowTime: Number(intersectionConfig.yellowTime) || Number(signalConfig.yellowTime) || 5,
      allRedTime: Number(intersectionConfig.allRedTime) || Number(signalConfig.allRedTime) || 2,
      phaseStartTime: Number(intersectionConfig.phaseStartTime) || 0,
      remaining: 30,
      density: 0,
      queueLength: 0,
      averageWait: 0,
      signalEfficiency: 0,
      recommendation: 'Balanced traffic conditions.',
      approaches: {
        NORTH: null,
        SOUTH: null,
        EAST: null,
        WEST: null
      },
      autoOptimize: Boolean(intersectionConfig.autoOptimize !== false),
      eventLog: []
    };

    const directions = directionMap();
    Object.keys(directions).forEach((direction) => {
      const road = getRoadByApproach(intersection, roadLookup, direction);
      intersection.approaches[direction] = createApproachMetrics(intersection, direction, road, intersection.signalMode, intersection.currentPhase);
    });

    const allApproaches = Object.values(intersection.approaches).filter(Boolean);
    intersection.density = Number((allApproaches.reduce((sum, approach) => sum + (approach.density || 0), 0) / Math.max(1, allApproaches.length)).toFixed(1));
    intersection.queueLength = allApproaches.reduce((sum, approach) => sum + (approach.queueLength || 0), 0);
    intersection.averageWait = Math.round(allApproaches.reduce((sum, approach) => sum + (approach.waitingTime || 0), 0) / Math.max(1, allApproaches.length));
    intersection.remaining = Math.max(1, Math.round(intersection.cycleLength * 0.25));
    intersection.recommendation = 'North-South demand is slightly elevated. Continue balanced access.';
    return intersection;
  }

  function evaluateIntersection(intersection, roadLookup, signalConfig) {
    const updated = JSON.parse(JSON.stringify(intersection));
    const directions = directionMap();
    const phaseConfig = signalConfig.smartMode || signalConfig.fixedMode || {};

    Object.keys(directions).forEach((direction) => {
      const road = getRoadByApproach(updated, roadLookup, direction);
      const metrics = createApproachMetrics(updated, direction, road, updated.signalMode, updated.currentPhase);
      metrics.demandScore = calculateDemandScore(metrics, signalConfig);
      updated.approaches[direction] = metrics;
    });

    const approaches = Object.values(updated.approaches).filter(Boolean);
    const nsDemand = (updated.approaches.NORTH.demandScore + updated.approaches.SOUTH.demandScore) / 2;
    const ewDemand = (updated.approaches.EAST.demandScore + updated.approaches.WEST.demandScore) / 2;
    const currentDemandDiff = nsDemand - ewDemand;

    updated.density = Number((approaches.reduce((sum, approach) => sum + (approach.density || 0), 0) / Math.max(1, approaches.length)).toFixed(1));
    updated.queueLength = approaches.reduce((sum, approach) => sum + (approach.queueLength || 0), 0);
    updated.averageWait = Math.round(approaches.reduce((sum, approach) => sum + (approach.waitingTime || 0), 0) / Math.max(1, approaches.length));

    if (updated.signalMode === 'SMART') {
      const preferredPhase = currentDemandDiff >= 0.04 ? 'NORTH_SOUTH_GREEN' : 'EAST_WEST_GREEN';
      updated.currentPhase = preferredPhase;
      const northSouthGreen = calculateOptimalGreenTime({
        density: updated.approaches.NORTH.density + updated.approaches.SOUTH.density,
        queueLength: updated.approaches.NORTH.queueLength + updated.approaches.SOUTH.queueLength,
        arrivalRate: updated.approaches.NORTH.arrivalRate + updated.approaches.SOUTH.arrivalRate,
        waitingTime: updated.approaches.NORTH.waitingTime + updated.approaches.SOUTH.waitingTime,
        demandScore: nsDemand
      }, updated.minGreenTime, updated.maxGreenTime, updated.cycleLength);

      const eastWestGreen = calculateOptimalGreenTime({
        density: updated.approaches.EAST.density + updated.approaches.WEST.density,
        queueLength: updated.approaches.EAST.queueLength + updated.approaches.WEST.queueLength,
        arrivalRate: updated.approaches.EAST.arrivalRate + updated.approaches.WEST.arrivalRate,
        waitingTime: updated.approaches.EAST.waitingTime + updated.approaches.WEST.waitingTime,
        demandScore: ewDemand
      }, updated.minGreenTime, updated.maxGreenTime, updated.cycleLength);

      updated.northSouthGreen = northSouthGreen;
      updated.eastWestGreen = eastWestGreen;
      updated.recommendation = currentDemandDiff >= 0.04
        ? `North-South traffic demand is significantly higher than East-West demand. Recommended North-South Green: ${northSouthGreen} sec.`
        : `East-West demand is elevated. Recommended East-West Green: ${eastWestGreen} sec.`;
      updated.remaining = Math.max(1, Math.round(Math.min(updated.northSouthGreen, updated.eastWestGreen)));
    } else {
      updated.northSouthGreen = signalConfig.fixedMode?.northSouthGreen || 30;
      updated.eastWestGreen = signalConfig.fixedMode?.eastWestGreen || 30;
      updated.remaining = Math.max(1, signalConfig.fixedMode?.northSouthGreen || 30);
      updated.recommendation = 'Fixed mode keeps the original timing plan for the active signal cycle.';
    }

    const usefulGreen = (updated.currentPhase.includes('NORTH_SOUTH') ? updated.northSouthGreen : updated.eastWestGreen);
    const availableGreen = Math.max(1, updated.currentPhase.includes('NORTH_SOUTH') ? updated.northSouthGreen + updated.yellowTime : updated.eastWestGreen + updated.yellowTime);
    updated.signalEfficiency = Number(((usefulGreen / availableGreen) * 100).toFixed(1));

    return updated;
  }

  if (typeof window !== 'undefined') {
    window.FlowXSignalModel = {
      PHASES,
      clamp,
      calculateDemandScore,
      calculateOptimalGreenTime,
      buildIntersectionState,
      evaluateIntersection,
      createApproachMetrics
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PHASES,
      clamp,
      calculateDemandScore,
      calculateOptimalGreenTime,
      buildIntersectionState,
      evaluateIntersection,
      createApproachMetrics
    };
  }
})();
