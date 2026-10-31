import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import { IS_PREVIEW } from "@/lib/preview";
import * as schema from "./schema";

/**
 * L'accès à la base.
 *
 * En mode aperçu, la base est un Postgres embarqué (PGlite) servi par un
 * processus voisin sur 127.0.0.1:5504 — le sidecar de `pnpm preview`. Le
 * faire vivre hors du serveur Next le met à l'abri des rechargements de
 * Turbopack, qui corrompaient la base à répétition quand elle était embarquée.
 */
type Db = ReturnType<typeof createProductionDb>;

declare global {
  var __vslFunnelDb: Db | undefined;
}

export const PREVIEW_DB_PORT = 5504;

function createProductionDb() {
  const client = postgres(serverEnv().DATABASE_URL, { prepare: false, max: 5 });
  return drizzle(client, { schema });
}

function createDb(): Db {
  if (IS_PREVIEW) {
    // PGlite n'accepte qu'une connexion : les requêtes se sérialisent. Assez
    // pour une démonstration, et immunisé contre les reloads du serveur.
    const client = postgres(
      `postgres://postgres:postgres@127.0.0.1:${PREVIEW_DB_PORT}/postgres`,
      { prepare: false, max: 1 }
    );
    return drizzle(client, { schema });
  }
  return createProductionDb();
}

let instance: Db | undefined = globalThis.__vslFunnelDb;

function getDb(): Db {
  if (!instance) {
    instance = createDb();
    if (process.env.NODE_ENV !== "production") globalThis.__vslFunnelDb = instance;
  }
  return instance;
}

/** Connectée au premier accès, pas à l'import : `next build` ne doit pas exiger DATABASE_URL. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
