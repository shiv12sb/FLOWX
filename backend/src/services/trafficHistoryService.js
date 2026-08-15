const prisma = require('../config/database');

function roundTo5Minutes(date) {
  const d = new Date(date);
  d.setSeconds(0,0);
  const mins = d.getMinutes();
  d.setMinutes(Math.floor(mins / 5) * 5);
  return d;
}

async function recordObservation({ roadId, trafficLevel, averageSpeed = null, vehicleCount = null, timestamp = new Date() }) {
  const ts = roundTo5Minutes(timestamp);
  // upsert by roadId and timestamp
  const existing = await prisma.trafficObservation.findFirst({ where: { roadId, timestamp: ts } });
  if (existing) {
    // average with existing to avoid excessive writes
    const newLevel = (existing.trafficLevel + trafficLevel) / 2;
    const newSpeed = averageSpeed != null && existing.averageSpeed != null ? (existing.averageSpeed + averageSpeed) / 2 : (averageSpeed || existing.averageSpeed);
    const newCount = vehicleCount != null && existing.vehicleCount != null ? Math.round((existing.vehicleCount + vehicleCount)/2) : (vehicleCount || existing.vehicleCount);
    return prisma.trafficObservation.update({ where: { id: existing.id }, data: { trafficLevel: newLevel, averageSpeed: newSpeed, vehicleCount: newCount } });
  }

  return prisma.trafficObservation.create({ data: { roadId, trafficLevel, averageSpeed, vehicleCount, timestamp: ts } });
}

async function getRecentObservations(roadId, minutes = 120) {
  const since = new Date(Date.now() - minutes * 60000);
  return prisma.trafficObservation.findMany({ where: { roadId, timestamp: { gte: since } }, orderBy: { timestamp: 'asc' } });
}

async function getHistoricalPattern(roadId, timeWindowMinutes = 15, daysBack = 28) {
  // return average trafficLevel for the same time-of-day across past days
  const results = [];
  const now = new Date();
  for (let d = 1; d <= Math.min(daysBack, 28); d++) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    // find observations within window around this time
    const start = new Date(day);
    start.setHours(now.getHours(), now.getMinutes(), 0, 0);
    const windowStart = new Date(start.getTime() - (timeWindowMinutes/2)*60000);
    const windowEnd = new Date(start.getTime() + (timeWindowMinutes/2)*60000);
    const obs = await prisma.trafficObservation.findMany({ where: { roadId, timestamp: { gte: windowStart, lte: windowEnd } } });
    if (obs && obs.length) {
      const avg = obs.reduce((s,o)=>s+o.trafficLevel,0)/obs.length;
      results.push(avg);
    }
  }
  if (!results.length) return null;
  const sum = results.reduce((s,v)=>s+v,0);
  return sum / results.length;
}

module.exports = { recordObservation, getRecentObservations, getHistoricalPattern };
