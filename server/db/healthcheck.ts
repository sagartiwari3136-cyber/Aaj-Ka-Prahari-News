import { checkDatabaseHealth } from './health.ts';
import { closeDatabasePool } from '../../src/db/index.ts';

async function main() {
  try {
    const report = await checkDatabaseHealth();
    console.log(JSON.stringify(report, null, 2));

    if (report.status !== 'healthy') {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabasePool();
  }
}

main().catch((err) => {
  console.error('Database health check failed unexpectedly:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
