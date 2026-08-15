const env = require('./env');
const { PrismaClient } = require('@prisma/client');

const prisma = global.__flowxPrisma || new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

global.__flowxPrisma = prisma;

process.on('SIGINT', async () => {
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});

module.exports = prisma;
