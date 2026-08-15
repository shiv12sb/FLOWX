(function () {
  const PRIORITY_SEQUENCE = ['CRITICAL', 'HIGH', 'NORMAL'];
  const priorityScores = { CRITICAL: 3, HIGH: 2, NORMAL: 1 };

  const roadCoordinates = {
    'ring-road': [[21.1752, 79.0587], [21.1678, 79.0811], [21.1606, 79.0915], [21.1504, 79.0902], [21.1431, 79.0824]],
    'wardha-road': [[21.1479, 79.0718], [21.1452, 79.0874], [21.1396, 79.1062]],
    'central-avenue': [[21.1546, 79.0919], [21.1462, 79.0967], [21.1389, 79.1045], [21.1275, 79.1119]],
    'sadar-nagpur': [[21.1339, 79.0718], [21.1387, 79.0845], [21.1413, 79.1004], [21.1468, 79.1162]],
    'cotton-market': [[21.1609, 79.1091], [21.1538, 79.1064], [21.1475, 79.1013], [21.1419, 79.0986]],
    'airport-corridor': [[21.1124, 79.0469], [21.1221, 79.0537], [21.1294, 79.0621], [21.1396, 79.0703]],
    'city-hospital': [[21.1507, 79.0973], [21.1488, 79.0981], [21.1471, 79.0992]],
    'civil-hospital': [[21.1365, 79.0851], [21.1378, 79.0870], [21.1390, 79.0895]],
    'emergency-center': [[21.1683, 79.0806], [21.1671, 79.0837], [21.1650, 79.0859]],
    'fire-station': [[21.1523, 79.1044], [21.1509, 79.1031], [21.1493, 79.1018]],
    'police-hq': [[21.1612, 79.0609], [21.1599, 79.0660], [21.1578, 79.0701]],
    'junction-central': [[21.1447, 79.0886], [21.1430, 79.0911], [21.1419, 79.0942]],
    'junction-ring': [[21.1589, 79.0876], [21.1548, 79.0891], [21.1514, 79.0905]],
    'junction-market': [[21.1508, 79.1034], [21.1487, 79.1016], [21.1469, 79.0998]],
    'central-square': [[21.1482, 79.0904], [21.1458, 79.0900], [21.1434, 79.0907]],
    'airport-junction': [[21.1399, 79.0696], [21.1402, 79.0767], [21.1410, 79.0827]]
  };

  const emergencyLocations = {
    'Central Square': { id: 'central-square', coords: [21.1458, 79.0900], roadId: 'sadar-nagpur', type: 'intersection' },
    'City Hospital': { id: 'city-hospital', coords: [21.1492, 79.0998], roadId: 'central-avenue', type: 'destination' },
    'Civil Hospital': { id: 'civil-hospital', coords: [21.1381, 79.0875], roadId: 'sadar-nagpur', type: 'destination' },
    'Emergency Center': { id: 'emergency-center', coords: [21.1662, 79.0836], roadId: 'ring-road', type: 'destination' },
    'Fire Station': { id: 'fire-station', coords: [21.1509, 79.1024], roadId: 'cotton-market', type: 'destination' },
    'Police HQ': { id: 'police-hq', coords: [21.1590, 79.0668], roadId: 'ring-road', type: 'destination' },
    'Ring Junction': { id: 'junction-ring', coords: [21.1557, 79.0892], roadId: 'ring-road', type: 'intersection' },
    'Airport Junction': { id: 'airport-junction', coords: [21.1409, 79.0730], roadId: 'airport-corridor', type: 'intersection' },
    'Cotton Market': { id: 'junction-market', coords: [21.1487, 79.1014], roadId: 'cotton-market', type: 'intersection' },
    'Wardha Road': { id: 'wardha-road', coords: [21.1432, 79.0847], roadId: 'wardha-road', type: 'road' },
    'Sadar Nagpur': { id: 'sadar-nagpur', coords: [21.1412, 79.0893], roadId: 'sadar-nagpur', type: 'road' },
    'Airport Corridor': { id: 'airport-corridor', coords: [21.1306, 79.0608], roadId: 'airport-corridor', type: 'road' },
    'Ring Road': { id: 'ring-road', coords: [21.1590, 79.0812], roadId: 'ring-road', type: 'road' }
  };

  const roadGraph = {
    'wardha-road': ['sadar-nagpur', 'ring-road'],
    'sadar-nagpur': ['wardha-road', 'central-avenue', 'ring-road', 'cotton-market'],
    'central-avenue': ['sadar-nagpur', 'city-hospital'],
    'ring-road': ['sadar-nagpur', 'wardha-road', 'airport-corridor'],
    'airport-corridor': ['ring-road', 'airport-junction'],
    'cotton-market': ['sadar-nagpur', 'junction-market'],
    'city-hospital': ['central-avenue'],
    'civil-hospital': ['sadar-nagpur'],
    'emergency-center': ['ring-road'],
    'fire-station': ['cotton-market'],
    'police-hq': ['ring-road'],
    'central-square': ['sadar-nagpur', 'wardha-road'],
    'junction-ring': ['ring-road', 'airport-corridor'],
    'junction-market': ['cotton-market', 'sadar-nagpur'],
    'airport-junction': ['airport-corridor', 'ring-road']
  };

  const emergencyState = {
    simulationEnabled: true,
    activeEmergencies: [],
    history: [],
    priorityQueue: [],
    eventLog: [],
    map: null,
    mapLayer: null,
    routeMarkers: [],
    selectedVehicleId: null,
    timerId: null,
    lastAlertMessage: 'TRAFFIC FLOW NORMAL'
  };

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  }

  function logEvent(message, level = 'INFO') {
    const entry = { time: formatTime(), message, level };
    emergencyState.eventLog.unshift(entry);
    emergencyState.eventLog = emergencyState.eventLog.slice(0, 12);
  }

  function getVehicleTypeLabel(type) {
    const map = { AMBULANCE: 'AMBULANCE', 'FIRE TRUCK': 'FIRE TRUCK', POLICE: 'POLICE' };
    return map[type] || type;
  }

  function getPriorityForType(type) {
    if (type === 'AMBULANCE') return 'CRITICAL';
    if (type === 'FIRE TRUCK') return 'CRITICAL';
    if (type === 'POLICE') return 'HIGH';
    return 'NORMAL';
  }

  function inferPriority(vehicle) {
    return vehicle.priorityLevel || getPriorityForType(vehicle.type) || 'NORMAL';
  }

  function resolveNodeId(value) {
    if (!value) return null;
    const input = String(value).trim();
    if (!input) return null;
    const direct = emergencyLocations[input];
    if (direct) return direct.id;
    const match = Object.entries(emergencyLocations).find(([label]) => label.toLowerCase() === input.toLowerCase());
    if (match) return match[1].id;
    return input.toLowerCase().replace(/\s+/g, '-');
  }

  function computeRoute(origin, destination) {
    const start = resolveNodeId(origin);
    const end = resolveNodeId(destination);
    if (!start || !end || !roadGraph[start] || !roadGraph[end]) {
      return [];
    }

    const queue = [{ id: start, cost: 0, path: [start] }];
    const visits = new Map();
    const maxDepth = 8;

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (!current) break;
      if (current.id === end) return current.path;
      if (current.path.length > maxDepth) continue;
      if ((visits.get(current.id) || Infinity) <= current.cost) continue;
      visits.set(current.id, current.cost);

      const neighbors = roadGraph[current.id] || [];
      neighbors.forEach((neighbor) => {
        if (current.path.includes(neighbor)) return;
        const nextCost = current.cost + (neighbor.includes('hospital') ? 1.7 : 1.2);
        queue.push({ id: neighbor, cost: nextCost, path: [...current.path, neighbor] });
      });
    }

    const defaultRoute = [start, end];
    return defaultRoute;
  }

  function buildDistanceEstimate(routeIds) {
    return routeIds.reduce((sum, id) => sum + (roadCoordinates[id]?.length || 1), 0);
  }

  function computeVehicleEta(vehicle) {
    const route = vehicle.route || [];
    const routeLength = route.length || 1;
    const trafficPenalty = vehicle.priorityLevel === 'CRITICAL' ? 0.78 : vehicle.priorityLevel === 'HIGH' ? 0.88 : 1;
    const baseMinutes = Math.max(3, ((routeLength * 1.8) / Math.max(1, vehicle.speed)) * 6 * trafficPenalty);
    return clamp(Number(baseMinutes.toFixed(1)), 2, 60);
  }

  function getNextIntersection(vehicle) {
    const route = vehicle.route || [];
    const intersectionNames = ['junction-central', 'junction-ring', 'junction-market', 'airport-junction', 'central-square'];
    const nextIntersection = route.find((node) => intersectionNames.includes(node));
    if (!nextIntersection) return null;
    const labelMap = {
      'junction-central': 'Central Square',
      'junction-ring': 'Ring Junction',
      'junction-market': 'Cotton Market',
      'airport-junction': 'Airport Junction',
      'central-square': 'Central Square'
    };
    return { id: nextIntersection, label: labelMap[nextIntersection] || nextIntersection };
  }

  function resolveIntersectionPriority(vehicle) {
    const route = vehicle.route || [];
    const next = getNextIntersection(vehicle);
    if (!next) return null;
    const etaSeconds = Math.max(10, vehicle.eta * 60);
    const approach = route.indexOf(next.id) % 2 === 0 ? 'NORTH' : 'SOUTH';
    return { intersectionId: next.id, intersectionLabel: next.label, approach, eta: Math.max(12, Math.round(etaSeconds / 60)), vehicleId: vehicle.id };
  }

  function setSignalMode(mode) {
    if (window.FlowXSignalEngine) {
      window.FlowXSignalEngine.mode = mode;
      window.FlowXSignalEngine.emergencyMode = mode === 'EMERGENCY PRIORITY';
      if (Array.isArray(window.FlowXSignalEngine.intersections)) {
        window.FlowXSignalEngine.intersections.forEach((intersection) => {
          intersection.signalMode = mode === 'EMERGENCY PRIORITY' ? 'EMERGENCY PRIORITY' : 'SMART';
        });
      }
    }
  }

  function createEmergencyVehicle(input = {}) {
    const type = getVehicleTypeLabel(input.vehicleType || 'AMBULANCE');
    const priorityLevel = (input.priorityLevel || getPriorityForType(type)).toUpperCase();
    const originId = resolveNodeId(input.origin || 'Central Square');
    const destinationId = resolveNodeId(input.destination || 'City Hospital');
    const route = computeRoute(originId, destinationId);
    const routeDistance = buildDistanceEstimate(route);
    const speed = clamp(safeNumber(input.speed, type === 'AMBULANCE' ? 58 : type === 'FIRE TRUCK' ? 52 : 46), 20, 85);

    const emergency = {
      id: String(input.vehicleId || `${type.slice(0, 3).toUpperCase()}-${String(Math.floor(Math.random() * 99) + 1).padStart(3, '0')}`),
      type,
      priority: priorityLevel,
      priorityLevel: priorityLevel,
      currentLocation: input.origin || 'Central Square',
      destination: input.destination || 'City Hospital',
      route: route.length ? route : [originId, destinationId],
      status: 'EN ROUTE',
      speed,
      eta: clamp(safeNumber(input.eta, 8), 2, 90),
      progress: 0,
      createdAt: new Date().toISOString(),
      active: true,
      signalState: 'NORMAL',
      phaseRequest: null,
      currentRoad: route[0] || originId,
      alertLevel: 'INFO',
      eventLog: [],
      timeSaved: 0,
      routeDistance,
      normalEta: 0,
      simulatedEtaMinutes: 0,
      lastIntersection: null
    };

    emergency.normalEta = Math.max(6, Number((routeDistance / Math.max(1, emergency.speed / 2)).toFixed(1)));
    emergency.simulatedEtaMinutes = emergency.normalEta;
    emergency.eta = emergency.normalEta;
    return emergency;
  }

  function renderDashboardWidget() {
    const widget = document.getElementById('dashboard-emergency-widget');
    if (!widget) return;

    const active = emergencyState.activeEmergencies[0];
    if (!active) {
      widget.innerHTML = `
        <div class="emergency-item__info">
          <strong>NO ACTIVE EMERGENCIES</strong>
          <span>Simulation ready</span>
        </div>
        <a href="emergency.html" class="button button--ghost button--small">OPEN EMERGENCY CONTROL</a>
      `;
      return;
    }

    widget.innerHTML = `
      <div class="emergency-item emergency-item--active">
        <div class="emergency-item__icon">${active.type === 'AMBULANCE' ? '🚑' : active.type === 'FIRE TRUCK' ? '🚒' : '🚓'}</div>
        <div class="emergency-item__info">
          <strong>${active.id}</strong>
          <span>${active.priorityLevel} · ${active.status}</span>
        </div>
        <span class="emergency-item__eta">ETA ${active.eta.toFixed(1)} min</span>
      </div>
      <div class="dashboard-emergency-widget__footer">
        <a href="emergency.html" class="button button--ghost button--small">TRACK EMERGENCY</a>
      </div>
    `;
  }

  function renderSummary() {
    const activeCount = emergencyState.activeEmergencies.length;
    const greenCorridors = emergencyState.activeEmergencies.filter((vehicle) => vehicle.signalState === 'PRIORITY_ACTIVE').length;
    const signalsPrioritized = emergencyState.priorityQueue.length;
    const avgTimeSaved = emergencyState.activeEmergencies.length
      ? emergencyState.activeEmergencies.reduce((sum, item) => sum + (item.timeSaved || 0), 0) / emergencyState.activeEmergencies.length
      : 0;

    const summaryEls = {
      activeEmergencies: document.getElementById('emergency-active-count'),
      greenCorridors: document.getElementById('emergency-green-corridors'),
      signalsPrioritized: document.getElementById('emergency-signals-prioritized'),
      averageTimeSaved: document.getElementById('emergency-time-saved')
    };

    if (summaryEls.activeEmergencies) summaryEls.activeEmergencies.textContent = String(activeCount);
    if (summaryEls.greenCorridors) summaryEls.greenCorridors.textContent = String(greenCorridors);
    if (summaryEls.signalsPrioritized) summaryEls.signalsPrioritized.textContent = String(signalsPrioritized);
    if (summaryEls.averageTimeSaved) summaryEls.averageTimeSaved.textContent = `${avgTimeSaved.toFixed(1)} min`;
  }

  function renderAlertPanel(vehicle) {
    const panel = document.getElementById('emergency-alert-panel');
    if (!panel) return;

    if (!vehicle) {
      panel.innerHTML = '<div class="emergency-alert emergency-alert--normal"><strong>TRAFFIC FLOW NORMAL</strong><span>Simulation ready.</span></div>';
      return;
    }

    const alertClass = vehicle.status === 'ARRIVED' ? 'emergency-alert--ok' : vehicle.priorityLevel === 'CRITICAL' ? 'emergency-alert--critical' : 'emergency-alert--warning';
    panel.innerHTML = `
      <div class="${alertClass} emergency-alert">
        <strong>${vehicle.status === 'ARRIVED' ? 'TRAFFIC FLOW RESTORING' : vehicle.priorityLevel === 'CRITICAL' ? '⚠ EMERGENCY VEHICLE APPROACHING' : '⚠ PRIORITY ALERT'}</strong>
        <span>${vehicle.id} · ${vehicle.type} · ${vehicle.status}</span>
      </div>
    `;
  }

  function renderLedDisplay(vehicle) {
    const led = document.getElementById('emergency-led-display');
    if (!led) return;

    const activeVehicle = vehicle || emergencyState.activeEmergencies[0];
    if (!activeVehicle) {
      led.innerHTML = `
        <div class="led-screen led-screen--normal">
          <div class="led-screen__header">TRAFFIC FLOW NORMAL</div>
          <div class="led-screen__line">SYSTEM READY</div>
          <div class="led-screen__line">NO ACTIVE EMERGENCY</div>
        </div>
      `;
      return;
    }

    const statusMessage = activeVehicle.status === 'ARRIVED' ? 'TRAFFIC FLOW RESTORING' : activeVehicle.signalState === 'PRIORITY_ACTIVE' ? 'GREEN CORRIDOR ACTIVE' : 'AMBULANCE APPROACHING';
    const routeMessage = activeVehicle.route?.length ? `${activeVehicle.currentLocation} → ${activeVehicle.destination}` : `${activeVehicle.currentLocation} → ${activeVehicle.destination}`;
    led.innerHTML = `
      <div class="led-screen led-screen--emergency">
        <div class="led-screen__header">⚠ EMERGENCY ALERT</div>
        <div class="led-screen__line">${activeVehicle.type === 'AMBULANCE' ? '🚑' : activeVehicle.type === 'FIRE TRUCK' ? '🚒' : '🚓'} ${activeVehicle.id} ${activeVehicle.type}</div>
        <div class="led-screen__line">${statusMessage}</div>
        <div class="led-screen__line">ROUTE: ${routeMessage}</div>
        <div class="led-screen__line">ETA: ${activeVehicle.eta.toFixed(1)} min</div>
      </div>
    `;
  }

  function renderEventLog() {
    const el = document.getElementById('emergency-event-log');
    if (!el) return;
    if (!emergencyState.eventLog.length) {
      el.innerHTML = '<div class="event-log__item"><span>--:--:--</span><strong>Emergency system ready.</strong></div>';
      return;
    }

    el.innerHTML = emergencyState.eventLog.map((entry) => `
      <div class="event-log__item">
        <span>${entry.time}</span>
        <strong>${entry.message}</strong>
      </div>
    `).join('');
  }

  function renderActiveTable() {
    const table = document.getElementById('emergency-vehicle-table');
    if (!table) return;

    if (!emergencyState.activeEmergencies.length) {
      table.innerHTML = '<div class="route-empty">No active emergency simulations.</div>';
      return;
    }

    table.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Location</th>
            <th>Destination</th>
            <th>ETA</th>
            <th>Status</th>
            <th>Intersections</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${emergencyState.activeEmergencies.map((vehicle) => `
            <tr>
              <td>${vehicle.id}</td>
              <td>${vehicle.type}</td>
              <td>${vehicle.priorityLevel}</td>
              <td>${vehicle.currentLocation}</td>
              <td>${vehicle.destination}</td>
              <td>${vehicle.eta.toFixed(1)} min</td>
              <td>${vehicle.status}</td>
              <td>${Math.max(1, vehicle.route.length - 1)}</td>
              <td><button type="button" data-track="${vehicle.id}" class="button button--ghost button--small">TRACK</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    table.querySelectorAll('[data-track]').forEach((button) => {
      button.addEventListener('click', () => {
        const vehicle = emergencyState.activeEmergencies.find((item) => item.id === button.dataset.track);
        if (vehicle) {
          emergencyState.selectedVehicleId = vehicle.id;
          renderSelectedVehicle();
        }
      });
    });
  }

  function renderSelectedVehicle() {
    const panel = document.getElementById('emergency-detail-panel');
    if (!panel) return;

    const vehicle = emergencyState.activeEmergencies.find((item) => item.id === emergencyState.selectedVehicleId) || emergencyState.activeEmergencies[0];
    if (!vehicle) {
      panel.innerHTML = '<div class="route-empty">No point-of-interest selected.</div>';
      return;
    }

    const nextIntersection = getNextIntersection(vehicle);
    panel.innerHTML = `
      <div class="emergency-detail-card">
        <div class="emergency-detail-card__header">
          <strong>${vehicle.id}</strong>
          <span class="badge badge--alert">${vehicle.priorityLevel}</span>
        </div>
        <div class="emergency-detail-card__body">
          <div><span>Type</span><strong>${vehicle.type}</strong></div>
          <div><span>Origin</span><strong>${vehicle.currentLocation}</strong></div>
          <div><span>Destination</span><strong>${vehicle.destination}</strong></div>
          <div><span>ETA</span><strong>${vehicle.eta.toFixed(1)} min</strong></div>
          <div><span>Progress</span><strong>${vehicle.progress.toFixed(0)}%</strong></div>
          <div><span>Next Intersection</span><strong>${nextIntersection?.label || 'Route complete'}</strong></div>
          <div><span>Status</span><strong>${vehicle.status}</strong></div>
        </div>
      </div>
    `;
  }

  function renderHistory() {
    const panel = document.getElementById('emergency-history');
    if (!panel) return;

    if (!emergencyState.history.length) {
      panel.innerHTML = '<div class="route-empty">No completed emergency simulations.</div>';
      return;
    }

    panel.innerHTML = emergencyState.history.slice(0, 5).map((entry) => `
      <div class="history-item">
        <div class="history-item__title">${entry.id}</div>
        <div class="history-item__meta">
          <span>${entry.status}</span>
          <span>Time Saved: ${entry.timeSaved} min</span>
        </div>
      </div>
    `).join('');
  }

  function renderMap() {
    const mapContainer = document.getElementById('emergency-map');
    if (!mapContainer) return;

    if (!window.L) return;

    if (!emergencyState.map) {
      emergencyState.map = L.map('emergency-map', { zoomControl: true, scrollWheelZoom: true }).setView([21.1458, 79.0882], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(emergencyState.map);
      emergencyState.mapLayer = L.layerGroup().addTo(emergencyState.map);
    }

    if (!emergencyState.mapLayer) return;
    emergencyState.mapLayer.clearLayers();

    const allRoads = Object.keys(roadCoordinates);
    allRoads.forEach((id) => {
      const coords = roadCoordinates[id];
      if (!coords || !coords.length) return;
      const isEmergencyRoute = emergencyState.activeEmergencies.some((vehicle) => (vehicle.route || []).includes(id));
      const color = isEmergencyRoute ? '#22c55e' : '#3b82f6';
      const polyline = L.polyline(coords, {
        color,
        weight: isEmergencyRoute ? 7 : 4,
        opacity: isEmergencyRoute ? 0.95 : 0.55,
        dashArray: isEmergencyRoute ? '6 6' : null,
        lineCap: 'round'
      }).addTo(emergencyState.mapLayer);

      polyline.bindPopup(`<strong>${id}</strong><br>${isEmergencyRoute ? 'Emergency priority corridor' : 'Normal traffic route'}`);
    });

    emergencyState.activeEmergencies.forEach((vehicle) => {
      const routePoints = (vehicle.route || []).flatMap((node) => roadCoordinates[node] || []);
      if (!routePoints.length) return;
      const routeLine = L.polyline(routePoints, {
        color: '#22c55e',
        weight: 8,
        opacity: 0.9,
        dashArray: '8 10'
      }).addTo(emergencyState.mapLayer);
      routeLine.bindPopup(`<strong>${vehicle.id}</strong><br>${vehicle.type}<br>Priority: ${vehicle.priorityLevel}<br>Status: ${vehicle.status}`);

      const iconMap = { AMBULANCE: '🚑', 'FIRE TRUCK': '🚒', POLICE: '🚓' };
      const lastPoint = routePoints[routePoints.length - 1];
      const marker = L.marker(lastPoint, {
        icon: L.divIcon({
          html: `<div style="font-size: 22px; transform: translate(-50%, -50%);">${iconMap[vehicle.type] || '🚑'}</div>`,
          className: 'emergency-marker-container',
          iconSize: [24, 24]
        })
      }).addTo(emergencyState.mapLayer);
      marker.bindPopup(`<strong>${vehicle.id}</strong><br>${vehicle.type}<br>Priority: ${vehicle.priorityLevel}<br>ETA: ${vehicle.eta.toFixed(1)} min<br>Status: ${vehicle.status}`);
    });

    if (emergencyState.activeEmergencies.length) {
      const vehicle = emergencyState.activeEmergencies[0];
      const routePoints = (vehicle.route || []).flatMap((node) => roadCoordinates[node] || []);
      if (routePoints.length) {
        emergencyState.map.fitBounds(L.latLngBounds(routePoints), { padding: [28, 28], maxZoom: 13 });
      }
    }
  }

  function updateEmergencyVehicle(vehicle) {
    if (!vehicle.active) return;

    const route = vehicle.route || [];
    if (!route.length) {
      vehicle.status = 'ERROR';
      vehicle.active = false;
      return;
    }

    const routeProgress = clamp(vehicle.progress + 3.5 + (vehicle.priorityLevel === 'CRITICAL' ? 1.2 : 0.5), 0, 100);
    vehicle.progress = routeProgress;
    vehicle.eta = Math.max(0.2, vehicle.normalEta - (vehicle.progress * 0.09));
    vehicle.simulatedEtaMinutes = vehicle.eta;
    vehicle.currentRoad = route[Math.min(route.length - 1, Math.max(0, Math.floor((vehicle.progress / 100) * route.length)))];

    const nextIntersection = getNextIntersection(vehicle);
    if (nextIntersection && vehicle.progress >= 45 && vehicle.signalState === 'NORMAL') {
      const priorityRequest = resolveIntersectionPriority(vehicle);
      if (priorityRequest) {
        vehicle.signalState = 'PRIORITY_REQUESTED';
        vehicle.phaseRequest = priorityRequest;
        vehicle.status = 'APPROACHING INTERSECTION';
        vehicle.alertLevel = 'WARNING';
        emergencyState.priorityQueue.push({
          vehicleId: vehicle.id,
          intersectionId: priorityRequest.intersectionId,
          approach: priorityRequest.approach,
          priority: vehicle.priorityLevel,
          eta: priorityRequest.eta,
          requestedAt: Date.now()
        });
        logEvent(`${vehicle.id} priority requested at ${priorityRequest.intersectionLabel}`, 'WARNING');
      }
    }

    if (vehicle.signalState === 'PRIORITY_REQUESTED') {
      vehicle.signalState = 'PRIORITY_PREPARING';
      vehicle.status = 'PRIORITY REQUESTED';
    }

    if (vehicle.signalState === 'PRIORITY_PREPARING' && vehicle.progress >= 57) {
      vehicle.signalState = 'PRIORITY_ACTIVE';
      vehicle.status = 'GREEN CORRIDOR ACTIVE';
      vehicle.alertLevel = 'CRITICAL';
      setSignalMode('EMERGENCY PRIORITY');
      logEvent(`${vehicle.id} green corridor active at ${nextIntersection?.label || 'corridor'}`, 'CRITICAL');
    }

    if (vehicle.signalState === 'PRIORITY_ACTIVE' && vehicle.progress >= 66) {
      vehicle.signalState = 'VEHICLE_PASSED';
      vehicle.status = 'PASSING INTERSECTION';
      vehicle.alertLevel = 'INFO';
    }

    if (vehicle.signalState === 'VEHICLE_PASSED' && vehicle.progress >= 82) {
      vehicle.signalState = 'RESTORING';
      vehicle.status = 'ROUTE DELAYED';
      vehicle.alertLevel = 'INFO';
    }

    if (vehicle.progress >= 100) {
      vehicle.status = 'ARRIVED';
      vehicle.signalState = 'NORMAL';
      vehicle.active = false;
      vehicle.alertLevel = 'INFO';
      vehicle.timeSaved = Math.max(1, Number((vehicle.normalEta - vehicle.eta).toFixed(1)));
      logEvent(`${vehicle.id} arrived at ${vehicle.destination}`, 'INFO');
      emergencyState.history.unshift({
        id: vehicle.id,
        status: 'Arrived',
        timeSaved: Number(vehicle.timeSaved.toFixed(1))
      });
      emergencyState.history = emergencyState.history.slice(0, 6);
      setSignalMode('SMART');
    }

    const emergencyRequest = emergencyState.priorityQueue.filter((request) => request.vehicleId === vehicle.id);
    if (emergencyRequest.length && vehicle.status === 'ARRIVED') {
      emergencyState.priorityQueue = emergencyState.priorityQueue.filter((request) => request.vehicleId !== vehicle.id);
    }
  }

  function processEmergencyQueue() {
    const sorted = [...emergencyState.priorityQueue].sort((a, b) => {
      const scoreA = priorityScores[a.priority] || 0;
      const scoreB = priorityScores[b.priority] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return (a.eta || 999) - (b.eta || 999);
    });

    const granted = new Set();
    sorted.forEach((request) => {
      if (!granted.has(request.intersectionId)) {
        granted.add(request.intersectionId);
      }
    });

    emergencyState.priorityQueue = sorted.filter((request) => granted.has(request.intersectionId));
  }

  function updateSimulation() {
    if (!emergencyState.simulationEnabled) return;
    if (!emergencyState.activeEmergencies.length) {
      renderLedDisplay(null);
      renderAlertPanel(null);
      renderSummary();
      return;
    }

    processEmergencyQueue();
    emergencyState.activeEmergencies.forEach((vehicle) => updateEmergencyVehicle(vehicle));
    emergencyState.activeEmergencies = emergencyState.activeEmergencies.filter((vehicle) => vehicle.active);
    renderAll();
  }

  function renderAll() {
    if (!document.body) return;
    const activeVehicle = emergencyState.activeEmergencies[0];
    renderSummary();
    renderAlertPanel(activeVehicle || null);
    renderLedDisplay(activeVehicle || null);
    renderActiveTable();
    renderSelectedVehicle();
    renderHistory();
    renderMap();
    renderEventLog();
    renderDashboardWidget();
  }

  function createEmergencyFromForm() {
    const form = document.getElementById('emergency-form');
    if (!form) return;

    const vehicleType = document.getElementById('vehicle-type')?.value || 'AMBULANCE';
    const vehicleId = document.getElementById('vehicle-id')?.value?.trim() || `${vehicleType.slice(0, 3).toUpperCase()}-042`;
    const origin = document.getElementById('origin-select')?.value || 'Central Square';
    const destination = document.getElementById('destination-select')?.value || 'City Hospital';
    const priorityLevel = document.getElementById('priority-select')?.value || getPriorityForType(vehicleType);

    if (!origin || !destination || origin === destination) {
      logEvent('Invalid emergency origin or destination.', 'ERROR');
      return;
    }

    const emergency = createEmergencyVehicle({
      vehicleType,
      vehicleId,
      origin,
      destination,
      priorityLevel
    });

    emergencyState.activeEmergencies.unshift(emergency);
    emergencyState.selectedVehicleId = emergency.id;
    emergencyState.lastAlertMessage = `${emergency.id} created`;
    logEvent(`${emergency.id} created and route calculated`, 'INFO');
    renderAll();
  }

  function setEmergencySimulationEnabled(enabled) {
    emergencyState.simulationEnabled = enabled;
    if (enabled) {
      logEvent('Emergency simulation enabled.', 'INFO');
    } else {
      logEvent('Emergency simulation disabled.', 'INFO');
    }
    renderAll();
  }

  function resetEmergencySimulation() {
    emergencyState.activeEmergencies = [];
    emergencyState.priorityQueue = [];
    emergencyState.eventLog = [];
    emergencyState.history = emergencyState.history.slice(0, 5);
    emergencyState.selectedVehicleId = null;
    setSignalMode('SMART');
    logEvent('Emergency simulation reset to normal traffic behavior.', 'INFO');
    renderAll();
  }

  function bindControls() {
    const form = document.getElementById('emergency-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        createEmergencyFromForm();
      });
    }

    const typeSelect = document.getElementById('vehicle-type');
    const prioritySelect = document.getElementById('priority-select');
    if (typeSelect && prioritySelect) {
      typeSelect.addEventListener('change', () => {
        const type = typeSelect.value;
        const defaultPriority = getPriorityForType(type);
        prioritySelect.value = defaultPriority;
      });
    }

    const toggle = document.getElementById('emergency-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        emergencyState.simulationEnabled = !emergencyState.simulationEnabled;
        toggle.textContent = emergencyState.simulationEnabled ? 'EMERGENCY SIMULATION ON' : 'EMERGENCY SIMULATION OFF';
        setEmergencySimulationEnabled(emergencyState.simulationEnabled);
      });
    }

    const reset = document.getElementById('reset-emergency-sim');
    if (reset) {
      reset.addEventListener('click', resetEmergencySimulation);
    }
  }

  function populateFormOptions() {
    const origins = [
      'Central Square', 'Wardha Road', 'Ring Road', 'Airport Corridor', 'Sadar Nagpur', 'Cotton Market'
    ];
    const destinations = [
      'City Hospital', 'Civil Hospital', 'Emergency Center', 'Fire Station', 'Police HQ'
    ];

    const originSelect = document.getElementById('origin-select');
    const destinationSelect = document.getElementById('destination-select');
    const typeSelect = document.getElementById('vehicle-type');
    const prioritySelect = document.getElementById('priority-select');

    if (originSelect) originSelect.innerHTML = origins.map((opt) => `<option value="${opt}">${opt}</option>`).join('');
    if (destinationSelect) destinationSelect.innerHTML = destinations.map((opt) => `<option value="${opt}">${opt}</option>`).join('');
    if (typeSelect) typeSelect.innerHTML = ['AMBULANCE', 'FIRE TRUCK', 'POLICE'].map((opt) => `<option value="${opt}">${opt}</option>`).join('');
    if (prioritySelect) prioritySelect.innerHTML = ['CRITICAL', 'HIGH', 'NORMAL'].map((opt) => `<option value="${opt}">${opt}</option>`).join('');

    if (typeSelect) typeSelect.value = 'AMBULANCE';
    if (prioritySelect) prioritySelect.value = 'CRITICAL';
  }

  function init() {
    if (typeof document === 'undefined') return;

    populateFormOptions();
    bindControls();
    renderAll();
    logEvent('Emergency control system ready. Simulation only.', 'INFO');
    renderAll();

    if (!emergencyState.timerId) {
      emergencyState.timerId = window.setInterval(updateSimulation, 3500);
    }
  }

  if (typeof window !== 'undefined') {
    window.FlowXEmergency = {
      init,
      createEmergencyVehicle,
      setEmergencySimulationEnabled,
      resetEmergencySimulation,
      state: emergencyState,
      getActiveEmergencies: () => emergencyState.activeEmergencies.slice(),
      getPriorityQueue: () => [...emergencyState.priorityQueue]
    };
    document.addEventListener('DOMContentLoaded', init);
  }
})();
