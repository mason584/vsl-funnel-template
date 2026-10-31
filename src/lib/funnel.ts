import { FORM } from "@/content/form";
import { LANDING } from "@/content/landing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES ÉTAPES DU TUNNEL — un seul endroit les ordonne.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'entonnoir de l'administration, la colonne « étape » de la table, le
 * filtre par étape et le garde qui empêche `stepReached` de rétrograder
 * lisent tous cette liste. Elle n'est pas écrite à la main : ce sont les
 * questions du formulaire, dans l'ordre, puis le créneau et la réservation.
 * Ajouter une question ajoute un étage.
 *
 * Les deux premiers étages ne sont pas des étapes de lead : ce sont des
 * visites (de la landing, puis du formulaire), comptées dans `visits`.
 */

export const LANDING_PATH = "/";
export const FORM_PATH = "/candidature";

export type Stage = {
  key: string;
  label: string;
  /** Libellé court, pour une colonne étroite. */
  short: string;
  rank: number;
};

function shorten(label: string): string {
  const clean = label.replace(/\s*\?$/, "");
  return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
}

/** Les étapes de lead — ce que `stepReached` peut valoir. */
export const LEAD_STAGES: Stage[] = [
  ...FORM.questions.map((q, i) => ({
    key: q.id,
    label: `${i + 1}. ${shorten(q.label)}`,
    short: `Q${i + 1}`,
    rank: i,
  })),
  {
    key: "slots",
    label: "Créneaux affichés",
    short: "Créneaux",
    rank: FORM.questions.length,
  },
  {
    key: "booked",
    label: "Rendez-vous pris",
    short: "RDV pris",
    rank: FORM.questions.length + 1,
  },
];

/** Le formulaire vit-il sous la vidéo (`inline`) ou sur sa page (`page`) ? */
export const FORM_INLINE = LANDING.form === "inline";

/**
 * Les étages de visite qui précèdent le premier écran. Formulaire sur sa
 * page : sa visite est une marche de plus ; formulaire sous la vidéo : la
 * landing est la seule marche avant le premier écran validé.
 */
export const VISIT_STAGES: { key: string; label: string; path: string }[] = FORM_INLINE
  ? [{ key: "landing", label: "Visites de la landing", path: LANDING_PATH }]
  : [
      { key: "landing", label: "Visites de la landing", path: LANDING_PATH },
      { key: "form", label: "Visites du formulaire", path: FORM_PATH },
    ];

const RANK = new Map(LEAD_STAGES.map((s) => [s.key, s.rank]));

/** Le rang d'une étape — « intro » et l'inconnu valent -1, pour ne jamais rétrograder. */
export function stageRank(step: string | null | undefined): number {
  return RANK.get(step ?? "") ?? -1;
}

export function stageLabel(step: string | null | undefined): string {
  return LEAD_STAGES.find((s) => s.key === step)?.label ?? step ?? "—";
}

export function stageShort(step: string | null | undefined): string {
  return LEAD_STAGES.find((s) => s.key === step)?.short ?? step ?? "—";
}

export function isStage(key: string | undefined): boolean {
  return Boolean(key) && RANK.has(key as string);
}
