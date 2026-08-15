const prisma = require('../config/database');
const { broadcastAlert } = require('../utils/realtime');

async function createAlert({ level = 'INFO', message = '', signalId = null }) {
  try {
    const alert = await prisma.alert.create({ data: { level, message, signalId } });
    try { broadcastAlert(alert); } catch (e) {}
    return alert;
  } catch (e) {
    // fallback to in-memory object if DB unavailable
    const fallback = { id: `fallback-${Date.now()}`, level, message, signalId, createdAt: new Date() };
    try { broadcastAlert(fallback); } catch (e) {}
    return fallback;
  }
}

async function listAlerts(limit = 50) {
  try {
    return await prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  } catch (e) {
    return [];
  }
}

module.exports = { createAlert, listAlerts };
