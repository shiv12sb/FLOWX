const express = require('express');
const router = express.Router();
const signalService = require('../services/signalService');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/', async (req, res, next) => {
  try {
    const signals = await signalService.listSignals();
    return res.json({ success: true, data: signals });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const signal = await signalService.getSignal(req.params.id);
    if (!signal) return res.status(404).json({ success: false, message: 'Signal not found' });
    return res.json({ success: true, data: signal });
  } catch (err) { next(err); }
});

router.get('/:id/optimization', async (req, res, next) => {
  try {
    const suggestion = await signalService.suggestOptimization(req.params.id, { mode: req.query.mode });
    return res.json({ success: true, data: suggestion });
  } catch (err) { next(err); }
});

router.post('/:id/optimize', authenticate, requireRole('TRAFFIC_OPERATOR','TRAFFIC_AUTHORITY','ADMIN'), async (req, res, next) => {
  try {
    const suggestion = await signalService.suggestOptimization(req.params.id, { mode: req.body.mode });
    // persist suggestion as pending? For simplicity return suggestion for operator to approve
    return res.json({ success: true, data: suggestion });
  } catch (err) { next(err); }
});

router.post('/:id/emergency', authenticate, requireRole('TRAFFIC_OPERATOR','TRAFFIC_AUTHORITY','ADMIN'), async (req, res, next) => {
  try {
    const direction = req.body.direction || req.query.direction;
    if (!direction) return res.status(400).json({ success: false, message: 'direction required' });
    const suggestion = await signalService.emergencyPriority(req.params.id, direction);
    return res.json({ success: true, data: suggestion });
  } catch (err) { next(err); }
});

router.post('/:id/approve', authenticate, requireRole('TRAFFIC_OPERATOR','TRAFFIC_AUTHORITY','ADMIN'), async (req, res, next) => {
  try {
    const plan = req.body.plan;
    if (!plan) return res.status(400).json({ success: false, message: 'plan required' });
    const applied = await signalService.applyApprovedPlan(req.params.id, plan);
    return res.json({ success: true, data: applied });
  } catch (err) { next(err); }
});

router.patch('/:id/mode', authenticate, requireRole('TRAFFIC_OPERATOR','TRAFFIC_AUTHORITY','ADMIN'), async (req, res, next) => {
  try {
    const mode = req.body.mode;
    if (!mode) return res.status(400).json({ success: false, message: 'mode required' });
    const updated = await signalService.updateSignal(req.params.id, { status: mode });
    return res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
