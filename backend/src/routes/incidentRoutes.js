const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const incidentService = require('../services/incidentService');

router.get('/', async (req, res, next) => {
  try {
    const incidents = await incidentService.listIncidents();
    res.json({ success: true, data: incidents });
  } catch (err) { next(err); }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const stats = await incidentService.getAnalytics();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const incident = await incidentService.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('ADMIN','TRAFFIC_AUTHORITY','TRAFFIC_OPERATOR','EMERGENCY_OPERATOR'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    const created = await incidentService.createIncident(payload);
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, requireRole('ADMIN','TRAFFIC_AUTHORITY','TRAFFIC_OPERATOR','EMERGENCY_OPERATOR'), async (req, res, next) => {
  try {
    const updated = await incidentService.updateIncident(req.params.id, req.body || {});
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireRole('ADMIN','TRAFFIC_AUTHORITY'), async (req, res, next) => {
  try {
    await incidentService.deleteIncident(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
