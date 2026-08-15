const prisma = require('../src/config/database');

async function seed() {
  console.log('Seeding signals...');
  const samples = [
    {
      name: 'Sitabuldi Junction',
      location: 'Sitabuldi',
      latitude: 21.1458,
      longitude: 79.0882,
      cycleLength: 90,
      approaches: [
        { direction: 'NORTH', roadId: 'sadar-nagpur', greenTime: 30, queue: 40 },
        { direction: 'SOUTH', roadId: 'ring-road', greenTime: 35, queue: 60 },
        { direction: 'EAST', roadId: 'cotton-market', greenTime: 12, queue: 20 },
        { direction: 'WEST', roadId: 'airport-corridor', greenTime: 13, queue: 10 }
      ]
    },
    {
      name: 'Wardha Road Junction',
      location: 'Wardha Road',
      latitude: 21.1479,
      longitude: 79.0718,
      cycleLength: 80,
      approaches: [
        { direction: 'NORTH', roadId: 'wardha-road', greenTime: 28, queue: 50 },
        { direction: 'SOUTH', roadId: 'central-avenue', greenTime: 22, queue: 30 },
        { direction: 'EAST', roadId: 'sadar-nagpur', greenTime: 15, queue: 10 },
        { direction: 'WEST', roadId: 'ring-road', greenTime: 15, queue: 12 }
      ]
    },
    {
      name: 'Airport Corridor Junction',
      location: 'Airport Corridor',
      latitude: 21.1294,
      longitude: 79.0621,
      cycleLength: 100,
      approaches: [
        { direction: 'NORTH', roadId: 'airport-corridor', greenTime: 40, queue: 20 },
        { direction: 'SOUTH', roadId: 'ring-road', greenTime: 30, queue: 25 },
        { direction: 'EAST', roadId: 'sadar-nagpur', greenTime: 15, queue: 5 },
        { direction: 'WEST', roadId: 'central-avenue', greenTime: 15, queue: 8 }
      ]
    }
  ];

  for (const s of samples) {
    try {
      await prisma.signal.create({ data: { ...s } });
      console.log('Created signal', s.name);
    } catch (e) {
      console.error('Failed to create', s.name, e.message || e);
    }
  }

  console.log('Seeding complete');
  process.exit(0);
}

seed().catch((e)=>{ console.error(e); process.exit(1); });
