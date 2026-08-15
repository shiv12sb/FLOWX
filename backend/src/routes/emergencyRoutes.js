const express = require('express');
const router = express.Router();
const emergencyService = require('../services/emergencyService');
console.log('EmergencyService exports:', Object.keys(emergencyService));
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Testing helper: allow skipping auth in test environments
if (process.env.SKIP_AUTH_FOR_TEST === '1') {
  router.use((req, res, next) => {
    req.user = { id: 'test', role: 'ADMIN', isActive: true };
    next();
  });
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const list = await emergencyService.listEmergencies();
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const em = await emergencyService.getEmergency(req.params.id);
    if (!em) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: em });
  } catch (e) { next(e); }
});

router.post('/', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const created = await emergencyService.createEmergency(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    console.error('Emergency create error:', e && e.stack ? e.stack : e);
    next(e);
  }
});

router.post('/:id/assign', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const { unitId } = req.body;
    const result = await emergencyService.assignUnit(req.params.id, unitId, req.user && req.user.id);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/:id/route', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const r = await emergencyService.recommendRoute(req.params.id);
    res.json({ success: true, data: r });
  } catch (e) { next(e); }
});

router.post('/:id/recommend-unit', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const em = await emergencyService.getEmergency(req.params.id);
    if (!em) return res.status(404).json({ success: false, message: 'Not found' });
    const rec = await emergencyService.recommendUnitForEmergency(em);
    res.json({ success: true, data: rec });
  } catch (e) { next(e); }
});

router.post('/:id/signal-priorities', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const rec = await emergencyService.recommendSignalPriorities(req.params.id);
    res.json({ success: true, data: rec });
  } catch (e) { next(e); }
});

router.post('/:id/approve', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const updated = await emergencyService.approveResponse(req.params.id, req.user && req.user.id);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.post('/:id/resolve', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const updated = await emergencyService.resolveEmergency(req.params.id);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.get('/units', authenticate, requireRole('EMERGENCY_OPERATOR','TRAFFIC_OPERATOR','ADMIN'), async (req, res, next) => {
  try {
    const units = await emergencyService.listUnits();
    res.json({ success: true, data: units });
  } catch (e) { next(e); }
});

module.exports = router;
