const prisma = require('../config/database');
const { broadcastIncidentEvent } = require('../utils/realtime');

async function listIncidents(filter = {}) {
  const where = {};
  if (filter.status) where.status = filter.status;
  if (filter.severity) where.severity = filter.severity;
  return prisma.incident.findMany({ where, orderBy: { reportedAt: 'desc' } });
}

async function getIncident(id) {
  return prisma.incident.findUnique({ where: { id } });
}

async function createIncident(data) {
  const created = await prisma.incident.create({ data });
  broadcastIncidentEvent('created', created);
  return created;
}

async function updateIncident(id, data) {
  const updated = await prisma.incident.update({ where: { id }, data });
  broadcastIncidentEvent('updated', updated);
  return updated;
}

async function deleteIncident(id) {
  const del = await prisma.incident.delete({ where: { id } });
  broadcastIncidentEvent('deleted', del);
  return del;
}

async function getAnalytics() {
  // Incidents today
  const since = new Date();
  since.setHours(0,0,0,0);
  const incidentsToday = await prisma.incident.count({ where: { reportedAt: { gte: since } } });

  // Average resolution time (for resolved incidents)
  const resolved = await prisma.incident.findMany({ where: { resolvedAt: { not: null } }, select: { reportedAt: true, resolvedAt: true, road: true, type: true, severity: true } });
  const avgResolution = resolved.length ? Math.round(resolved.reduce((sum, r) => sum + (new Date(r.resolvedAt) - new Date(r.reportedAt)), 0) / resolved.length / 1000 / 60) : 0;

  // Most affected road
  const groupRoad = await prisma.$queryRawUnsafe(`SELECT road, COUNT(*) as cnt FROM incidents WHERE road IS NOT NULL GROUP BY road ORDER BY cnt DESC LIMIT 1`);
  const mostAffectedRoad = groupRoad && groupRoad[0] ? groupRoad[0].road : null;

  // Most common incident type
  const groupType = await prisma.$queryRawUnsafe(`SELECT type, COUNT(*) as cnt FROM incidents GROUP BY type ORDER BY cnt DESC LIMIT 1`);
  const mostCommonType = groupType && groupType[0] ? groupType[0].type : null;

  const criticalIncidents = await prisma.incident.count({ where: { severity: 'CRITICAL', status: 'ACTIVE' } });

  return {
    incidentsToday,
    averageResolutionMinutes: avgResolution,
    mostAffectedRoad,
    mostCommonType,
    criticalIncidents
  };
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident, deleteIncident, getAnalytics };

module.exports = { listIncidents, getIncident, createIncident, updateIncident, deleteIncident };
