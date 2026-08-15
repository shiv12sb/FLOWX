(function () {
  const ROUTE_HISTORY_KEY = 'flowx-smart-routing-history';
  const ROUTE_CONTEXT_KEY = 'flowx-smart-routing-context';

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

  const state = {
    map: null,
    routeLayer: null,
    routes: [],
    selectedRouteId: null,
    lastRecommendation: null,
    lastSimulationSnapshot: null,
    history: []
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getRoadState() {
    const engine = window.FlowXTrafficEngine;
    if (engine && engine.getState) {
      const snapshot = engine.getState();
      if (snapshot && Array.isArray(snapshot.roads) && snapshot.roads.length) {
        return snapshot.roads;
      }
    }
    return fallbackRoads;
  }

  function normalizeRoadId(value) {
    if (!value) return null;
    const match = Object.entries(locationMap).find(([label]) => label.toLowerCase() === String(value).trim().toLowerCase());
    if (match) return match[1];
    const lookup = String(value).trim().toLowerCase();
    const road = getRoadState().find((item) => item.id.toLowerCase() === lookup || item.name.toLowerCase() === lookup);
    return road ? road.id : null;
  }

  function buildGraph() {
    const roads = getRoadState();
    const roadsById = Object.fromEntries(roads.map((road) => [road.id, road]));
    const graph = new Map();

    roads.forEach((road) => {
      const neighbors = new Set();
      (road.downstreamRoads || []).forEach((id) => {
        if (roadsById[id]) neighbors.add(id);
      });
      (road.upstreamRoads || []).forEach((id) => {
        if (roadsById[id]) neighbors.add(id);
      });

      const entries = [...neighbors].map((neighborId) => ({
        to: neighborId,
        road: roadsById[neighborId] || road,
        from: road.id
      }));

      graph.set(road.id, entries);
    });

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

  function costOfRoad(road) {
    const utilization = safeNumber(road.utilization, 0);
    const speed = Math.max(8, safeNumber(road.averageSpeed, safeNumber(road.maxSpeed, 32)));
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

    let weatherPenalty = 0;
    const weatherScenario = window.FlowXWeatherEngine && typeof window.FlowXWeatherEngine.getCurrentScenario === 'function'
      ? window.FlowXWeatherEngine.getCurrentScenario()
      : null;
    if (weatherScenario) {
      weatherPenalty = (weatherScenario.impactScore || 0) * 0.08 + (weatherScenario.speedReduction || 0) * 12;
    }

    return travelTime + congestionPenalty + incidentPenalty + capacityPenalty + weatherPenalty + 2.5;
  }

  function dijkstra(startId, endId, graph, blockedEdges = new Set()) {
    const distances = new Map();
    const previous = new Map();
    const queue = [{ id: startId, cost: 0 }];
    distances.set(startId, 0);

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
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

    if (!distances.has(endId)) {
      return null;
    }

    const nodes = [];
    let current = endId;
    while (current) {
      nodes.unshift(current);
      current = previous.get(current) || null;
    }

    const roadSequence = [];
    for (let index = 0; index < nodes.length - 1; index += 1) {
      const from = nodes[index];
      const to = nodes[index + 1];
      const neighbor = (graph.get(from) || []).find((entry) => entry.to === to);
      if (neighbor) roadSequence.push(neighbor.road);
    }

    const totalDistance = roadSequence.reduce((sum, road) => sum + safeNumber(road.length, 3), 0);
    const avgSpeed = roadSequence.length ? roadSequence.reduce((sum, road) => sum + safeNumber(road.averageSpeed, safeNumber(road.maxSpeed, 35)), 0) / roadSequence.length : 0;
    const avgUtilization = roadSequence.length ? roadSequence.reduce((sum, road) => sum + safeNumber(road.utilization, 0), 0) / roadSequence.length : 0;
    const delay = roadSequence.reduce((sum, road) => sum + safeNumber(road.delay, 0), 0);
    const incidents = roadSequence.filter((road) => Boolean(road.incident)).length;
    const etaMinutes = Math.max(8, Number((totalDistance / Math.max(avgSpeed, 10)) * 18));

    return {
      id: `route-${Math.random().toString(36).slice(2, 8)}`,
      nodes,
      roadSequence,
      totalCost: distances.get(endId),
      distanceKm: Number(totalDistance.toFixed(1)),
      etaMinutes: Number(etaMinutes.toFixed(0)),
      avgSpeed: Number(avgSpeed.toFixed(1)),
      averageUtilization: Number(avgUtilization.toFixed(1)),
      delay: Number(delay.toFixed(0)),
      incidents,
      status: getCongestionLabel(avgUtilization),
      score: 100 - (distances.get(endId) * 2.4) - incidents * 6 + (100 - avgUtilization) * 0.35
    };
  }

  function getCongestionLabel(utilization) {
    if (utilization >= 120) return 'HIGH CONGESTION';
    if (utilization >= 80) return 'MODERATE';
    if (utilization >= 55) return 'WATCH';
    return 'SMOOTH';
  }

  function summarizeRoute(nodes) {
    const { graph, roadsById } = buildGraph();
    const roadSequence = [];

    for (let index = 0; index < nodes.length - 1; index += 1) {
      const from = nodes[index];
      const to = nodes[index + 1];
      const edge = (graph.get(from) || []).find((entry) => entry.to === to);
      if (edge) {
        roadSequence.push(edge.road || roadsById[to] || roadsById[from]);
      } else {
        const fallback = roadsById[to] || roadsById[from];
        if (fallback) roadSequence.push(fallback);
      }
    }

    const totalDistance = roadSequence.reduce((sum, road) => sum + safeNumber(road.length, 3), 0);
    const avgSpeed = roadSequence.length ? roadSequence.reduce((sum, road) => sum + safeNumber(road.averageSpeed, safeNumber(road.maxSpeed, 35)), 0) / roadSequence.length : 0;
    const avgUtilization = roadSequence.length ? roadSequence.reduce((sum, road) => sum + safeNumber(road.utilization, 0), 0) / roadSequence.length : 0;
    const delay = roadSequence.reduce((sum, road) => sum + safeNumber(road.delay, 0), 0);
    const incidents = roadSequence.filter((road) => Boolean(road.incident)).length;
    const etaMinutes = Math.max(8, Number((totalDistance / Math.max(avgSpeed, 10)) * 18));
    const totalCost = roadSequence.reduce((sum, road) => sum + costOfRoad(road), 0);

    return {
      id: `route-${Math.random().toString(36).slice(2, 8)}`,
      nodes,
      roadSequence,
      totalCost,
      distanceKm: Number(totalDistance.toFixed(1)),
      etaMinutes: Number(etaMinutes.toFixed(0)),
      avgSpeed: Number(avgSpeed.toFixed(1)),
      averageUtilization: Number(avgUtilization.toFixed(1)),
      delay: Number(delay.toFixed(0)),
      incidents,
      status: getCongestionLabel(avgUtilization),
      score: 100 - totalCost * 2.4 - incidents * 6 + (100 - avgUtilization) * 0.35
    };
  }

  function buildTemplateRoutes(startId, endId) {
    if (!startId || !endId || startId === endId) return [];

    const directCandidates = routeTemplates
      .filter((path) => path.includes(startId) && path.includes(endId))
      .map((path) => path.filter((segment, index, nodes) => nodes.indexOf(segment) === index));

    if (directCandidates.length) {
      return directCandidates.slice(0, 3);
    }

    if (startId === 'sadar-nagpur' && endId === 'airport-corridor') {
      return [
        ['sadar-nagpur', 'ring-road', 'airport-corridor'],
        ['sadar-nagpur', 'wardha-road', 'ring-road', 'airport-corridor']
      ];
    }

    if (startId === 'wardha-road' && endId === 'airport-corridor') {
      return [
        ['wardha-road', 'sadar-nagpur', 'ring-road', 'airport-corridor'],
        ['wardha-road', 'ring-road', 'airport-corridor']
      ];
    }

    if (startId === 'central-avenue' && endId === 'airport-corridor') {
      return [
        ['central-avenue', 'sadar-nagpur', 'ring-road', 'airport-corridor'],
        ['central-avenue', 'ring-road', 'airport-corridor']
      ];
    }

    return [[startId, endId]];
  }

  function generateRoutes(startId, endId) {
    const templatePaths = buildTemplateRoutes(startId, endId);
    const candidatePaths = [];
    const seen = new Set();

    if (templatePaths.length) {
      templatePaths.forEach((path) => {
        const signature = path.join('>');
        if (!seen.has(signature)) {
          seen.add(signature);
          candidatePaths.push(path);
        }
      });
    }

    if (!candidatePaths.length) {
      const { graph } = buildGraph();
      function walk(currentId, targetId, path, visited) {
        if (path.length > 8) return;
        if (currentId === targetId && path.length > 1) {
          const signature = path.join('>');
          if (!seen.has(signature)) {
            seen.add(signature);
            candidatePaths.push(path);
          }
          return;
        }

        const neighbors = (graph.get(currentId) || []).map((entry) => entry.to).filter((id) => id !== currentId && !visited.has(id));
        if (!neighbors.length) return;

        neighbors.forEach((neighborId) => {
          const nextVisited = new Set(visited);
          nextVisited.add(currentId);
          walk(neighborId, targetId, [...path, neighborId], nextVisited);
        });
      }

      if (startId && endId && startId !== endId) {
        walk(startId, endId, [startId], new Set([startId]));
      }
    }

    const routes = candidatePaths
      .map((path) => summarizeRoute(path))
      .filter((route) => route && route.roadSequence && route.roadSequence.length)
      .sort((a, b) => a.totalCost - b.totalCost);

    if (!routes.length) {
      return [];
    }

    return routes.slice(0, 3);
  }

  function renderRouteCards(routes) {
    const container = document.getElementById('route-card-list');
    if (!container) return;

    if (!routes.length) {
      container.innerHTML = '<div class="route-empty">No viable route found for the current network.</div>';
      return;
    }

    const best = routes[0];
    container.innerHTML = routes.map((route, index) => {
      const isBest = index === 0;
      return `
        <article class="route-card ${isBest ? 'route-card--selected' : ''}" data-route-id="${route.id}">
          <div class="route-card__top">
            <div>
              <div class="route-card__label">Route ${String.fromCharCode(65 + index)}</div>
              <h3 class="route-card__title">${isBest ? 'Recommended' : 'Alternative'} Route</h3>
            </div>
            <span class="route-card__tag ${isBest ? 'route-card__tag--recommended' : ''}">${isBest ? 'Recommended' : 'Alternative'}</span>
          </div>
          <div class="route-card__metrics">
            <div><span>ETA</span><strong>${route.etaMinutes} min</strong></div>
            <div><span>Distance</span><strong>${route.distanceKm} km</strong></div>
            <div><span>Avg. Speed</span><strong>${route.avgSpeed} km/h</strong></div>
            <div><span>Traffic</span><strong>${route.averageUtilization}%</strong></div>
            <div><span>Delay</span><strong>${route.delay} min</strong></div>
            <div><span>Congestion</span><strong>${route.status}</strong></div>
          </div>
          <div class="route-card__footer">
            <span>Potential Time Saved: ${Math.max(0, Math.round(best.etaMinutes - route.etaMinutes))} min</span>
            <button type="button" class="button button--ghost route-view-btn" data-route-id="${route.id}">VIEW ROUTE</button>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.route-view-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const routeId = button.dataset.routeId;
        state.selectedRouteId = routeId;
        renderMap();
        updateRecommendationPanel();
      });
    });
  }

  function getRouteComparison(routes) {
    const best = [...routes].sort((a, b) => a.totalCost - b.totalCost)[0];
    const fastest = [...routes].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
    const shortest = [...routes].sort((a, b) => a.distanceKm - b.distanceKm)[0];
    const lowestCongestion = [...routes].sort((a, b) => a.averageUtilization - b.averageUtilization)[0];

    return [
      { label: 'BEST OVERALL', route: best },
      { label: 'FASTEST', route: fastest },
      { label: 'SHORTEST', route: shortest },
      { label: 'LOWEST CONGESTION', route: lowestCongestion }
    ];
  }

  function renderComparison(routes) {
    const panel = document.getElementById('route-comparison-panel');
    if (!panel) return;

    if (!routes.length) {
      panel.innerHTML = '<p class="route-empty">No route data available.</p>';
      return;
    }

    const comparison = getRouteComparison(routes);
    panel.innerHTML = comparison.map((item) => `
      <div class="route-comparison-item">
        <span class="route-comparison-item__label">${item.label}</span>
        <strong>${item.route?.nodes?.length ? 'Route ' + String.fromCharCode(65 + routes.indexOf(item.route)) : 'Route A'}</strong>
      </div>
    `).join('');
  }

  function getBestRoute() {
    if (!state.routes.length) return null;
    const selected = state.routes.find((route) => route.id === state.selectedRouteId) || state.routes[0];
    return selected;
  }

  function computeDiversionRecommendation(currentRoad, alternativeRoad, currentRoute, alternativeRoute) {
    const currentUtil = safeNumber(currentRoad.utilization, 0);
    const altUtil = safeNumber(alternativeRoad.utilization, 0);
    const currentCapacity = safeNumber(currentRoad.capacityPerMinute, 1);
    const alternativeCapacity = safeNumber(alternativeRoad.capacityPerMinute, 1);
    const currentVehicles = safeNumber(currentRoad.currentVehicles, 0);
    const alternativeVehicles = safeNumber(alternativeRoad.currentVehicles, 0);

    const availableAlternativeCapacity = Math.max(0, alternativeCapacity * (1 - Math.min(altUtil / 100, 0.9)));
    const diversionBase = clamp(((currentUtil - 100) / 120) * 0.52 + (altUtil < 70 ? 0.18 : 0.08), 0.05, 0.4);
    const safeLimit = clamp((availableAlternativeCapacity / Math.max(currentCapacity, 1)) * 0.75, 0.05, 0.4);
    const recommendedPercent = clamp(Math.min(diversionBase, safeLimit), 0, 0.4);
    const recommendedVehicles = Math.round(currentVehicles * recommendedPercent);
    const expectedCurrentUtilAfter = clamp(currentUtil * (1 - recommendedPercent), 0, 220);
    const expectedAltUtilAfter = clamp(altUtil + (recommendedVehicles / Math.max(1, alternativeCapacity * 0.32)) * 100, 0, 220);
    const congestionImprovement = Math.max(0, currentUtil - expectedCurrentUtilAfter);
    const potentialTimeSaved = Math.max(0, Math.round((safeNumber(currentRoute?.etaMinutes, 0) || 0) - (safeNumber(alternativeRoute?.etaMinutes, 0) || 0)));

    return {
      recommendedPercent: Number((recommendedPercent * 100).toFixed(0)),
      recommendedVehicles,
      expectedCurrentUtilAfter: Number(expectedCurrentUtilAfter.toFixed(1)),
      expectedAltUtilAfter: Number(expectedAltUtilAfter.toFixed(1)),
      congestionImprovement: Number(congestionImprovement.toFixed(0)),
      potentialTimeSaved: Number(Math.max(0, potentialTimeSaved).toFixed(0)),
      currentVehicles,
      alternativeVehicles,
      altUtil,
      currentUtil,
      recommendedPercentDecimal: recommendedPercent
    };
  }

  function getDiversionRoads(bestRoute, altRoute) {
    const safeRoads = (roadList) => (Array.isArray(roadList) ? roadList.filter(Boolean) : []);
    const bestRoads = safeRoads(bestRoute?.roadSequence);
    const altRoads = safeRoads(altRoute?.roadSequence);
    const allRoads = getRoadState();

    let currentRoad = bestRoads.reduce((highest, road) => {
      return safeNumber(road.utilization, 0) > safeNumber(highest.utilization, 0) ? road : highest;
    }, bestRoads[0] || { utilization: 0, name: 'Current route' });

    const candidateAltRoads = allRoads.filter((road) => road && road.id !== currentRoad.id && road.name !== currentRoad.name);
    let altRoad = candidateAltRoads.sort((a, b) => safeNumber(a.utilization, 0) - safeNumber(b.utilization, 0))[0]
      || altRoads.find((road) => road && road.id !== currentRoad.id && road.name !== currentRoad.name)
      || { utilization: 0, name: 'Alternative route' };

    if (!currentRoad || !currentRoad.name) {
      currentRoad = allRoads[0] || { utilization: 0, name: 'Current route' };
    }

    if (!altRoad || !altRoad.name || altRoad.name === currentRoad.name || altRoad.id === currentRoad.id) {
      const fallback = allRoads.find((road) => road && road.id !== currentRoad.id && road.name !== currentRoad.name) || allRoads[1] || { utilization: 0, name: 'Alternative route' };
      altRoad = fallback;
    }

    return { currentRoad, altRoad };
  }

  function renderRecommendationPanel() {
    const panel = document.getElementById('recommendation-panel-body');
    if (!panel) return;

    if (!state.routes.length) {
      panel.innerHTML = '<p class="route-empty">Select a valid origin and destination to calculate routing advice.</p>';
      return;
    }

    const bestRoute = getBestRoute();
    const altRoute = state.routes.find((route) => route.id !== bestRoute.id) || bestRoute;
    const { currentRoad, altRoad } = getDiversionRoads(bestRoute, altRoute);
    const diversion = computeDiversionRecommendation(currentRoad, altRoad, bestRoute, altRoute);

    const statusTone = currentRoad.utilization >= 120 ? 'alert' : currentRoad.utilization >= 80 ? 'warning' : 'ok';

    panel.innerHTML = `
      <div class="recommendation-panel ${statusTone === 'alert' ? 'recommendation-panel--alert' : statusTone === 'warning' ? 'recommendation-panel--warning' : 'recommendation-panel--ok'}">
        <div class="recommendation-panel__header">
          <span class="recommendation-panel__priority">${currentRoad.utilization >= 120 ? 'HIGH CONGESTION DETECTED' : 'TRAFFIC-AWARE ROUTE PLAN'}</span>
          <span class="recommendation-panel__route">${currentRoad.name}</span>
        </div>
        <div class="recommendation-panel__metrics">
          <div><span>Current utilization</span><strong>${currentRoad.utilization}%</strong></div>
          <div><span>Current ETA</span><strong>${bestRoute.etaMinutes} min</strong></div>
          <div><span>Alternative ETA</span><strong>${altRoute.etaMinutes} min</strong></div>
          <div><span>Potential time saved</span><strong>${diversion.potentialTimeSaved} min</strong></div>
          <div><span>Expected improvement</span><strong>${diversion.congestionImprovement} percentage points</strong></div>
          <div><span>Recommended diversion</span><strong>${diversion.recommendedPercent}%</strong></div>
        </div>
        <p class="recommendation-panel__summary">
          Redirect approximately ${diversion.recommendedPercent}% of traffic from ${currentRoad.name} toward ${altRoad.name} to lower network pressure and improve corridor travel time.
        </p>
        <div class="recommendation-panel__scenario">
          <strong>Scenario</strong>
          <p>Before: ${currentRoad.name} ${currentRoad.utilization}% · ${altRoad.name} ${altRoad.utilization}%</p>
          <p>After simulation: ${currentRoad.name} ${diversion.expectedCurrentUtilAfter}% · ${altRoad.name} ${diversion.expectedAltUtilAfter}%</p>
        </div>
        <div class="recommendation-panel__actions">
          <button type="button" class="button button--primary" id="apply-simulation-btn">APPLY SIMULATION</button>
          <button type="button" class="button button--ghost" id="view-alt-route-btn">VIEW ALTERNATIVE ROUTE</button>
          <button type="button" class="button button--ghost" id="reset-simulation-btn">RESET SIMULATION</button>
        </div>
      </div>
    `;

    document.getElementById('apply-simulation-btn')?.addEventListener('click', applySimulationDiversion);
    document.getElementById('view-alt-route-btn')?.addEventListener('click', () => {
      const alt = state.routes.find((route) => route.id !== getBestRoute().id) || state.routes[1] || state.routes[0];
      if (alt) {
        state.selectedRouteId = alt.id;
        renderMap();
        updateRecommendationPanel();
      }
    });
    document.getElementById('reset-simulation-btn')?.addEventListener('click', resetSimulationState);
  }

  function updateRecommendationPanel() {
    renderRecommendationPanel();
    renderRouteCards(state.routes);
  }

  function renderHistory() {
    const panel = document.getElementById('route-history-panel');
    if (!panel) return;

    const stored = JSON.parse(localStorage.getItem(ROUTE_HISTORY_KEY) || '[]');
    state.history = stored.length ? stored : [
      { origin: 'Sitabuldi', destination: 'MIHAN', eta: '18 min', age: '2 min ago' },
      { origin: 'Civil Lines', destination: 'Airport', eta: '24 min', age: '5 min ago' }
    ];

    if (!state.history.length) {
      panel.innerHTML = '<p class="route-empty">No recent route searches yet.</p>';
      return;
    }

    panel.innerHTML = state.history.slice(0, 4).map((item) => `
      <div class="history-item">
        <div class="history-item__title">${item.origin} → ${item.destination}</div>
        <div class="history-item__meta">
          <span>${item.eta}</span>
          <span>${item.age}</span>
        </div>
      </div>
    `).join('');
  }

  function addHistoryEntry(origin, destination, etaMinutes) {
    const next = {
      origin,
      destination,
      eta: `${etaMinutes} min`,
      age: 'now'
    };

    const history = JSON.parse(localStorage.getItem(ROUTE_HISTORY_KEY) || '[]');
    const merged = [next, ...history].slice(0, 5);
    localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(merged));
    state.history = merged;
    renderHistory();
  }

  function buildRouteDescription(route) {
    const nodes = route.nodes.map((node) => {
      const road = getRoadState().find((item) => item.id === node);
      return road ? road.name : node;
    });
    return nodes.join(' → ');
  }

  function renderMap() {
    if (!document.getElementById('routing-map')) return;

    if (!state.map) {
      state.map = L.map('routing-map', { zoomControl: true, scrollWheelZoom: true }).setView([21.1458, 79.0882], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(state.map);
      state.routeLayer = L.layerGroup().addTo(state.map);
    }

    if (!state.routeLayer) return;
    state.routeLayer.clearLayers();

    const selectedRoute = state.routes.find((route) => route.id === state.selectedRouteId) || state.routes[0];
    const roads = getRoadState();
    const roadCoordinates = {
      'ring-road': [[21.1752, 79.0587], [21.1678, 79.0811], [21.1606, 79.0915], [21.1504, 79.0902], [21.1431, 79.0824]],
      'wardha-road': [[21.1479, 79.0718], [21.1452, 79.0874], [21.1396, 79.1062]],
      'central-avenue': [[21.1546, 79.0919], [21.1462, 79.0967], [21.1389, 79.1045], [21.1275, 79.1119]],
      'sadar-nagpur': [[21.1339, 79.0718], [21.1387, 79.0845], [21.1413, 79.1004], [21.1468, 79.1162]],
      'cotton-market': [[21.1609, 79.1091], [21.1538, 79.1064], [21.1475, 79.1013], [21.1419, 79.0986]],
      'airport-corridor': [[21.1124, 79.0469], [21.1221, 79.0537], [21.1294, 79.0621], [21.1396, 79.0703]]
    };

    const routeToDraw = state.routes.map((route) => ({
      ...route,
      isSelected: selectedRoute && route.id === selectedRoute.id
    }));

    routeToDraw.forEach((route) => {
      if (!route.roadSequence || !route.roadSequence.length) return;
      const points = route.roadSequence.flatMap((road) => roadCoordinates[road.id] || []);
      if (!points.length) return;

      const routeColor = route.isSelected ? '#22c55e' : '#7dd3fc';
      const routeWeight = route.isSelected ? 7 : 4;
      const line = L.polyline(points, {
        color: routeColor,
        weight: routeWeight,
        opacity: route.isSelected ? 0.95 : 0.5,
        dashArray: route.isSelected ? null : '8 10'
      }).addTo(state.routeLayer);

      line.bindPopup(`<strong>${route.isSelected ? 'Recommended route' : 'Alternative route'}</strong><br>${buildRouteDescription(route)}<br>ETA: ${route.etaMinutes} min`);
    });

    const originId = normalizeLocationValue(document.getElementById('origin-select')?.value || 'Sitabuldi');
    const destinationId = normalizeLocationValue(document.getElementById('destination-select')?.value || 'MIHAN');

    const originRoad = roads.find((road) => road.id === originId) || roads[0];
    const destinationRoad = roads.find((road) => road.id === destinationId) || roads[roads.length - 1];

    const originCoords = roadCoordinates[originRoad.id] ? roadCoordinates[originRoad.id][0] : [21.1458, 79.0882];
    const destinationCoords = roadCoordinates[destinationRoad.id] ? roadCoordinates[destinationRoad.id][roadCoordinates[destinationRoad.id].length - 1] : [21.1124, 79.0469];

    const originMarker = L.marker(originCoords, { title: originRoad.name }).addTo(state.routeLayer);
    originMarker.bindPopup(`<strong>Origin</strong><br>${originRoad.name}`);

    const destinationMarker = L.marker(destinationCoords, { title: destinationRoad.name }).addTo(state.routeLayer);
    destinationMarker.bindPopup(`<strong>Destination</strong><br>${destinationRoad.name}`);

    if (selectedRoute && selectedRoute.roadSequence.length) {
      const selectedPoints = selectedRoute.roadSequence.flatMap((road) => roadCoordinates[road.id] || []);
      if (selectedPoints.length) {
        state.map.fitBounds(L.latLngBounds(selectedPoints), { padding: [30, 30], maxZoom: 13 });
      }
    }

    const badge = document.getElementById('route-map-badge');
    if (badge) {
      badge.textContent = selectedRoute ? 'Recommended Route Selected' : 'Network Ready';
    }
  }

  function normalizeLocationValue(value) {
    return normalizeRoadId(value) || locationMap[value] || value;
  }

  function resolveRouteSelection() {
    const originSelect = document.getElementById('origin-select');
    const destinationSelect = document.getElementById('destination-select');

    if (!originSelect || !destinationSelect) return;

    const originValue = originSelect.value.trim();
    const destinationValue = destinationSelect.value.trim();

    if (!originValue) {
      showMessage('Please select an origin.');
      return;
    }

    if (!destinationValue) {
      showMessage('Please select a destination.');
      return;
    }

    if (originValue === destinationValue) {
      showMessage('Origin and destination must be different.');
      return;
    }

    const startId = normalizeLocationValue(originValue);
    const endId = normalizeLocationValue(destinationValue);

    if (!startId || !endId) {
      showMessage('No viable route found for the current network.');
      return;
    }

    const generated = generateRoutes(startId, endId);
    if (!generated.length) {
      showMessage('No viable route found for the current network.');
      return;
    }

    state.routes = generated;
    state.selectedRouteId = generated[0].id;
    const route = generated[0];
    addHistoryEntry(originValue, destinationValue, route.etaMinutes);
    renderComparison(generated);
    renderRouteCards(generated);
    renderRecommendationPanel();
    renderMap();
  }

  function showMessage(message) {
    const panel = document.getElementById('recommendation-panel-body');
    if (!panel) return;
    panel.innerHTML = `<div class="route-empty">${message}</div>`;
  }

  function populateSelectors() {
    const startSelect = document.getElementById('origin-select');
    const endSelect = document.getElementById('destination-select');
    if (!startSelect || !endSelect) return;

    const options = [
      'Sitabuldi',
      'Civil Lines',
      'Wardha Road',
      'Ring Road',
      'Central Avenue',
      'Cotton Market',
      'Airport',
      'MIHAN'
    ];

    startSelect.innerHTML = options.map((option) => `<option value="${option}">${option}</option>`).join('');
    endSelect.innerHTML = options.map((option) => `<option value="${option}">${option}</option>`).join('');

    const saved = JSON.parse(localStorage.getItem(ROUTE_CONTEXT_KEY) || 'null');
    const defaultOrigin = saved?.origin || 'Sitabuldi';
    const defaultDestination = saved?.destination || 'MIHAN';

    startSelect.value = defaultOrigin;
    endSelect.value = defaultDestination;
  }

  function swapRouteInputs() {
    const originSelect = document.getElementById('origin-select');
    const destinationSelect = document.getElementById('destination-select');
    if (!originSelect || !destinationSelect) return;
    const temp = originSelect.value;
    originSelect.value = destinationSelect.value;
    destinationSelect.value = temp;
    resolveRouteSelection();
  }

  function applySimulationDiversion() {
    const bestRoute = getBestRoute();
    if (!bestRoute) return;

    const congestedRoad = bestRoute.roadSequence.reduce((highest, road) => {
      return safeNumber(road.utilization, 0) > safeNumber(highest.utilization, 0) ? road : highest;
    }, bestRoute.roadSequence[0] || { utilization: 0, currentVehicles: 0, id: null });

    const alternativeRoute = state.routes.find((route) => route.id !== bestRoute.id) || state.routes[0];
    const alternativeRoad = alternativeRoute.roadSequence.reduce((highest, road) => {
      return safeNumber(road.utilization, 0) < safeNumber(highest.utilization, 0) ? road : highest;
    }, alternativeRoute.roadSequence[0] || { utilization: 0, currentVehicles: 0, id: null });

    const engine = window.FlowXTrafficEngine;
    if (!engine || !congestedRoad.id || !alternativeRoad.id) return;

    state.lastSimulationSnapshot = JSON.stringify(engine.getState());

    const diversion = computeDiversionRecommendation(congestedRoad, alternativeRoad, bestRoute, alternativeRoute);
    const share = diversion.recommendedPercentDecimal;

    engine.roads.forEach((road) => {
      if (road.id === congestedRoad.id) {
        const nextVehicles = Math.max(0, safeNumber(road.currentVehicles, 0) * (1 - share));
        road.currentVehicles = nextVehicles;
      }

      if (road.id === alternativeRoad.id) {
        const nextVehicles = Math.min(
          safeNumber(road.maxVehicles, safeNumber(road.capacityPerMinute, 200) * 1.45),
          safeNumber(road.currentVehicles, 0) + Math.round(safeNumber(congestedRoad.currentVehicles, 0) * share * 0.7)
        );
        road.currentVehicles = nextVehicles;
      }
    });

    engine.recalculateRoadMetrics();
    engine.publishState();

    const simulationMessage = document.createElement('div');
    simulationMessage.className = 'route-status-message';
    simulationMessage.textContent = '✓ SIMULATION APPLIED — Traffic redistribution is simulated only.';

    const existing = document.querySelector('.route-status-message');
    if (existing) existing.remove();
    const recommendationPanel = document.getElementById('recommendation-panel-body');
    if (recommendationPanel) recommendationPanel.appendChild(simulationMessage);

    state.routes = generateRoutes(normalizeLocationValue(document.getElementById('origin-select').value), normalizeLocationValue(document.getElementById('destination-select').value));
    state.selectedRouteId = state.routes[0]?.id || state.selectedRouteId;
    renderComparison(state.routes);
    renderRouteCards(state.routes);
    renderRecommendationPanel();
    renderMap();
  }

  function resetSimulationState() {
    const engine = window.FlowXTrafficEngine;
    if (!engine || !state.lastSimulationSnapshot) return;

    const snapshot = JSON.parse(state.lastSimulationSnapshot);
    engine.roads = snapshot.roads || engine.roads;
    engine.roadsById = Object.fromEntries((engine.roads || []).map((road) => [road.id, road]));
    engine.recalculateRoadMetrics();
    engine.publishState();

    const message = document.querySelector('.route-status-message');
    if (message) message.remove();

    state.routes = generateRoutes(normalizeLocationValue(document.getElementById('origin-select').value), normalizeLocationValue(document.getElementById('destination-select').value));
    state.selectedRouteId = state.routes[0]?.id || state.selectedRouteId;
    renderComparison(state.routes);
    renderRouteCards(state.routes);
    renderRecommendationPanel();
    renderMap();
  }

  function setupForm() {
    populateSelectors();
    renderHistory();

    const form = document.getElementById('routing-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        resolveRouteSelection();
      });
    }

    const swapButton = document.getElementById('swap-route-btn');
    if (swapButton) {
      swapButton.addEventListener('click', swapRouteInputs);
    }

    const context = JSON.parse(localStorage.getItem(ROUTE_CONTEXT_KEY) || 'null');
    if (context && context.origin && context.destination) {
      const originSelect = document.getElementById('origin-select');
      const destinationSelect = document.getElementById('destination-select');
      if (originSelect) originSelect.value = context.origin;
      if (destinationSelect) destinationSelect.value = context.destination;
    }

    resolveRouteSelection();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupForm();
  });
})();
