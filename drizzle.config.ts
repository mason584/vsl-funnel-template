import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL!,
  },
  schemaFilter: ["public"],
  // Table de suivi propre au tunnel : la base peut être partagée avec une
  // autre application Drizzle (voir scripts/migrate.ts).
  migrations: { table: "__vsl_funnel_migrations", schema: "drizzle" },
  verbose: true,
  strict: true,
});
