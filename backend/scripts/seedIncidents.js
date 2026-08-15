const prisma = require('../src/config/database');

async function seed() {
  try {
    await prisma.$connect();
    const examples = [
      { title: 'Accident — Wardha Road', description: 'Multi-vehicle collision blocking two lanes', type: 'ACCIDENT', severity: 'HIGH', status: 'ACTIVE', road: 'wardha-road', latitude: 21.1452, longitude: 79.0874 },
      { title: 'Signal Failure — Sitabuldi', description: 'Traffic signal offline at intersection', type: 'SIGNAL_FAILURE', severity: 'MEDIUM', status: 'ACTIVE', road: 'sadar-nagpur', latitude: 21.1387, longitude: 79.0845 },
      { title: 'Road Construction — Airport Road', description: 'Planned construction causing lane reduction', type: 'CONSTRUCTION', severity: 'LOW', status: 'ACTIVE', road: 'airport-corridor', latitude: 21.1294, longitude: 79.0621 }
    ];

    for (const item of examples) {
      await prisma.incident.create({ data: item });
    }

    console.log('Seeded demo incidents');
    process.exit(0);
  } catch (e) {
    console.error('Seeding failed', e);
    process.exit(1);
  }
}

seed();
