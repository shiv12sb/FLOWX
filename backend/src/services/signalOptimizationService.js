const trafficHistory = require('./trafficHistoryService');
const predictionService = require('./trafficPredictionService');
const incidentService = require('./incidentService');

// Configurable bounds
const MIN_GREEN = 8; // seconds
const MAX_GREEN = 120; // seconds

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

async function optimizeSignal(signal, options = {}) {
  // signal.approaches expected as [{ direction, roadId, greenTime, queue }]
  const approaches = Array.isArray(signal.approaches) ? signal.approaches : (signal.approaches || []);
  const cycle = signal.cycleLength || approaches.reduce((s,a)=>s+(a.greenTime||20),0) || 90;

  // compute demand per approach
  const demands = await Promise.all(approaches.map(async (ap) => {
    const roadId = ap.roadId;
    const recent = await trafficHistory.getRecentObservations(roadId, 15).catch(()=>[]);
    const current = recent.length ? recent[recent.length-1].trafficLevel : (ap.trafficLevel || 0);
    const predicted = (predictionService.getCachedPrediction(roadId) || {})['+30']?.predictedTrafficLevel || null;
    const incident = await incidentService.getAnalytics ? null : null; // keep placeholder
    // check for incidents affecting road
    const activeIncidents = (await incidentService.listIncidents()) || [];
    const incidentOnRoad = activeIncidents.find(i => i.road === roadId || i.intersection === signal.name);
    const incidentPenalty = incidentOnRoad ? 0.4 : 0;
    const predictedVal = predicted != null ? predicted : current;
    const queue = ap.queue || 0;
    // demand score weights: predicted more important
    const demand = (predictedVal * 0.6) + (current * 0.25) + (Math.min(queue, 200) * 0.15);
    return { direction: ap.direction, roadId, current, predicted: predictedVal, queue, demand, incidentOnRoad };
  }));

  // normalize demands into green times preserving cycle
  const totalDemand = demands.reduce((s,d)=>s+d.demand,0) || 1;
  const baseAllotted = Math.max(4, cycle / Math.max(1, demands.length));

  // If emergency priority mode, boost the requested direction demand significantly
  if (options.mode === 'EMERGENCY_PRIORITY' && options.emergencyDirection) {
    demands.forEach((dd) => {
      if (String(dd.direction).toUpperCase() === String(options.emergencyDirection).toUpperCase()) {
        dd.demand = dd.demand * 2.2; // strongly favor emergency direction
      } else {
        dd.demand = dd.demand * 0.7; // de-prioritize others temporarily
      }
    });
  }

  const proposed = demands.map((d) => {
    // proportional allocation
    let alloc = (d.demand / totalDemand) * cycle;
    // apply incident penalty by reducing allocation
    if (d.incidentOnRoad) alloc = alloc * 0.7;
    alloc = clamp(Math.round(alloc), MIN_GREEN, MAX_GREEN);
    return { direction: d.direction, roadId: d.roadId, proposedGreen: alloc, currentGreen: null, demand: Math.round(d.demand), incident: Boolean(d.incidentOnRoad), predicted: d.predicted };
  });

  // simple estimated improvements: queue reduction proportional to increase in green time
  const beforeTotalDelay = demands.reduce((s,d)=>s + (d.current * 0.5) + (d.queue * 0.2), 0);
  const afterTotalDelay = demands.reduce((s,d,idx)=>{
    const increase = proposed[idx].proposedGreen - (approaches[idx].greenTime || (cycle/demands.length));
    const factor = 1 - clamp(increase / Math.max(10, approaches[idx].greenTime || 30), -0.5, 0.6);
    return s + ((d.current * 0.5) + (d.queue * 0.2)) * factor;
  }, 0);

  const estimatedDelayReduction = Math.round(Math.max(0, ((beforeTotalDelay - afterTotalDelay) / Math.max(1,beforeTotalDelay)) * 100));
  const estimatedQueueReduction = Math.round(Math.max(0, (demands.reduce((s,d)=>s+d.queue,0) - demands.reduce((s,d,idx)=> s + Math.round(d.queue * (1 - clamp((proposed[idx].proposedGreen - (approaches[idx].greenTime||30))/Math.max(1,proposed[idx].proposedGreen),0,0.9))),0)) / Math.max(1,demands.reduce((s,d)=>s+d.queue,0)) * 100));

  const recommendedPlan = {
    cycleLength: cycle,
    approaches: proposed,
    mode: options.mode || 'BALANCED',
    reason: 'Computed from current traffic and +30m predictions',
    estimatedDelayReduction, estimatedQueueReduction
  };

  // include rationale flags
  recommendedPlan.notes = [];
  if (demands.some(d => d.predicted && d.predicted > 80)) recommendedPlan.notes.push('Optimization influenced by predicted congestion (>80%)');
  if (demands.some(d => d.incidentOnRoad)) recommendedPlan.notes.push('Signal plan adjusted due to active incident');

  // generate alert if estimated improvement is significant or high predicted congestion
  try {
    const alertService = require('./alertService');
    if (recommendedPlan.estimatedDelayReduction >= 10) {
      alertService.createAlert({ level: 'INFO', message: `Signal optimization recommended for ${signal.name}: estimated delay reduction ${recommendedPlan.estimatedDelayReduction}%`, signalId: signal.id });
    }
    if (demands.some(d => d.predicted && d.predicted >= 90)) {
      alertService.createAlert({ level: 'WARNING', message: `Critical predicted congestion on approaches near ${signal.name}`, signalId: signal.id });
    }
  } catch (e) { }

  return recommendedPlan;
}

module.exports = { optimizeSignal };
