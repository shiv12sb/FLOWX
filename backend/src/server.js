const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/database');

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully.');

    app.listen(env.PORT, () => {
      console.log(`FlowX Traffic backend running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error.message);
    process.exit(1);
  }
}

startServer();
