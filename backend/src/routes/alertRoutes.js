const express = require('express');
const router = express.Router();
const { listAlerts } = require('../services/alertService');

router.get('/', async (req, res, next) => {
  try {
    const alerts = await listAlerts(50);
    return res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
});

module.exports = router;
