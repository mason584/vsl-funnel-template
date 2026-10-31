/**
 * Base d'aperçu — un jeu de démonstration réaliste, pour cliquer dans tout le
 * produit avant d'avoir créé le moindre compte.
 *
 *   pnpm preview:setup
 *
 * Efface et reconstruit `.preview-db`. Le sidecar doit être arrêté.
 *
 * Le jeu dessine un entonnoir plausible sur trente jours : des visites de la
 * landing venues de trois sources, un quart qui ouvre le formulaire, des leads
 * arrêtés à chaque question, quelques hors critères, et des rendez-vous pris —
 * certains venus de Meta (événement envoyé), d'autres non.
 */
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { FORM } from "../content/form";
import * as schema from "./schema";
import { leads, visits } from "./schema";

const PORT = 5504;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

/** Un générateur déterministe : le même jeu à chaque `preview:setup`. */
let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const SOURCES: { utm: Record<string, string>; weight: number; meta: string | null }[] = [
  {
    utm: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "vsl-mars", utm_content: "hook-a", fbclid: "IwAR3demo" },
    weight: 5,
    meta: "fbclid",
  },
  {
    utm: { utm_source: "instagram", utm_medium: "paid", utm_campaign: "vsl-mars", utm_content: "hook-b", fbclid: "IwAR3demo2" },
    weight: 3,
    meta: "fbclid",
  },
  { utm: { utm_source: "youtube", utm_medium: "video", utm_campaign: "episode-12" }, weight: 2, meta: null },
  { utm: {}, weight: 2, meta: null },
];

function pickSource() {
  const total = SOURCES.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const s of SOURCES) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SOURCES[SOURCES.length - 1];
}

const FIRST = ["Camille", "Rachid", "Léa", "Sofiane", "Inès", "Thomas", "Awa", "Hugo", "Nadia", "Paul", "Lina", "Yanis", "Chloé", "Marc", "Sonia", "Bilal", "Lucas", "Amandine", "Karim", "Julie"];
const LAST = ["Verlaine", "Benali", "Morin", "Diallo", "Lefèvre", "Garcia", "Petit", "Roux", "Fontaine", "Nguyen"];
const ACTIVITIES = [
  "Accompagnement pour coachs sportifs, 4 500 € le programme",
  "Agence de génération de leads pour artisans, 1 500 €/mois",
  "Formation en ligne pour kinés, 2 900 €",
  "Consulting RH pour PME, 8 000 € la mission",
  "Coaching business pour thérapeutes, 3 000 € les trois mois",
];
const ACQUISITION = [
  "Organique Instagram, une dizaine de nouveaux clients par mois",
  "Bouche-à-oreille et LinkedIn, 3 à 5 clients par mois",
  "Ads Meta, une vingtaine de calls par mois",
  "YouTube et newsletter, 6 clients par mois",
];
const BLOCKER = [
  "Je ne peux pas remplir l'agenda de mes closers de façon régulière",
  "Je suis seul sur la vente et je plafonne",
  "Mes ads ne sont pas rentables, je ne sais pas pourquoi",
  "Pas de système, tout dépend de mon contenu",
];
const GOAL = ["150 K€/mois avec deux closers", "50 K€/mois sans moi sur les calls", "300 K€/mois", "100 K€/mois stables"];
const QUALIF =
  "Douze ans de métier, plus de deux cents clients accompagnés, des résultats documentés avec des témoignages vidéo. Mon offre inclut un suivi hebdomadaire que personne d'autre ne propose à ce prix.";

const REVENUE_OPTIONS = FORM.questions.find((q) => q.id === "revenue")?.options ?? [];
const QUALIFYING = REVENUE_OPTIONS.filter((o) => !o.disqualifies).map((o) => o.label);
const DQ = REVENUE_OPTIONS.find((o) => o.disqualifies)?.label ?? "0 – 10 K€ / mois";

