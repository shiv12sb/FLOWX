const incidentService = require('./incidentService');
const predictionService = require('./trafficPredictionService');
const signalService = require('./signalService');
const emergencyService = require('./emergencyService');
const routeNetwork = require('./routeNetworkService');

async function overview() {
  const incidents = await incidentService.listIncidents().catch(()=>[]);
  const criticalIncidents = incidents.filter(i=>i.severity==='CRITICAL' && i.status==='ACTIVE').length;
  const activeIncidents = incidents.filter(i=>i.status==='ACTIVE').length;

  const emergencies = await emergencyService.listEmergencies().catch(()=>[]);
  const activeEmergencies = emergencies.filter(e=>e.status && e.status!=='RESOLVED' && e.status!=='CANCELLED').length;
  const criticalEmergencies = emergencies.filter(e=>e.severity==='CRITICAL').length;

  const signals = await signalService.listSignals().catch(()=>[]);
  const signalsAttention = signals.filter(s=>s.status && (s.status==='OFFLINE' || s.status==='MANUAL' || s.status==='OPTIMIZED')).length;

  const roads = await routeNetwork.getRoadState().catch(()=>[]);
  const congested = roads.filter(r=>Number(r.utilization || 0) >= 75).map(r=>r.id);

  const preds = predictionService.getCachedPrediction ? predictionService.getCachedPrediction() : null;
  // compute predicted high-risk roads
  const predictedHigh = [];
  if (preds) {
    Object.entries(preds).forEach(([roadId, val])=>{
      const sixty = val['+60'] && val['+60'].predictedTrafficLevel || 0;
      if (sixty >= 75) predictedHigh.push(roadId);
    });
  }

  return {
    incidents: { total: incidents.length, active: activeIncidents, critical: criticalIncidents },
    emergencies: { total: emergencies.length, active: activeEmergencies, critical: criticalEmergencies },
    signals: { total: signals.length, attention: signalsAttention },
    roads: { congested: congested.slice(0,10), predictedHigh: predictedHigh.slice(0,10) },
    timestamp: new Date().toISOString()
  };
}

async function generateRecommendations() {
  const recs = [];
  const ov = await overview();
  // Emergency recommendations
  if (ov.emergencies.active > 0) {
    recs.push({ priority: 'CRITICAL', title: 'Active emergency response', description: `${ov.emergencies.active} active emergencies (${ov.emergencies.critical} critical)`, recommendedAction: 'Open Emergency Dashboard', related: 'emergencies' });
  }
  if (ov.roads.predictedHigh && ov.roads.predictedHigh.length) {
    recs.push({ priority: 'HIGH', title: 'Predicted congestion', description: `High predicted traffic on ${ov.roads.predictedHigh.join(', ')}`, recommendedAction: 'Review alternative routes', related: 'predictions' });
  }
  if (ov.incidents.critical > 0) {
    recs.push({ priority: 'HIGH', title: 'Critical incident(s)', description: `There are ${ov.incidents.critical} critical incident(s)`, recommendedAction: 'Inspect incidents', related: 'incidents' });
  }
  if (ov.signals.attention > 0) {
    recs.push({ priority: 'MEDIUM', title: 'Signals require attention', description: `${ov.signals.attention} signals flagged`, recommendedAction: 'Review signal optimizations', related: 'signals' });
  }

  return recs;
}

module.exports = { overview, generateRecommendations };

// Compute transparent network risk score (0-100)
async function getRiskScore() {
  const ov = await overview();
  // factors: congestion (0-100), incident severity (weighted), emergencies (weighted), signal attention
  const roads = ov.roads || {};
  const congestedCount = (roads.congested || []).length;
  const predictedCount = (roads.predictedHigh || []).length;
  const incidentScore = Math.min(100, (ov.incidents.critical || 0) * 20 + (ov.incidents.active || 0) * 4);
  const emergencyScore = Math.min(100, (ov.emergencies.critical || 0) * 25 + (ov.emergencies.active || 0) * 5);
  const signalScore = Math.min(100, (ov.signals.attention || 0) * 8);
  const congestionScore = Math.min(100, congestedCount * 8 + predictedCount * 6);

  // combine with weights
  const raw = Math.round((congestionScore * 0.4) + (incidentScore * 0.25) + (emergencyScore * 0.25) + (signalScore * 0.1));
  const score = Math.max(0, Math.min(100, raw));
  let category = 'LOW';
  if (score >= 76) category = 'CRITICAL';
  else if (score >= 51) category = 'HIGH';
  else if (score >= 26) category = 'MODERATE';
  else category = 'LOW';

  const factors = { congestionScore, incidentScore, emergencyScore, signalScore };
  return { score, category, factors, timestamp: new Date().toISOString() };
}

async function getTimeline(limit = 40) {
  const alertSvc = require('./alertService');
  const incidents = await require('./incidentService').listIncidents().catch(()=>[]);
  const alerts = await alertSvc.listAlerts(limit).catch(()=>[]);
  const emergencies = await require('./emergencyService').listEmergencies().catch(()=>[]);
  const preds = predictionService.getCachedPrediction ? predictionService.getCachedPrediction() : {};

  const entries = [];
  alerts.forEach(a=> entries.push({ time: a.createdAt || a.createdAt, type: 'alert', text: a.message, level: a.level }));
  incidents.slice(0,limit).forEach(i=> entries.push({ time: i.reportedAt, type: 'incident', text: `${i.title || i.type}`, level: i.severity }));
  emergencies.slice(0,limit).forEach(e=> entries.push({ time: e.reportedAt, type: 'emergency', text: `${e.type} ${e.id}`, level: e.severity }));

  entries.sort((a,b)=> new Date(b.time) - new Date(a.time));
  return entries.slice(0, limit);
}

module.exports = { overview, generateRecommendations, getRiskScore, getTimeline };
