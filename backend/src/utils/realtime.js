let wssInstance = null;

function setWebSocketServer(wss) {
  wssInstance = wss;
}

function broadcastIncidentEvent(action, incident) {
  try {
    const payload = JSON.stringify({ type: 'incident.' + action, data: incident });
    if (!wssInstance) return;
    wssInstance.clients.forEach((client) => {
      try { if (client.readyState === 1) client.send(payload); } catch (e) { /* ignore */ }
    });
  } catch (e) {
    // swallow
  }
}

function broadcastAlert(alert) {
  try {
    if (!wssInstance) return;
    const payload = JSON.stringify({ type: 'alert', data: alert });
    wssInstance.clients.forEach((client) => { try { if (client.readyState === 1) client.send(payload); } catch (e) {} });
  } catch (e) { }
}

module.exports = { setWebSocketServer, broadcastIncidentEvent, broadcastAlert };
