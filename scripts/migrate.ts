/**
 * Applique les migrations de `drizzle/` à la base pointée par DATABASE_URL.
 *
 *   pnpm db:migrate
 *
 * Sur Vercel, le script `vercel-build` le lance avant `next build` : les
 * tables se créent au premier déploiement, sans copier l'URL de la base sur
 * un poste (une base du Marketplace, Neon par exemple, ne la montre pas en
 * clair). Idempotent : Drizzle tient sa propre table de migrations déjà
 * passées, relancer ne refait rien.
 *
 * La table de suivi est propre au tunnel (`drizzle.__vsl_funnel_migrations`) et
 * non celle par défaut : si la base est partagée avec une autre application
 * Drizzle, chaque application lirait sinon la date de la dernière migration
 * de l'autre et sauterait les siennes.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("✗ DATABASE_URL absente — rien à migrer.");
  process.exit(1);
}

async function main() {
  // `max: 1` : une migration ne doit jamais s'exécuter sur deux connexions.
  const client = postgres(url!, { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: "drizzle",
      migrationsSchema: "drizzle",
      migrationsTable: "__vsl_funnel_migrations",
    });
    console.log("✓ Migrations appliquées.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("✗ Migration échouée :", error);
  process.exit(1);
});
