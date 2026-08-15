// Minimal network definition reused by the backend route optimizer.
const fallbackRoads = [
  { id: 'ring-road', name: 'Ring Road', roadType: 'highway', length: 4.5, lanes: 4, capacityPerMinute: 240, currentVehicles: 640, averageSpeed: 39, utilization: 68, delay: 7, incident: null, upstreamRoads: ['airport-corridor'], downstreamRoads: ['sadar-nagpur'], authority: 'Nagpur West' },
  { id: 'wardha-road', name: 'Wardha Road', roadType: 'arterial', length: 3.7, lanes: 4, capacityPerMinute: 220, currentVehicles: 760, averageSpeed: 22, utilization: 82, delay: 14, incident: 'accident', upstreamRoads: ['ring-road'], downstreamRoads: ['sadar-nagpur'], authority: 'Nagpur Central' },
  { id: 'central-avenue', name: 'Central Avenue', roadType: 'arterial', length: 3.4, lanes: 3, capacityPerMinute: 190, currentVehicles: 420, averageSpeed: 38, utilization: 46, delay: 4, incident: null, upstreamRoads: ['ring-road'], downstreamRoads: ['sadar-nagpur'], authority: 'Nagpur Central' },
  { id: 'sadar-nagpur', name: 'Sadar Nagpur', roadType: 'arterial', length: 4.2, lanes: 4, capacityPerMinute: 230, currentVehicles: 520, averageSpeed: 29, utilization: 58, delay: 5, incident: null, upstreamRoads: ['ring-road', 'wardha-road', 'central-avenue'], downstreamRoads: ['cotton-market'], authority: 'Nagpur Urban' },
  { id: 'cotton-market', name: 'Cotton Market', roadType: 'local', length: 2.8, lanes: 2, capacityPerMinute: 150, currentVehicles: 610, averageSpeed: 15, utilization: 91, delay: 11, incident: 'laneClosure', upstreamRoads: ['sadar-nagpur'], downstreamRoads: [], authority: 'Nagpur Market' },
  { id: 'airport-corridor', name: 'Airport Corridor', roadType: 'highway', length: 5.2, lanes: 4, capacityPerMinute: 260, currentVehicles: 360, averageSpeed: 50, utilization: 39, delay: 2, incident: null, upstreamRoads: [], downstreamRoads: ['ring-road'], authority: 'Nagpur Airport' }
];

const locationMap = {
  Sitabuldi: 'sadar-nagpur',
  'Civil Lines': 'wardha-road',
  'Wardha Road': 'wardha-road',
  'Ring Road': 'ring-road',
  'Central Avenue': 'central-avenue',
  'Cotton Market': 'cotton-market',
  MIHAN: 'airport-corridor',
  Airport: 'airport-corridor',
  'Airport Corridor': 'airport-corridor',
  Sadar: 'sadar-nagpur'
};

const routeTemplates = [
  ['sadar-nagpur', 'ring-road', 'airport-corridor'],
  ['sadar-nagpur', 'wardha-road', 'ring-road', 'airport-corridor'],
  ['sadar-nagpur', 'central-avenue', 'ring-road', 'airport-corridor'],
  ['wardha-road', 'sadar-nagpur', 'ring-road', 'airport-corridor'],
  ['central-avenue', 'sadar-nagpur', 'ring-road', 'airport-corridor'],
  ['airport-corridor', 'ring-road', 'sadar-nagpur', 'cotton-market'],
  ['ring-road', 'sadar-nagpur', 'cotton-market'],
  ['wardha-road', 'sadar-nagpur', 'cotton-market'],
  ['central-avenue', 'sadar-nagpur', 'cotton-market']
];

const prisma = require('../config/database');

async function getRoadState() {
  // Start with fallback roads
  const roads = fallbackRoads.map((r) => ({ ...r }));
  try {
    const incidents = await prisma.incident.findMany({ where: { status: 'ACTIVE' } });
    incidents.forEach((inc) => {
      if (!inc.road) return;
      const road = roads.find((r) => r.id === inc.road || r.name === inc.road);
      if (road) {
        road.incident = (inc.type || 'OTHER').toLowerCase();
        // increase utilization and delay based on severity
        if (inc.severity === 'CRITICAL') { road.utilization = Math.min(220, (road.utilization || 0) + 40); road.delay = (road.delay || 0) + 25; }
        else if (inc.severity === 'HIGH') { road.utilization = Math.min(220, (road.utilization || 0) + 25); road.delay = (road.delay || 0) + 15; }
        else if (inc.severity === 'MEDIUM') { road.utilization = Math.min(220, (road.utilization || 0) + 12); road.delay = (road.delay || 0) + 8; }
        else { road.utilization = Math.min(220, (road.utilization || 0) + 6); road.delay = (road.delay || 0) + 4; }
      }
    });
  } catch (e) {
    // ignore DB errors and return fallback
  }
  return roads;
}

async function normalizeRoadId(value) {
  if (!value) return null;
  const match = Object.entries(locationMap).find(([label]) => label.toLowerCase() === String(value).trim().toLowerCase());
  if (match) return match[1];
  const lookup = String(value).trim().toLowerCase();
  const roads = await getRoadState();
  const road = roads.find((item) => item.id.toLowerCase() === lookup || item.name.toLowerCase() === lookup);
  return road ? road.id : null;
}

async function buildGraph() {
  const roads = await getRoadState();
  const roadsById = Object.fromEntries(roads.map((road) => [road.id, road]));
  const graph = new Map();

  roads.forEach((road) => {
    const neighbors = new Set();
    (road.downstreamRoads || []).forEach((id) => { if (roadsById[id]) neighbors.add(id); });
    (road.upstreamRoads || []).forEach((id) => { if (roadsById[id]) neighbors.add(id); });

    const entries = [...neighbors].map((neighborId) => ({ to: neighborId, road: roadsById[neighborId] || road, from: road.id }));
    graph.set(road.id, entries);
  });

  // fallback edges
  const fallbackEdges = {
    'airport-corridor': ['ring-road'],
    'ring-road': ['airport-corridor', 'sadar-nagpur'],
    'wardha-road': ['sadar-nagpur'],
    'central-avenue': ['sadar-nagpur'],
    'sadar-nagpur': ['ring-road', 'wardha-road', 'central-avenue', 'cotton-market'],
    'cotton-market': []
  };

  Object.entries(fallbackEdges).forEach(([from, neighbors]) => {
    const current = graph.get(from) || [];
    neighbors.forEach((to) => {
      if (to === from) return;
      if (!current.some((entry) => entry.to === to)) {
        current.push({ to, road: roadsById[to] || { id: to, name: to, utilization: 0 }, from });
      }
    });
    graph.set(from, current);
  });

  return { graph, roadsById };
}

module.exports = {
  getRoadState,
  buildGraph,
  normalizeRoadId,
  routeTemplates
};
