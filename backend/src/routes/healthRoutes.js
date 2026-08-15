const express = require('express');
const prisma = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      message: 'Database connection unavailable.',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
