import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { tournaments, users, type NewUser } from './schema';

/** Seed credentials — also listed in the README. Safe to run repeatedly (idempotent). */
export const SEED_PASSWORDS = { coach: 'Coach@1234', student: 'Student@1234' };

const SEED_USERS: Omit<NewUser, 'passwordHash'>[] = [
  { email: 'coach@koc.test', name: 'Coach Vikram', role: 'coach' },
  { email: 'aarav@koc.test', name: 'Aarav Sharma', role: 'student' },
  { email: 'diya@koc.test', name: 'Diya Patel', role: 'student' },
  { email: 'kabir@koc.test', name: 'Kabir Singh', role: 'student' },
  { email: 'meera@koc.test', name: 'Meera Iyer', role: 'student' },
  { email: 'rohan@koc.test', name: 'Rohan Gupta', role: 'student' },
  { email: 'ananya@koc.test', name: 'Ananya Reddy', role: 'student' },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  await db.transaction(async (tx) => {
    const [coachHash, studentHash] = await Promise.all([
      bcrypt.hash(SEED_PASSWORDS.coach, 10),
      bcrypt.hash(SEED_PASSWORDS.student, 10),
    ]);

    let created = 0;
    for (const u of SEED_USERS) {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${u.email}`);
      if (existing) continue;
      await tx.insert(users).values({ ...u, passwordHash: u.role === 'coach' ? coachHash : studentHash });
      created++;
    }
    console.log(`Users: ${created} created, ${SEED_USERS.length - created} already present`);

    const [coach] = await tx.select().from(users).where(eq(users.email, 'coach@koc.test'));

    const sampleTournaments = [
      {
        name: 'Weekend Blitz Cup',
        description: 'Fast 5-minute games. Join, hit "Find opponent", and play!',
        baseSeconds: 5 * 60,
        incrementSeconds: 0,
        status: 'open' as const,
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      {
        name: 'Rapid Academy Open',
        description: 'Draft — 10+5 rapid event, not yet open for joining.',
        baseSeconds: 10 * 60,
        incrementSeconds: 5,
        status: 'draft' as const,
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    ];

    let tCreated = 0;
    for (const t of sampleTournaments) {
      const [existing] = await tx
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(eq(tournaments.name, t.name));
      if (existing) continue;
      await tx.insert(tournaments).values({ ...t, createdById: coach.id });
      tCreated++;
    }
    console.log(`Tournaments: ${tCreated} created, ${sampleTournaments.length - tCreated} already present`);
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
