import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { join } from 'path';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Works from both src/ (tsx) and dist/ (node): migrations live at apps/api/drizzle
  const migrationsFolder = join(__dirname, '..', '..', 'drizzle');
  await migrate(drizzle(pool), { migrationsFolder });
  await pool.end();
  console.log('Migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
