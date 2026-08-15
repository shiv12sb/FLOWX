const express = require('express');
const router = express.Router();
const decisionService = require('../services/decisionIntelligenceService');
const routeNetwork = require('../services/routeNetworkService');
const alertService = require('../services/alertService');
const predictionService = require('../services/trafficPredictionService');
const { PrismaClient } = require('../config/database');

router.get('/overview', async (req, res, next) => {
  try {
    const data = await decisionService.overview();
    const recs = await decisionService.generateRecommendations();
    res.json({ success: true, data: { overview: data, recommendations: recs } });
  } catch (e) { next(e); }
});

router.get('/health', async (req, res) => {
  const prisma = require('../config/database');
  const prediction = require('../services/trafficPredictionService');
  try {
    await prisma.$queryRaw`SELECT 1`;
    const predStatus = prediction.getStatus ? prediction.getStatus() : null;
    const wss = require('../utils/realtime');
    // cannot inspect websocket count directly; report available keys
    res.json({ success: true, backend: 'online', database: 'connected', prediction: predStatus, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ success: false, backend: 'degraded', database: 'disconnected', message: e.message });
  }
});

router.get('/risk', async (req, res, next) => {
  try {
    const r = await decisionService.getRiskScore();
    res.json({ success: true, data: r });
  } catch (e) { next(e); }
});

// Geo overlays: traffic polylines and prediction points (lightweight)
router.get('/geo/traffic', async (req, res, next) => {
  try {
    const roads = await routeNetwork.getRoadState();
    // static coords map (matches frontend demo coords)
    const coordsMap = {
      'ring-road': [[21.1752,79.0587],[21.1678,79.0811],[21.1606,79.0915],[21.1504,79.0902],[21.1431,79.0824]],
      'wardha-road': [[21.1479,79.0718],[21.1452,79.0874],[21.1396,79.1062]],
      'central-avenue': [[21.1546,79.0919],[21.1462,79.0967],[21.1389,79.1045],[21.1275,79.1119]],
      'sadar-nagpur': [[21.1339,79.0718],[21.1387,79.0845],[21.1413,79.1004],[21.1468,79.1162]],
      'cotton-market': [[21.1609,79.1091],[21.1538,79.1064],[21.1475,79.1013],[21.1419,79.0986]],
      'airport-corridor': [[21.1124,79.0469],[21.1221,79.0537],[21.1294,79.0621],[21.1396,79.0703]]
    };

    const features = roads.map(r=>({ type:'Feature', properties:{ id:r.id, name:r.name, utilization:r.utilization, delay:r.delay, incident:r.incident }, geometry:{ type:'LineString', coordinates: (coordsMap[r.id]||[]).map(c=>[c[0],c[1]]) } }));
    res.json({ success: true, data: { type:'FeatureCollection', features } });
  } catch (e) { next(e); }
});

router.get('/geo/predictions', async (req, res, next) => {
  try {
    const ov = await decisionService.overview();
    const preds = ov.roads && ov.roads.predictedHigh ? ov.roads.predictedHigh : [];
    const coords = {
      'ring-road':[21.1606,79.0915],'wardha-road':[21.1452,79.0874],'central-avenue':[21.1462,79.0967],'sadar-nagpur':[21.1413,79.1004],'cotton-market':[21.1475,79.1013],'airport-corridor':[21.1294,79.0621]
    };
    const features = preds.map(id=>({ type:'Feature', properties:{ id, risk:'high' }, geometry:{ type:'Point', coordinates: coords[id] ? [coords[id][0], coords[id][1]] : [0,0] } }));
    res.json({ success: true, data: { type:'FeatureCollection', features } });
  } catch (e) { next(e); }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const list = await alertService.listAlerts(50);
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
});

router.get('/timeline', async (req, res, next) => {
  try {
    const entries = await decisionService.getTimeline(50);
    res.json({ success: true, data: { entries } });
  } catch (e) { next(e); }
});

module.exports = router;
