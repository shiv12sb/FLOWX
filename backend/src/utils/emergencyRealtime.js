let wss = null;
function setEmergencyWebSocket(server) {
  wss = server;
}

function broadcastEmergencyEvent(action, payload) {
  try {
    if (!wss) return;
    const message = JSON.stringify({ type: `emergency.${action}`, data: payload });
    wss.clients.forEach((c) => { try { if (c.readyState === 1) c.send(message); } catch (e) {} });
  } catch (e) { }
}

module.exports = { setEmergencyWebSocket, broadcastEmergencyEvent };
