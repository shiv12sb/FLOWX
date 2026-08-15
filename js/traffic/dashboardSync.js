(function () {
  const dashboardSync = {
    state: {
      totalVehicles: 0,
      congestedRoads: 0,
      networkUtilization: 0
    },

    updateFromSimulation(simState) {
      if (!simState || !Array.isArray(simState.roads)) return;

      const totalVehicles = simState.roads.reduce((sum, road) => sum + (road.currentVehicles || 0), 0);
      const congestedRoads = simState.roads.filter((road) => road.status === 'Severe' || road.status === 'Moderate').length;
      const networkUtilization = simState.roads.reduce((sum, road) => sum + (road.utilization || 0), 0) / Math.max(simState.roads.length, 1);

      this.state = {
        totalVehicles,
        congestedRoads,
        networkUtilization: Number(networkUtilization.toFixed(1))
      };

      this.applyToDashboard();
    },

    applyToDashboard() {
      const totalVehiclesEl = document.querySelector('[data-kpi="vehicles"] .metric-value');
      const congestedEl = document.querySelector('[data-kpi="incidents"] .metric-value');
      const utilizationEl = document.querySelector('[data-kpi="avg-speed"] .metric-value');

      if (totalVehiclesEl) totalVehiclesEl.textContent = `${this.state.totalVehicles}`;
      if (congestedEl) congestedEl.textContent = `${this.state.congestedRoads}`;
      if (utilizationEl) utilizationEl.textContent = `${this.state.networkUtilization}%`;
    }
  };

  window.dashboardSync = dashboardSync;
})();
