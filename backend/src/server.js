const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/database');
const http = require('http');
const { WebSocketServer } = require('ws');
const { setWebSocketServer } = require('./utils/realtime');
const { setPredictionWebSocket } = require('./utils/predictionRealtime');
const predictionService = require('./services/trafficPredictionService');

async function startServer() {
  try {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured for the backend runtime.');
    }

    await prisma.$connect();
    console.log('Database connected successfully.');

    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });
    wss.on('connection', (socket) => {
      console.log('Realtime client connected');
      socket.send(JSON.stringify({ type: 'welcome', data: { message: 'Connected to FlowX realtime' } }));
    });
    setWebSocketServer(wss);
    setPredictionWebSocket(wss);
    const { setSignalWebSocket } = require('./utils/signalRealtime');
    setSignalWebSocket(wss);
    const { setEmergencyWebSocket } = require('./utils/emergencyRealtime');
    setEmergencyWebSocket(wss);

    predictionService.startPeriodicComputation(60000).catch((e)=>console.error('Prediction service failed', e));

    const host = env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    server.listen(env.PORT, host, () => {
      console.log(`FlowX Traffic backend running on port ${env.PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Unable to start server:', error.message);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

startServer();
