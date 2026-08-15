const express = require('express');
const router = express.Router();
const routeOptimizationService = require('../services/routeOptimizationService');

router.post('/optimize', async (req, res, next) => {
  try {
    const { origin, destination } = req.body || {};
    if (!origin || !destination || typeof origin !== 'string' || typeof destination !== 'string' || origin.trim().length < 2 || destination.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'origin and destination are required and must be valid strings' });
    }

    const usePrediction = Boolean(req.body && req.body.usePrediction);
    const result = await routeOptimizationService.optimizeRoutes(String(origin), String(destination), { usePrediction });
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
