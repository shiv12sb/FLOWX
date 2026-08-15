const { buildGraph, getRoadState, normalizeRoadId, routeTemplates } = require('./routeNetworkService');
const { calculateETAForRoute } = require('./etaCalculationService');
const { scoreRoute } = require('./routeScoringEngine');

function safeNumber(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

function costOfRoad(road) {
  const utilization = safeNumber(road.utilization, 0);
  const speed = Math.max(8, safeNumber(road.averageSpeed, 32));
  const distanceKm = Math.max(1, safeNumber(road.length, 4) * 1.7);
  const travelTime = (distanceKm / speed) * 60;

  let congestionPenalty = 0;
  if (utilization >= 50 && utilization < 70) congestionPenalty = utilization * 0.18;
  else if (utilization >= 70 && utilization < 100) congestionPenalty = utilization * 0.35;
  else if (utilization >= 100 && utilization < 120) congestionPenalty = utilization * 0.7;
  else if (utilization >= 120) congestionPenalty = utilization * 1.18;

  let incidentPenalty = 0;
  if (road.incident === 'accident') incidentPenalty = 12;
  else if (road.incident === 'laneClosure') incidentPenalty = 18;
  else if (road.incident === 'roadWork') incidentPenalty = 9;

  let capacityPenalty = 0;
  if (utilization > 100) capacityPenalty = (utilization - 100) * 0.7;
  if (utilization > 120) capacityPenalty += (utilization - 120) * 1.2;
  if (utilization > 150) capacityPenalty += 12;

  return travelTime + congestionPenalty + incidentPenalty + capacityPenalty + 2.5;
}

function summarizeRoute(nodes, graph, roadsById, options = {}) {
  const roadSequence = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const from = nodes[i];
    const to = nodes[i + 1];
    const edge = (graph.get(from) || []).find((entry) => entry.to === to);
    if (edge) roadSequence.push(edge.road || roadsById[to] || roadsById[from]);
    else if (roadsById[to]) roadSequence.push(roadsById[to]);
  }

  const totalDistance = roadSequence.reduce((s, r) => s + safeNumber(r.length, 3), 0);
  const avgSpeed = roadSequence.length ? roadSequence.reduce((s, r) => s + safeNumber(r.averageSpeed, 20), 0) / roadSequence.length : 0;
  const avgUtil = roadSequence.length ? roadSequence.reduce((s, r) => s + safeNumber(r.utilization, 0), 0) / roadSequence.length : 0;
  const delay = roadSequence.reduce((s, r) => s + safeNumber(r.delay, 0), 0);
  const incidents = roadSequence.filter((r) => Boolean(r.incident)).length;

  const totalCost = roadSequence.reduce((s, r) => s + costOfRoad(r), 0);
  const etaObj = calculateETAForRoute({ distanceKm: totalDistance, avgSpeed, averageUtilization: avgUtil, delay });

  const route = {
    id: `route-${Math.random().toString(36).slice(2,8)}`,
    nodes,
    roadSequence,
    totalCost,
    distanceKm: Number(totalDistance.toFixed(1)),
    etaMinutes: etaObj.etaMinutes,
    avgSpeed: Number(avgSpeed.toFixed(1)),
    averageUtilization: Number(avgUtil.toFixed(1)),
    delay: Number(delay.toFixed(0)),
    incidents,
    status: avgUtil >= 120 ? 'HIGH CONGESTION' : avgUtil >= 80 ? 'MODERATE' : avgUtil >= 55 ? 'WATCH' : 'SMOOTH'
  };

  return route;
}

function dijkstra(startId, endId, graph, blockedEdges = new Set()) {
  const distances = new Map();
  const previous = new Map();
  const queue = [{ id: startId, cost: 0 }];
  distances.set(startId, 0);

  while (queue.length) {
    queue.sort((a,b) => a.cost - b.cost);
    const current = queue.shift();
    if (!current) break;
    if (current.id === endId) break;

    const neighbors = graph.get(current.id) || [];
    neighbors.forEach((neighbor) => {
      const edgeKey = `${current.id}->${neighbor.to}`;
      if (blockedEdges.has(edgeKey)) return;
      const nextCost = current.cost + costOfRoad(neighbor.road);
      if (!distances.has(neighbor.to) || nextCost < distances.get(neighbor.to)) {
        distances.set(neighbor.to, nextCost);
        previous.set(neighbor.to, current.id);
        queue.push({ id: neighbor.to, cost: nextCost });
      }
    });
  }

  if (!distances.has(endId)) return null;
  const nodes = [];
  let curr = endId;
  while (curr) {
    nodes.unshift(curr);
    curr = previous.get(curr) || null;
  }
  return nodes;
}

async function optimizeRoutes(origin, destination, opts = {}) {
  // origin/destination may be labels; normalize
  const { graph, roadsById } = await buildGraph();
  const startId = (await normalizeRoadId(origin)) || origin;
  const endId = (await normalizeRoadId(destination)) || destination;
  if (!startId || !endId || startId === endId) return { recommendedRoute: null, alternatives: [] };

  // Build candidate paths from templates first
  const candidates = [];
  const templates = routeTemplates.filter((p) => p.includes(startId) && p.includes(endId));
  templates.slice(0,3).forEach((t) => candidates.push(t));

  if (!candidates.length) {
    // try simple dijkstra path
    const path = dijkstra(startId, endId, graph);
    if (path) candidates.push(path);
  }

  // As fallback, attempt permutations from graph
  if (!candidates.length) {
    // BFS walks up to depth
    function walk(cur, target, path, visited) {
      if (path.length > 8) return;
      if (cur === target && path.length > 1) { candidates.push(path); return; }
      const neigh = (graph.get(cur) || []).map((e) => e.to).filter((id) => !visited.has(id));
      neigh.forEach((n) => { const vis = new Set(visited); vis.add(n); walk(n, target, [...path, n], vis); });
    }
    walk(startId, endId, [startId], new Set([startId]));
  }

  const unique = [];
  const seen = new Set();
  candidates.forEach((c) => { const sig = c.join('>'); if (!seen.has(sig)) { seen.add(sig); unique.push(c); } });

  const routes = unique.map((nodes) => summarizeRoute(nodes, graph, roadsById, opts)).filter(Boolean);

  // Score routes now, optionally using prediction data
  const predictionSvc = opts && opts.usePrediction ? require('./trafficPredictionService') : null;
  const scored = await Promise.all(routes.map(async (r) => {
    let predictedLevel = 0;
    if (predictionSvc && r.roadSequence && r.roadSequence.length) {
      try {
        const preds = r.roadSequence.map(rs => {
          const pid = rs.id || rs.roadId || rs.name;
          const p = predictionSvc.getCachedPrediction(pid);
          return p ? (p['+30']?.predictedTrafficLevel || p['+15']?.predictedTrafficLevel || p['+60']?.predictedTrafficLevel || 0) : 0;
        });
        const sum = preds.reduce((s,v)=>s+v,0);
        predictedLevel = preds.length ? Math.round(sum/preds.length) : 0;
      } catch (e) { predictedLevel = 0; }
    }
    const scoring = scoreRoute(r, {}, { predictedTrafficLevel: predictedLevel });
    r.score = scoring.score;
    r.explanation = scoring.explanation;
    return r;
  }));

  scored.sort((a,b) => b.score - a.score);

  const routesSorted = scored;

  if (!routes.length) return { recommendedRoute: null, alternatives: [] };

  const recommended = routesSorted[0];
  const alternatives = routesSorted.slice(1);

  return { recommendedRoute: recommended, alternatives, all: routes };
}

module.exports = { optimizeRoutes };
