const express = require('express');
const router = express.Router();
const predictionService = require('../services/trafficPredictionService');

router.get('/', async (req, res, next) => {
  try {
    const horizon = req.query.horizon || '+15';
    const road = req.query.road || null;
    const cached = predictionService.getCachedPrediction(road);
    return res.json({ success: true, data: cached });
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    const status = predictionService.getStatus ? predictionService.getStatus() : { lastUpdated: null };
    return res.json({ success: true, data: status });
  } catch (err) { next(err); }
});

router.get('/network', async (req, res, next) => {
  try {
    const cached = predictionService.getCachedPrediction();
    return res.json({ success: true, data: cached });
  } catch (err) { next(err); }
});

router.post('/demo', async (req, res, next) => {
  try {
    const { roadId, series } = req.body || {};
    if (!roadId || !series) return res.status(400).json({ success: false, message: 'roadId and series required' });
    predictionService.setDemoOverride(roadId, series);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
