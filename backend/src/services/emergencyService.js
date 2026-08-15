const prisma = require('../config/database');
const { optimizeRoutes } = require('./routeOptimizationService');
const etaService = require('./etaCalculationService');
const alertService = require('./alertService');
const { broadcastEmergencyEvent } = require('../utils/emergencyRealtime');
const signalOptimizationService = require('./signalOptimizationService');

// In-memory fallback store when Prisma client doesn't have generated models (test/shim env)
const hasPrismaEmergency = prisma && prisma.emergencyRequest && typeof prisma.emergencyRequest.create === 'function';
const inMemory = { emergencies: [], units: [] };
const { randomUUID } = require('crypto');

async function createEmergency(payload) {
  // basic validation
  if (!payload || !payload.type || typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') {
    throw new Error('Invalid emergency payload');
  }
  if (!hasPrismaEmergency) {
    const em = {
      id: randomUUID(),
      type: payload.type,
      severity: payload.severity || 'MEDIUM',
      status: 'PENDING',
      latitude: payload.latitude,
      longitude: payload.longitude,
      destinationLatitude: payload.destinationLatitude || null,
      destinationLongitude: payload.destinationLongitude || null,
      description: payload.description || null,
      reportedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    inMemory.emergencies.unshift(em);
    try { broadcastEmergencyEvent('created', em); } catch(e){}
    try { alertService.createAlert({ level: 'CRITICAL', message: `Emergency reported: ${em.type}`, signalId: null }).catch(()=>{}); } catch(e){}
    return em;
  }
  const em = await prisma.emergencyRequest.create({ data: {
    type: payload.type,
    severity: payload.severity || 'MEDIUM',
    latitude: payload.latitude,
    longitude: payload.longitude,
    destinationLatitude: payload.destinationLatitude || null,
    destinationLongitude: payload.destinationLongitude || null,
    description: payload.description || null
  }}).catch(()=>null);
  if (em) {
    broadcastEmergencyEvent('created', em);
    alertService.createAlert({ level: 'CRITICAL', message: `Emergency reported: ${em.type}`, signalId: null }).catch(()=>{});
  }
  return em;
}

async function listEmergencies() {
  if (!hasPrismaEmergency) return inMemory.emergencies;
  return prisma.emergencyRequest.findMany({ orderBy: { createdAt: 'desc' } }).catch(()=>[]);
}

async function getEmergency(id) {
  if (!hasPrismaEmergency) return inMemory.emergencies.find(e=>e.id===id) || null;
  return prisma.emergencyRequest.findUnique({ where: { id } }).catch(()=>null);
}

async function listUnits() {
  if (!prisma || !prisma.emergencyUnit) return inMemory.units;
  return prisma.emergencyUnit.findMany({ orderBy: { createdAt: 'desc' } }).catch(()=>[]);
}

async function getUnit(id) {
  if (!prisma || !prisma.emergencyUnit) return inMemory.units.find(u=>u.id===id) || null;
  return prisma.emergencyUnit.findUnique({ where: { id } }).catch(()=>null);
}

async function recommendUnitForEmergency(emergency) {
  // naive recommendation: choose available unit with minimal straight-line distance + ETA using optimizeRoutes
  const units = await listUnits();
  const available = units.filter(u => u.status === 'AVAILABLE');
  if (!available.length) return null;
  // compute rough Haversine distance
  function haversine(a,b){
    const R=6371; const toR=(d)=>d*Math.PI/180;
    const dlat = toR(b.latitude-a.latitude); const dlon = toR(b.longitude-a.longitude);
    const la=toR(a.latitude); const lb=toR(b.latitude);
    const h = Math.sin(dlat/2)**2 + Math.cos(la)*Math.cos(lb)*Math.sin(dlon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }
  const scored = await Promise.all(available.map(async (u) => {
    const dist = (typeof u.latitude === 'number' && typeof u.longitude === 'number') ? haversine({latitude:u.latitude,longitude:u.longitude},{latitude:emergency.latitude,longitude:emergency.longitude}) : 9999;
    // estimate route using optimizeRoutes from unit to emergency
    const routeRes = await optimizeRoutes(`${u.latitude},${u.longitude}`, `${emergency.latitude},${emergency.longitude}`, { usePrediction: true }).catch(()=>({ recommendedRoute: null }));
    const eta = routeRes && routeRes.recommendedRoute ? routeRes.recommendedRoute.etaMinutes : null;
    const score = (eta || (dist*3)) + (dist*0.2);
    return { unit: u, distKm: Number(dist.toFixed(2)), eta, score };
  }));
  scored.sort((a,b)=>a.score - b.score);
  return scored[0] || null;
}

async function assignUnit(emergencyId, unitId, assignedBy) {
  const em = await getEmergency(emergencyId);
  if (!em) throw new Error('Emergency not found');
  const unit = await getUnit(unitId);
  if (!unit) throw new Error('Unit not found');
  if (!hasPrismaEmergency) {
    // update in-memory
    const idx = inMemory.emergencies.findIndex(e=>e.id===emergencyId);
    if (idx>=0) { inMemory.emergencies[idx].assignedUnitId = unitId; inMemory.emergencies[idx].status = 'ASSIGNED'; inMemory.emergencies[idx].updatedAt = new Date().toISOString(); }
    const uidx = inMemory.units.findIndex(u=>u.id===unitId);
    if (uidx>=0) { inMemory.units[uidx].status = 'ASSIGNED'; inMemory.units[uidx].currentEmergencyId = emergencyId; inMemory.units[uidx].lastUpdated = new Date().toISOString(); }
    const updated = inMemory.emergencies.find(e=>e.id===emergencyId) || em;
    broadcastEmergencyEvent('assigned', { emergency: updated, unit });
    try { alertService.createAlert({ level: 'INFO', message: `Unit ${unit.unitNumber} assigned to emergency ${emergencyId}` }).catch(()=>{}); } catch(e){}
    return { emergency: updated, unit };
  }
  await prisma.emergencyRequest.update({ where: { id: emergencyId }, data: { assignedUnitId: unitId, status: 'ASSIGNED' } }).catch(()=>null);
  await prisma.emergencyUnit.update({ where: { id: unitId }, data: { status: 'ASSIGNED', currentEmergencyId: emergencyId } }).catch(()=>null);
  const updated = await getEmergency(emergencyId);
  broadcastEmergencyEvent('assigned', { emergency: updated, unit });
  alertService.createAlert({ level: 'INFO', message: `Unit ${unit.unitNumber} assigned to emergency ${emergencyId}` }).catch(()=>{});
  return { emergency: updated, unit };
}

async function recommendRoute(emergencyId) {
  const em = await getEmergency(emergencyId);
  if (!em) throw new Error('Emergency not found');
  if (!em.destinationLatitude || !em.destinationLongitude) throw new Error('Destination not set');
  const from = `${em.latitude},${em.longitude}`;
  const to = `${em.destinationLatitude},${em.destinationLongitude}`;
  const normal = await optimizeRoutes(from, to, { usePrediction: false }).catch(()=>({ recommendedRoute: null }));
  const emergency = await optimizeRoutes(from, to, { usePrediction: true }).catch(()=>({ recommendedRoute: null }));
  // For emergency, prefer routes with higher score (optimizeRoutes returns scored routes)
  const result = {
    normalEta: normal.recommendedRoute ? normal.recommendedRoute.etaMinutes : null,
    emergencyEta: emergency.recommendedRoute ? emergency.recommendedRoute.etaMinutes : null,
    recommended: emergency.recommendedRoute || normal.recommendedRoute,
    alternatives: (emergency.alternatives || normal.alternatives || [])
  };
  broadcastEmergencyEvent('routeUpdated', { emergencyId, result });
  return result;
}

async function recommendSignalPriorities(emergencyId) {
  const em = await getEmergency(emergencyId);
  if (!em) throw new Error('Emergency not found');
  // find nearby signals
  const signals = (prisma && prisma.signal && typeof prisma.signal.findMany === 'function') ? await prisma.signal.findMany().catch(()=>[]) : [];
  function haversine(a,b){ const R=6371; const toR=(d)=>d*Math.PI/180; const dlat = toR(b.latitude-a.latitude); const dlon = toR(b.longitude-a.longitude); const la=toR(a.latitude); const lb=toR(b.latitude); const h = Math.sin(dlat/2)**2 + Math.cos(la)*Math.cos(lb)*Math.sin(dlon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
  const withDist = signals.map(s => ({ signal: s, dist: (s.latitude && s.longitude) ? haversine({latitude: s.latitude, longitude: s.longitude}, {latitude: em.latitude, longitude: em.longitude}) : 9999 }));
  withDist.sort((a,b)=>a.dist - b.dist);
  const top = withDist.slice(0,6);
  const recommendations = [];
  for (const item of top) {
    try {
      const plan = await signalOptimizationService.optimizeSignal(item.signal, { mode: 'EMERGENCY_PRIORITY', emergencyDirection: null }).catch(()=>null);
      recommendations.push({ signal: item.signal, distanceKm: Number(item.dist.toFixed(2)), plan });
    } catch (e) {
      // ignore
    }
  }
  broadcastEmergencyEvent('signalPriorityUpdated', { emergencyId, recommendations });
  return recommendations;
}

async function approveResponse(emergencyId, approverId) {
  const em = await getEmergency(emergencyId);
  if (!em) throw new Error('Emergency not found');
  if (!hasPrismaEmergency) {
    const idx = inMemory.emergencies.findIndex(e=>e.id===emergencyId);
    if (idx>=0) { inMemory.emergencies[idx].status = 'EN_ROUTE'; inMemory.emergencies[idx].updatedAt = new Date().toISOString(); }
  } else {
    await prisma.emergencyRequest.update({ where: { id: emergencyId }, data: { status: 'EN_ROUTE' } }).catch(()=>null);
  }
  const updated = await getEmergency(emergencyId);
  broadcastEmergencyEvent('approved', updated);
  alertService.createAlert({ level: 'INFO', message: `Emergency ${emergencyId} approved by ${approverId}` }).catch(()=>{});
  return updated;
}

async function resolveEmergency(emergencyId) {
  if (!hasPrismaEmergency) {
    const idx = inMemory.emergencies.findIndex(e=>e.id===emergencyId);
    if (idx>=0) { inMemory.emergencies[idx].status = 'RESOLVED'; inMemory.emergencies[idx].updatedAt = new Date().toISOString(); }
  } else {
    await prisma.emergencyRequest.update({ where: { id: emergencyId }, data: { status: 'RESOLVED' } }).catch(()=>null);
  }
  const updated = await getEmergency(emergencyId);
  broadcastEmergencyEvent('resolved', updated);
  return updated;
}

module.exports = { createEmergency, listEmergencies, getEmergency, listUnits, getUnit, recommendUnitForEmergency, assignUnit, recommendRoute, recommendSignalPriorities, approveResponse, resolveEmergency };
