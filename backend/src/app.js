const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const routeRoutes = require('./routes/routeRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const signalRoutes = require('./routes/signalRoutes');
const alertRoutes = require('./routes/alertRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const commandCenterRoutes = require('./routes/commandCenterRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? env.FRONTEND_URL : true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FlowX Traffic API is running.'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/command-center', commandCenterRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
