const path = require('path');
const dotenv = require('dotenv');

const candidates = [
  process.cwd(),
  path.resolve(__dirname, '../..'),
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../../..')
].filter(Boolean);

const backendRoot = candidates.find((dir) => {
  const envPath = path.join(dir, '.env');
  try {
    return require('fs').existsSync(envPath);
  } catch {
    return false;
  }
});

const envFilePath = backendRoot ? path.join(backendRoot, '.env') : path.resolve(process.cwd(), '.env');
dotenv.config({ path: envFilePath });

const env = {
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'development-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8080',
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
  // Apple OAuth
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || '',
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || '',
  APPLE_KEY_ID: process.env.APPLE_KEY_ID || '',
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY || '',
  APPLE_CALLBACK_URL: process.env.APPLE_CALLBACK_URL || 'http://localhost:4000/api/auth/apple/callback'
};

module.exports = env;
