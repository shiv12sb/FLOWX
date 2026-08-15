/**
 * Smart Traffic Command Center — Demo Traffic Map
 * Phase 4: interactive simulation layer using demo road data
 */

const TrafficDemo = (() => {
  const statusColors = {
    clear: '#22c55e',
    moderate: '#f97316',
    heavy: '#ef4444'
  };

  const roads = [
    {
      id: 'ring-road',
      name: 'Ring Road',
      utilization: 68,
      speed: 29,
      incidents: 1,
      travelTime: '14 min',
      coords: [
        [21.1752, 79.0587],
        [21.1678, 79.0811],
        [21.1606, 79.0915],
        [21.1504, 79.0902],
        [21.1431, 79.0824]
      ],
      description: 'Inbound traffic is elevated due to peak-hour commuter volume and signal hold times.'
    },
    {
      id: 'wardha-road',
      name: 'Wardha Road',
      utilization: 82,
      speed: 18,
      incidents: 2,
      travelTime: '18 min',
      coords: [
        [21.1479, 79.0718],
        [21.1452, 79.0874],
        [21.1396, 79.1062]
      ],
      description: 'High corridor load with multiple queue clusters near key junctions and bus stops.'
    },
    {
      id: 'central-avenue',
      name: 'Central Avenue',
      utilization: 46,
      speed: 35,
      incidents: 0,
      travelTime: '10 min',
      coords: [
        [21.1546, 79.0919],
        [21.1462, 79.0967],
        [21.1389, 79.1045],
        [21.1275, 79.1119]
      ],
      description: 'Stable signal progression is maintaining smooth travel with light freight movement.'
    },
    {
      id: 'sadar-nagpur',
      name: 'Sadar Nagpur',
      utilization: 58,
      speed: 31,
      incidents: 1,
      travelTime: '11 min',
      coords: [
        [21.1339, 79.0718],
        [21.1387, 79.0845],
        [21.1413, 79.1004],
        [21.1468, 79.1162]
      ],
      description: 'Mid-block congestion is being managed, but turning movement remains sensitive near civic hubs.'
    },
    {
      id: 'cotton-market',
      name: 'Cotton Market',
      utilization: 91,
      speed: 12,
      incidents: 3,
      travelTime: '22 min',
      coords: [
        [21.1609, 79.1091],
        [21.1538, 79.1064],
        [21.1475, 79.1013],
        [21.1419, 79.0986]
      ],
      description: 'Severe congestion caused by dense pedestrian crossing demand and commercial vehicle loading.'
    },
    {
      id: 'airport-corridor',
      name: 'Airport Corridor',
      utilization: 39,
      speed: 41,
      incidents: 0,
      travelTime: '8 min',
      coords: [
        [21.1124, 79.0469],
        [21.1221, 79.0537],
        [21.1294, 79.0621],
        [21.1396, 79.0703]
      ],
      description: 'Free-flow corridor with low queue accumulation and strong throughput efficiency.'
    }
  ];

  const state = {
    map: null,
    mapLayer: null,
    selectedRoadId: 'wardha-road',
    filter: 'all',
    searchTerm: '',
    simulationRunning: true,
    densityView: false,
    intervalId: null
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getStatusFromUtilization(utilization) {
    if (utilization >= 75) {
      return { key: 'heavy', label: 'Severe', className: 'traffic-detail__status--heavy' };
    }
    if (utilization >= 45) {
      return { key: 'moderate', label: 'Moderate', className: 'traffic-detail__status--moderate' };
    }
    return { key: 'clear', label: 'Smooth', className: 'traffic-detail__status--clear' };
  }

  function getVisibleRoads() {
    const rawFilter = state.filter;
    const search = state.searchTerm.trim().toLowerCase();

    return roads.filter((road) => {
      const status = getStatusFromUtilization(road.utilization).key;
      const matchesFilter = rawFilter === 'all' || (rawFilter === 'heavy' && status === 'heavy') || (rawFilter === 'moderate' && status === 'moderate') || (rawFilter === 'clear' && status === 'clear') || (rawFilter === 'incident' && road.incidents > 0);
      const matchesSearch = !search || road.name.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }

  function renderSummary() {
    const summaryEl = document.getElementById('traffic-summary');
    if (!summaryEl) return;

    const averageUtilization = Math.round(roads.reduce((total, road) => total + road.utilization, 0) / roads.length);
    const severeCount = roads.filter((road) => getStatusFromUtilization(road.utilization).key === 'heavy').length;
    const incidents = roads.reduce((total, road) => total + road.incidents, 0);
    const avgSpeed = Math.round(roads.reduce((total, road) => total + road.speed, 0) / roads.length);

    summaryEl.innerHTML = `
      <div class="traffic-summary__item">
        <span class="traffic-summary__label">Avg. Flow</span>
        <span class="traffic-summary__value">${averageUtilization}%</span>
        <span class="traffic-summary__trend traffic-summary__trend--up">+4.2% vs last hour</span>
      </div>
      <div class="traffic-summary__item">
        <span class="traffic-summary__label">Severe Corridors</span>
        <span class="traffic-summary__value">${severeCount}</span>
        <span class="traffic-summary__trend traffic-summary__trend--down">${incidents} active incidents</span>
      </div>
      <div class="traffic-summary__item">
        <span class="traffic-summary__label">Avg. Speed</span>
        <span class="traffic-summary__value">${avgSpeed} km/h</span>
        <span class="traffic-summary__trend traffic-summary__trend--up">Stable flow</span>
      </div>
      <div class="traffic-summary__item">
        <span class="traffic-summary__label">Queue Delay</span>
        <span class="traffic-summary__value">${roads.filter((r) => r.utilization >= 60).length * 4} min</span>
        <span class="traffic-summary__trend traffic-summary__trend--down">Peak window</span>
      </div>
    `;
  }

  function renderRoadList() {
    const listEl = document.getElementById('traffic-road-list');
    const countEl = document.getElementById('road-count-badge');
    if (!listEl || !countEl) return;

    const visibleRoads = getVisibleRoads();
    countEl.textContent = `${visibleRoads.length} roads`;

    if (!visibleRoads.length) {
      listEl.innerHTML = '<div class="traffic-road-item"><div class="traffic-road-item__name">No roads match this filter.</div></div>';
      return;
    }

    listEl.innerHTML = visibleRoads.map((road) => {
      const status = getStatusFromUtilization(road.utilization);
      return `
        <button type="button" class="traffic-road-item ${state.selectedRoadId === road.id ? 'is-selected' : ''}" data-road-id="${road.id}">
          <div class="traffic-road-item__top">
            <span class="traffic-road-item__name">${road.name}</span>
            <span class="traffic-road-item__status traffic-road-item__status--${status.key}">${status.label}</span>
          </div>
          <div class="traffic-road-item__meta">
            <span>Speed <strong>${road.speed} km/h</strong></span>
            <span>Flow <strong>${road.utilization}%</strong></span>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('.traffic-road-item').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedRoadId = button.dataset.roadId;
        renderAll();
      });
    });
  }

  function renderDetail() {
    const detailEl = document.getElementById('traffic-detail-panel');
    if (!detailEl) return;

    const selectedRoad = roads.find((road) => road.id === state.selectedRoadId) || roads[0];
    const status = getStatusFromUtilization(selectedRoad.utilization);

    detailEl.innerHTML = `
      <div class="traffic-detail">
        <div class="traffic-detail__header">
          <div class="traffic-detail__title">${selectedRoad.name}</div>
          <div class="traffic-detail__meta">
            <span class="traffic-detail__status ${status.className}">${status.label}</span>
            <span class="badge badge--info">${selectedRoad.travelTime}</span>
          </div>
        </div>

        <div class="traffic-detail__stats">
          <div class="traffic-detail__stat">
            <span class="traffic-detail__stat-label">Utilization</span>
            <span class="traffic-detail__stat-value">${selectedRoad.utilization}%</span>
          </div>
          <div class="traffic-detail__stat">
            <span class="traffic-detail__stat-label">Speed</span>
            <span class="traffic-detail__stat-value">${selectedRoad.speed} km/h</span>
          </div>
          <div class="traffic-detail__stat">
            <span class="traffic-detail__stat-label">Incidents</span>
            <span class="traffic-detail__stat-value">${selectedRoad.incidents}</span>
          </div>
          <div class="traffic-detail__stat">
            <span class="traffic-detail__stat-label">Queue</span>
            <span class="traffic-detail__stat-value">${Math.max(2, Math.round(selectedRoad.utilization / 10))} min</span>
          </div>
        </div>

        <div class="traffic-detail__note">
          ${selectedRoad.description}
        </div>

        ${selectedRoad.utilization >= 60 ? `
          <div class="traffic-detail__actions">
            <button type="button" class="button button--primary route-launch-btn" data-road-name="${selectedRoad.name}">FIND ALTERNATIVE ROUTE</button>
          </div>
        ` : ''}
      </div>
    `;

    const routeBtn = detailEl.querySelector('.route-launch-btn');
    if (routeBtn) {
      routeBtn.addEventListener('click', () => {
        const origin = 'Sitabuldi';
        const destination = 'MIHAN';
        const snapshot = { origin, destination, contextRoad: routeBtn.dataset.roadName || selectedRoad.name };
        localStorage.setItem('flowx-smart-routing-context', JSON.stringify(snapshot));
        window.location.href = 'routing.html';
      });
    }
  }

  function renderMap() {
    if (!state.map) {
      state.map = L.map('traffic-map', {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([21.1458, 79.0882], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(state.map);

      state.mapLayer = L.layerGroup().addTo(state.map);
    }

    if (!state.mapLayer) return;

    state.mapLayer.clearLayers();
    const selectedRoad = roads.find((road) => road.id === state.selectedRoadId) || roads[0];
    const visibleRoads = getVisibleRoads();

    visibleRoads.forEach((road) => {
      const status = getStatusFromUtilization(road.utilization);
      const route = L.polyline(road.coords, {
        color: statusColors[status.key],
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(state.mapLayer);

      route.bindPopup(`<strong>${road.name}</strong><br>${status.label}: ${road.utilization}% utilization`);
      route.on('click', () => {
        state.selectedRoadId = road.id;
        renderAll();
      });

      const midpoint = road.coords[Math.floor(road.coords.length / 2)];
      const densityColor = state.densityView
        ? road.utilization >= 75 ? '#ef4444' : road.utilization >= 45 ? '#f97316' : '#22c55e'
        : statusColors[status.key];
      const marker = L.circleMarker(midpoint, {
        radius: 10,
        color: '#f8fafc',
        weight: 2,
        fillColor: densityColor,
        fillOpacity: 0.95
      }).addTo(state.mapLayer);

      marker.bindPopup(`<strong>${road.name}</strong><br>Flow: ${road.utilization}%<br>Speed: ${road.speed} km/h<br>Signal status: ${state.densityView ? 'Density View' : status.label}`);
      marker.on('click', () => {
        state.selectedRoadId = road.id;
        renderAll();
      });
    });

    if (selectedRoad) {
      state.map.fitBounds(L.latLngBounds(selectedRoad.coords), { padding: [40, 40], maxZoom: 13 });
    }

    const mapStatus = document.getElementById('map-status-badge');
    if (mapStatus) {
      mapStatus.textContent = state.simulationRunning ? 'Simulation Live' : 'Simulation Paused';
    }
  }

  function simulateTraffic() {
    if (!state.simulationRunning) return;

    roads.forEach((road) => {
      const variation = (Math.random() - 0.5) * 18;
      road.utilization = clamp(Math.round(road.utilization + variation), 18, 96);
      road.speed = clamp(Math.round(road.speed + (Math.random() - 0.5) * 10), 12, 52);
      road.incidents = clamp(Math.round(road.incidents + (Math.random() - 0.5) * 2), 0, 4);
      if (road.utilization >= 75 && Math.random() > 0.68) {
        road.incidents = clamp(road.incidents + 1, 0, 4);
      }
      road.travelTime = `${Math.max(6, Math.round(road.utilization / 5 + road.incidents * 2))} min`;
    });

    renderAll();
  }

  function bindControls() {
    const filterButtons = document.querySelectorAll('.traffic-filter');
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.filter = button.dataset.filter || 'all';
        filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
        renderAll();
      });
    });

    const searchInput = document.getElementById('traffic-search');
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        state.searchTerm = event.target.value;
        renderAll();
      });
    }

    const toggleBtn = document.getElementById('traffic-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        state.simulationRunning = !state.simulationRunning;
        toggleBtn.textContent = state.simulationRunning ? 'Pause Simulation' : 'Resume Simulation';
        renderMap();
      });
    }

    const densityToggle = document.getElementById('density-view-toggle');
    if (densityToggle) {
      densityToggle.addEventListener('click', () => {
        state.densityView = !state.densityView;
        densityToggle.textContent = state.densityView ? 'DENSITY VIEW ON' : 'DENSITY VIEW';
        renderMap();
      });
    }
  }

  function renderAll() {
    renderSummary();
    renderRoadList();
    renderDetail();
    renderMap();
  }

  function init() {
    if (!document.getElementById('traffic-map')) return;

    bindControls();
    renderAll();
    state.intervalId = window.setInterval(simulateTraffic, 4000);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    init,
    roads,
    state
  };
})();
