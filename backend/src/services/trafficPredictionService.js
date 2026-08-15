const { buildGraph, getRoadState } = require('./routeNetworkService');
const trafficHistory = require('./trafficHistoryService');
const prisma = require('../config/database');
const { broadcastIncidentEvent } = require('../utils/realtime');
const { broadcastPrediction } = require('../utils/predictionRealtime');

// In-memory cache
let predictionCache = { network: {}, byRoad: {}, lastUpdated: null };

// Demo mode state
let demoOverrides = {}; // { roadId: [timeSeries] }

function clamp(v,min=0,max=220){return Math.max(min,Math.min(max,v));}

async function computePredictions() {
  const { graph, roadsById } = await buildGraph();
  const roads = await getRoadState();

  const predictions = {};
  for (const road of roads) {
    try {
      const roadId = road.id;
      const current = Number(road.utilization || 0);
      const recent = await trafficHistory.getRecentObservations(roadId, 60); // last 60 min
      const trend = recent.length >= 2 ? (recent[recent.length-1].trafficLevel - recent[0].trafficLevel) / Math.max(1,recent.length-1) : 0;
      const historical = await trafficHistory.getHistoricalPattern(roadId, 15, 21);
      const incidentEffect = (road.incident && road.incident !== 'null') ? (road.incident === 'accident' ? 15 : 8) : 0;

      // base predicted increase from trend
      function predictFor(mins) {
        // simplistic linear extrapolation plus historical adjustment
        const trendFactor = trend * (mins/15);
        const historyAdj = historical != null ? (historical - current) * 0.5 : 0;
        const incidentAdj = incidentEffect * (mins <= 60 ? 1 - (mins/60)*0.2 : 1);
        let pred = current + trendFactor + historyAdj + incidentAdj;
        // demo override
        if (demoOverrides[roadId] && demoOverrides[roadId][mins]) pred = demoOverrides[roadId][mins];
        pred = clamp(Math.round(pred));
        // confidence: based on history samples and trend presence
        let confidence = 50;
        if (recent.length >= 6) confidence += 20;
        if (historical != null) confidence += 15;
        if (Math.abs(trend) > 1) confidence -= 5;
        if (incidentAdj) confidence -= 5;
        confidence = Math.max(20, Math.min(95, confidence));

        const risk = pred >= 85 ? 'CRITICAL' : pred >= 65 ? 'HIGH' : pred >= 40 ? 'MODERATE' : 'LOW';
        return { predictedTrafficLevel: pred, predictedCongestion: pred, predictedSpeed: Math.max(5, (road.averageSpeed || 30) * (100 - pred) / 100), confidence, risk, factors: { current, trend: Number(trend.toFixed(2)), historical: historical || null, incidentEffect } };
      }

      predictions[road.id] = {
        '+15': predictFor(15),
        '+30': predictFor(30),
        '+60': predictFor(60)
      };
    } catch (e) { /* ignore per-road errors */ }
  }

  predictionCache = { network: predictions, byRoad: predictions, lastUpdated: new Date() };
  return predictionCache;
}

function getCachedPrediction(roadId=null) {
  if (!predictionCache.lastUpdated) return null;
  if (roadId) return predictionCache.byRoad[roadId] || null;
  return predictionCache.network || null;
}

async function startPeriodicComputation(intervalMs = 60000) {
  await computePredictions();
  setInterval(async () => {
    const old = predictionCache;
    const updated = await computePredictions();
    // compare and broadcast significant changes
    try {
      for (const roadId of Object.keys(updated.byRoad)) {
        const oldPred = old.byRoad && old.byRoad[roadId];
        const newPred = updated.byRoad[roadId];
        if (!oldPred) continue;
        const oldVal = oldPred['+60']?.predictedTrafficLevel || 0;
        const newVal = newPred['+60']?.predictedTrafficLevel || 0;
        if (Math.abs(newVal - oldVal) >= 8) {
          // broadcast a prediction update for this road
          broadcastPrediction(roadId, newPred);
        }
      }
    } catch (e) { /* ignore */ }
  }, intervalMs);
}

function setDemoOverride(roadId, series) {
  demoOverrides[roadId] = series;
}

module.exports = { computePredictions, getCachedPrediction, startPeriodicComputation, setDemoOverride };

function getStatus() {
  return { lastUpdated: predictionCache.lastUpdated, roadCount: Object.keys(predictionCache.byRoad || {}).length };
}

module.exports = { computePredictions, getCachedPrediction, startPeriodicComputation, setDemoOverride, getStatus };
