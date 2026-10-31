/**
 * Vérifie la base de production telle que l'application la verra.
 *
 *   vercel env pull .env.production.local --environment production
 *   pnpm tsx --env-file=.env.production.local scripts/check-db.ts
 *   rm .env.production.local
 *
 * Même URL (poolée) et mêmes options que `src/db/index.ts` : si ce script
 * passe, l'application se connectera. Lecture seule.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("✗ DATABASE_URL absente.");
  process.exit(1);
}

async function main() {
  const sql = postgres(url!, { prepare: false, max: 1 });
  try {
    const tables = await sql.unsafe(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('leads', 'settings', 'visits') order by tablename"
    );
    const [apps] = await sql.unsafe("select count(*)::int as n from leads");
    const [visits] = await sql.unsafe("select count(*)::int as n from visits");
    const [migrations] = await sql.unsafe("select count(*)::int as n from drizzle.__vsl_funnel_migrations");
    console.log(
      "tables :",
      tables.map((t) => `${t.tablename} (RLS ${t.rowsecurity ? "on" : "OFF"})`).join(", ")
    );
    console.log(`leads : ${apps.n} · visites : ${visits.n} · migrations enregistrées : ${migrations.n}`);
    if (tables.length !== 3 || tables.some((t) => !t.rowsecurity)) {
      console.error("✗ Tables manquantes ou RLS désactivé.");
      process.exit(1);
    }
    console.log("✓ Base prête.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("✗ Connexion impossible :", error);
  process.exit(1);
});
