/**
 * Vérification du contenu.
 *
 *   pnpm check
 *
 * Charge les quatre fichiers de `src/content/` : les schémas zod y sont
 * vérifiés au chargement, donc une faute de frappe échoue ici plutôt qu'au
 * premier visiteur. Puis quelques règles que zod ne peut pas dire seul.
 */
import { FORM } from "../src/content/form";
import { IMMERSION } from "../src/content/immersion";
import { LANDING } from "../src/content/landing";
import { THANKS } from "../src/content/thanks";

const problems: string[] = [];

// Une question éliminatoire doit venir AVANT les coordonnées : sinon on
// demande un email à quelqu'un qu'on va écarter à la question suivante — et
// surtout, il part vers iClosed avant d'être écarté.
const firstContact = FORM.questions.findIndex((q) => q.kind === "email" || q.kind === "phone");
FORM.questions.forEach((q, i) => {
  if (i > firstContact && q.options?.some((o) => o.disqualifies)) {
    problems.push(
      `« ${q.id} » élimine mais vient après les coordonnées : le lead part vers iClosed avant d'être écarté. Remonte-la.`
    );
  }
});

// Le nom d'événement Meta : 50 caractères, lettres, chiffres et underscore.
if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(THANKS.metaEventName)) {
  problems.push(`Nom d'événement Meta invalide : « ${THANKS.metaEventName} »`);
}

// Un mapping iClosed en double enverrait deux réponses dans le même champ.
const seen = new Map<string, string>();
for (const q of FORM.questions) {
  if (!q.iclosed) continue;
  const other = seen.get(q.iclosed);
  if (other) problems.push(`« ${q.id} » et « ${other} » visent le même champ iClosed « ${q.iclosed} »`);
  seen.set(q.iclosed, q.id);
}

const videos = [LANDING.video, THANKS.mainVideo, ...THANKS.breakouts.items.map((b) => b.video), ...IMMERSION.videos.map((v) => v.video)];
const missing = videos.filter((v) => v === null).length;

if (problems.length > 0) {
  console.error("✗ Contenu :");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `✓ Contenu valide — ${FORM.questions.length} questions, ${THANKS.breakouts.items.length} vidéos courtes, ${IMMERSION.videos.length} vidéos d'immersion.`
);
if (missing > 0) console.log(`  ${missing} vidéo(s) encore à poser (vignette d'attente affichée).`);
