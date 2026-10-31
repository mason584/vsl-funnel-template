/**
 * Sidecar de la base d'aperçu.
 *
 * PGlite embarqué DANS le processus Next se faisait tuer par les
 * rechargements de Turbopack — base corrompue à répétition. Ici la base vit
 * dans son propre processus, exposée en protocole Postgres sur
 * 127.0.0.1:5504. Next s'y connecte comme à une vraie base : il peut
 * redémarrer, planter, recompiler, la base ne bouge pas.
 *
 * Le port est volontairement inhabituel : il ne heurte ni un Postgres local
 * (5432), ni un autre aperçu du même genre sur la machine.
 *
 * Lancé automatiquement par `pnpm preview`.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const HOST = "127.0.0.1";
const PORT = 5504;

async function main() {
  let db: PGlite;
  try {
    db = await PGlite.create(".preview-db");
    await db.query("select 1");
  } catch (error) {
    console.error("✗ Impossible d'ouvrir .preview-db — base absente ou corrompue.");
    console.error("  Répare avec : pnpm preview:setup");
    console.error(String(error));
    process.exit(1);
  }

  const server = new PGLiteSocketServer({ db, host: HOST, port: PORT });

  try {
    await server.start();
  } catch (error) {
    // Le cas courant, et son message brut n'aide personne : un `pnpm preview`
    // tourne déjà ailleurs (autre terminal, ou processus resté en vie après
    // la fermeture de son onglet). Deux sidecars sur la même base la
    // corrompraient — on refuse plutôt que d'insister.
    if ((error as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
      console.error(`✗ Le port ${PORT} est déjà pris : un aperçu tourne déjà.`);
      console.error("  Ferme-le, ou libère le port :");
      console.error(`    lsof -ti:${PORT} | xargs kill`);
      await db.close();
      process.exit(1);
    }
    throw error;
  }

  console.log(`✓ Base d'aperçu prête sur ${HOST}:${PORT}`);

  const stop = async () => {
    // Fermeture propre — c'est elle qui évite les corruptions.
    try {
      await server.stop();
      await db.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error("✗ Sidecar base d'aperçu :", error);
  process.exit(1);
});