async function main() {
  const sidecarUp = await new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: PORT });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 500);
  });
  if (sidecarUp) {
    console.error(`✗ L'aperçu tourne encore (base ouverte sur 127.0.0.1:${PORT}).`);
    console.error("  Arrête `pnpm preview` avant de relancer preview:setup.");
    process.exit(1);
  }

  console.log("→ Réinitialisation de la base d'aperçu…");
  rmSync(".preview-db", { recursive: true, force: true });

  const client = new PGlite(".preview-db");
  const db = drizzle(client, { schema });

  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
  console.log(`  ✓ schéma appliqué (${files.length} fichier(s))`);

  /* ── Visites et leads, session par session ─────────────────────────── */

  const visitRows: (typeof visits.$inferInsert)[] = [];
  const leadRows: (typeof leads.$inferInsert)[] = [];

  const REVIEW_REJECTIONS = [
    "Les réponses libres se répètent mot pour mot : remplissage, pas une candidature.",
    "Salarié qui cherche une formation, pas un dirigeant : hors du profil recherché.",
    "Identité de test (« test » dans le nom ou l'email, ou domaine jetable).",
    "Agence qui propose ses services : ce n'est pas un prospect, c'est un fournisseur.",
  ];

  const SESSIONS = 240;
  for (let i = 0; i < SESSIONS; i++) {
    const source = pickSource();
    const age = rand() * 30 * 24; // heures
    const sessionId = `demo-${String(i).padStart(3, "0")}`;
    const query = new URLSearchParams(source.utm).toString();
    const landingUrl = `https://exemple.com/${query ? `?${query}` : ""}`;
    const base = { sessionId, utm: source.utm, landingUrl, country: pick(["FR", "FR", "FR", "BE", "CH", "MA"]) };

    visitRows.push({ ...base, path: "/", referrer: source.meta ? "https://l.instagram.com/" : null, createdAt: hoursAgo(age) });

    // Un quart ouvre le formulaire.
    if (rand() > 0.28) continue;
    visitRows.push({ ...base, path: "/candidature", createdAt: hoursAgo(age - 0.1) });

    // Les deux tiers de ceux-là valident le premier écran.
    if (rand() > 0.68) continue;

    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const email = `${firstName.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${lastName.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@exemple.com`;
    const phone = `+336${String(10000000 + Math.floor(rand() * 89999999))}`;

    // Jusqu'où va ce lead ? Les ids sont ceux de src/content/form.ts.
    const order = FORM.questions.map((q) => q.id);
    const answers: Record<string, unknown> = { identity: { first: firstName, last: lastName } };
    let step = "identity";
    let status = "partial";
    let disqualifiedBy: string[] = [];
    let completedAt: Date | null = null;

    const dq = rand() < 0.14;
    // L'élimination tombe sur la question de CA, où qu'elle soit dans l'ordre.
    const revenueIndex = Math.max(1, order.indexOf("revenue"));
    // Un tiers des leads qualifiés réservent, un dixième s'arrêtent devant les
    // créneaux, les autres décrochent à une question — c'est un entonnoir
    // plausible, pas une statistique.
    const roll = rand();
    const depth = dq
      ? revenueIndex
      : roll < 0.33
        ? order.length + 1 // booked
        : roll < 0.43
          ? order.length // slots
          : 1 + Math.floor(rand() * (order.length - 1));
    const fill = (id: string) => {
      switch (id) {
        case "revenue":
          answers.revenue = { choice: dq ? DQ : pick(QUALIFYING) };
          break;
        case "email":
          answers.email = email;
          break;
        case "phone":
          answers.phone = phone;
          break;
        case "activity":
          answers.activity = pick(ACTIVITIES);
          break;
        case "acquisition":
          answers.acquisition = pick(ACQUISITION);
          break;
        case "blocker":
          answers.blocker = pick(BLOCKER);
          break;
        case "goal":
          answers.goal = pick(GOAL);
          break;
        case "qualification":
          answers.qualification = QUALIF;
          break;
      }
    };

    for (let k = 1; k <= Math.min(depth, order.length - 1); k++) {
      fill(order[k]);
      step = order[k];
    }
    if (dq) {
      status = "disqualified";
      disqualifiedBy = ["revenue"];
      completedAt = hoursAgo(age - 0.15);
    } else if (depth === order.length) {
      step = "slots";
      status = "qualified";
    } else if (depth > order.length) {
      step = "booked";
      status = "booked";
      completedAt = hoursAgo(age - 0.3);
    }

    const hasContact = "email" in answers || "phone" in answers;
    const booked = status === "booked";
    // La relecture IA, sur les réservations venues de Meta : un sur sept est
    // écarté, pour que la fiche, la liste et l'export montrent les deux cas.
    const reviewed = booked && Boolean(source.meta);
    const rejected = reviewed && rand() < 0.15;
    const review = reviewed
      ? {
          reviewVerdict: rejected ? "unqualified" : "qualified",
          reviewReason: rejected
            ? pick(REVIEW_REJECTIONS)
            : "Profil dans la cible, réponses cohérentes entre elles et avec le chiffre d'affaires déclaré.",
          reviewSource: rejected && rand() < 0.3 ? "garde" : "claude-opus-5-5",
          reviewedAt: hoursAgo(age - 0.29),
        }
      : {};
    const slot = booked ? new Date(Date.now() + (1 + Math.floor(rand() * 5)) * 24 * 3600 * 1000) : null;
    if (slot) slot.setUTCHours(8 + Math.floor(rand() * 8), rand() > 0.5 ? 0 : 30, 0, 0);

    leadRows.push({
      sessionId,
      firstName,
      lastName,
      email: hasContact ? email : null,
      phoneNumber: hasContact ? phone : null,
      answers,
      stepReached: step,
      status,
      disqualifiedBy,
      iclosedContactId: hasContact ? String(5000000 + i) : null,
      iclosedBookingId: booked ? String(900000 + i) : null,
      slotIso: slot ? slot.toISOString() : null,
      metaTouch: source.meta,
      metaEventSentAt: booked && source.meta && !rejected ? hoursAgo(age - 0.3) : null,
      metaEventDetail: booked
        ? rejected
          ? "Écartée par la relecture — aucun événement envoyé."
          : source.meta
            ? `events_received=1 · fbtrace A${i}demo`
            : "Trafic hors Meta — aucun événement envoyé."
        : null,
      ...review,
      landingUrl,
      utm: source.utm,
      fbc: source.meta ? `fb.1.${Date.now()}.${source.utm.fbclid}` : null,
      fbp: `fb.1.${Date.now()}.demo${i}`,
      createdAt: hoursAgo(age - 0.1),
      updatedAt: hoursAgo(age - 0.1 - rand() * 0.15),
      completedAt,
    });

    if (booked) {
      visitRows.push({ ...base, path: "/merci", createdAt: hoursAgo(age - 0.3) });
      if (rand() < 0.7) visitRows.push({ ...base, path: "/immersion", createdAt: hoursAgo(age - 0.35) });
    }
    if (dq) visitRows.push({ ...base, path: "/suite", createdAt: hoursAgo(age - 0.15) });
  }

  for (let i = 0; i < visitRows.length; i += 100) await db.insert(visits).values(visitRows.slice(i, i + 100));
  for (let i = 0; i < leadRows.length; i += 100) await db.insert(leads).values(leadRows.slice(i, i + 100));

  const booked = leadRows.filter((l) => l.status === "booked").length;
  console.log(`  ✓ ${visitRows.length} visites · ${leadRows.length} leads · ${booked} rendez-vous`);

  console.log("\n✓ Base d'aperçu prête. Lance `pnpm preview`.\n");
  await client.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("✗ Échec du seed :", error);
  process.exit(1);
});
