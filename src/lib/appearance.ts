import { z } from "zod";
import { BRAND } from "@/brand/brand";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * L'APPARENCE — le rebranding sans toucher au code.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `src/brand/tokens.css` reste la charte par défaut, écrite à la main. Ce
 * module produit des **surcharges** à partir de cinq couleurs, deux polices,
 * un wordmark et un rayon, saisis dans l'administration et stockés en base :
 * le même mécanisme que le pixel Meta, lu côté serveur et injecté dans la
 * page, donc sans redéploiement et sans clignotement.
 *
 * Tout ici est pur — aucune lecture de base, aucun `server-only` — parce que
 * l'aperçu en direct de l'administration recalcule exactement la même chose
 * dans le navigateur, à chaque frappe. Une seule fonction de dérivation, deux
 * consommateurs : ce qu'on voit dans l'aperçu est ce que le site servira.
 */

/* ── Le schéma ─────────────────────────────────────────────────────────── */

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "couleur attendue au format #RRGGBB")
  .transform((v) => v.toLowerCase());

const fontFamily = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9 .'-]+$/, "nom de police : lettres, chiffres, espaces");

export const appearanceSchema = z.object({
  colors: z
    .object({
      /** Fond général. */
      bg: hex,
      /** Texte principal et titres. */
      text: hex,
      /** Boutons, barre de progression, sélection. */
      accent: hex,
      /** Boutons sombres, blocs inversés. */
      inverse: hex,
      /** Cartes et panneaux. */
      panel: hex,
    })
    .partial(),
  fonts: z
    .object({
      display: z.object({ family: fontFamily, google: z.boolean() }),
      body: z.object({ family: fontFamily, google: z.boolean() }),
      displayWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
    })
    .partial(),
  wordmark: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(40) }),
      z.object({ kind: z.literal("image"), height: z.number().int().min(16).max(80) }),
    ])
    .optional(),
  radius: z.enum(["none", "soft", "round"]).optional(),
});

/** Ce qui est enregistré : chaque champ absent retombe sur la charte par défaut. */
export type Appearance = z.infer<typeof appearanceSchema>;

export const EMPTY_APPEARANCE: Appearance = { colors: {}, fonts: {} };

/* ── Les valeurs par défaut, lues dans brand.ts ────────────────────────── */

type ColorKnob = keyof NonNullable<Appearance["colors"]>;

export function defaultColors(): Record<ColorKnob, string> {
  return { ...BRAND.colors };
}

/* ── Arithmétique des couleurs ─────────────────────────────────────────── */

type Rgb = [number, number, number];

function toRgb(h: string): Rgb {
  const v = h.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mélange `a` vers `b`, `t` étant la part de `b` (0 à 1). */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

function alpha(h: string, a: number): string {
  const [r, g, b] = toRgb(h);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Luminance relative (WCAG), pour choisir un texte lisible sur un fond. */
function luminance(h: string): number {
  const lin = toRgb(h).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Celle des deux couleurs de la marque qui se lit le mieux sur `background`. */
function readableOn(background: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrast(background, c) > contrast(background, best) ? c : best));
}

/* ── Dérivation ────────────────────────────────────────────────────────── */

/**
 * Chaque variable dérivée déclare les boutons dont elle dépend. On ne
 * surcharge une variable que si l'un de ses boutons a été modifié : un
 * client qui change seulement l'accent garde les gris de la charte par
 * défaut, réglés à la main, au lieu de gris recalculés.
 */
const DERIVED: { name: string; inputs: ColorKnob[]; compute: (c: Record<ColorKnob, string>) => string }[] = [
  { name: "--bg", inputs: ["bg"], compute: (c) => c.bg },
  { name: "--bg-deep", inputs: ["bg", "text"], compute: (c) => mix(c.bg, c.text, 0.08) },
  { name: "--panel", inputs: ["panel"], compute: (c) => c.panel },
  { name: "--panel-accent", inputs: ["bg", "accent"], compute: (c) => mix(c.bg, c.accent, 0.1) },

  { name: "--text", inputs: ["text"], compute: (c) => c.text },
  { name: "--text-strong", inputs: ["text"], compute: (c) => c.text },
  { name: "--text-secondary", inputs: ["text", "bg"], compute: (c) => mix(c.text, c.bg, 0.3) },
  { name: "--text-muted", inputs: ["text", "bg"], compute: (c) => mix(c.text, c.bg, 0.52) },
  { name: "--tan", inputs: ["text", "bg"], compute: (c) => mix(c.text, c.bg, 0.62) },

  { name: "--accent", inputs: ["accent"], compute: (c) => c.accent },
  { name: "--accent-deep", inputs: ["accent"], compute: (c) => mix(c.accent, "#000000", 0.15) },
  { name: "--accent-soft", inputs: ["accent"], compute: (c) => alpha(c.accent, 0.14) },
  { name: "--link", inputs: ["accent"], compute: (c) => mix(c.accent, "#000000", 0.15) },
  {
    name: "--text-on-accent",
    inputs: ["accent", "bg", "text"],
    compute: (c) => readableOn(c.accent, [c.bg, c.text]),
  },

  { name: "--inverse", inputs: ["inverse"], compute: (c) => c.inverse },
  { name: "--inverse-soft", inputs: ["inverse"], compute: (c) => mix(c.inverse, "#ffffff", 0.1) },
  {
    name: "--text-on-inverse",
    inputs: ["inverse", "bg", "text"],
    compute: (c) => readableOn(c.inverse, [c.bg, c.text]),
  },

  { name: "--border-soft", inputs: ["text"], compute: (c) => alpha(c.text, 0.08) },
  { name: "--border-strong", inputs: ["text"], compute: (c) => alpha(c.text, 0.14) },
  { name: "--border-input", inputs: ["text"], compute: (c) => alpha(c.text, 0.28) },
  { name: "--shadow-soft", inputs: ["text"], compute: (c) => `0 2px 8px ${alpha(c.text, 0.06)}` },
  { name: "--shadow-strong", inputs: ["text"], compute: (c) => `0 8px 24px ${alpha(c.text, 0.08)}` },
];

const RADIUS: Record<NonNullable<Appearance["radius"]>, { base: string; lg: string }> = {
  none: { base: "0", lg: "0" },
  soft: { base: "0.375rem", lg: "0.625rem" },
  round: { base: "0.75rem", lg: "1rem" },
};

/** Les déclarations CSS à injecter — une par variable réellement surchargée. */
export function overrideDeclarations(a: Appearance): Record<string, string> {
  const out: Record<string, string> = {};
  const overridden = new Set(Object.keys(a.colors ?? {}) as ColorKnob[]);

  if (overridden.size > 0) {
    const effective = { ...defaultColors(), ...(a.colors ?? {}) } as Record<ColorKnob, string>;
    for (const d of DERIVED) {
      if (d.inputs.some((i) => overridden.has(i))) out[d.name] = d.compute(effective);
    }
  }

  const fonts = a.fonts ?? {};
  if (fonts.display) out["--font-display"] = `'${fonts.display.family}', Georgia, serif`;
  if (fonts.body) out["--font-body"] = `'${fonts.body.family}', system-ui, sans-serif`;
  if (fonts.displayWeight) out["--display-weight"] = String(fonts.displayWeight);
  // Une display grasse et géométrique se lit mal serrée, là où une serif fine
  // supporte -0.02em. On desserre dès que la graisse monte.
  if (fonts.displayWeight && fonts.displayWeight >= 600) out["--display-tracking"] = "-0.01em";

  if (a.radius) {
    out["--radius"] = RADIUS[a.radius].base;
    out["--radius-lg"] = RADIUS[a.radius].lg;
  }

  return out;
}

/** Le bloc `:root { … }` correspondant, ou une chaîne vide si rien n'est surchargé. */
export function overrideCss(a: Appearance): string {
  const decl = overrideDeclarations(a);
  const lines = Object.entries(decl).map(([k, v]) => `${k}:${v};`);
  return lines.length > 0 ? `:root{${lines.join("")}}` : "";
}

/* ── Polices ───────────────────────────────────────────────────────────── */

/**
 * Les feuilles Google Fonts à charger pour une famille.
 *
 * Deux liens plutôt qu'un : la requête sans axe est toujours valable si la
 * famille existe, celle avec les graisses échoue en bloc dès qu'une graisse
 * manque (Google renvoie 400 sur toute la requête). Si la seconde échoue, le
 * navigateur garde la première et synthétise le gras — dégradé, jamais cassé.
 */
export function googleFontHrefs(family: string): string[] {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  return [
    `https://fonts.googleapis.com/css2?family=${name}&display=swap`,
    `https://fonts.googleapis.com/css2?family=${name}:wght@500;600;700&display=swap`,
  ];
}

/** Toutes les feuilles à charger pour cette apparence (polices Google surchargées). */
export function fontHrefs(a: Appearance): string[] {
  const fonts = a.fonts ?? {};
  const hrefs: string[] = [];
  if (fonts.display?.google) hrefs.push(...googleFontHrefs(fonts.display.family));
  if (fonts.body?.google && fonts.body.family !== fonts.display?.family) {
    hrefs.push(...googleFontHrefs(fonts.body.family));
  }
  return hrefs;
}

/* ── Wordmark ──────────────────────────────────────────────────────────── */

export type ResolvedWordmark =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; alt: string; height: number };

/**
 * Le wordmark effectif : celui de l'administration s'il est défini, sinon
 * celui de `brand.ts`. `logoVersion` casse le cache de l'image à chaque
 * nouveau téléversement.
 */
export function resolveWordmark(a: Appearance, logoVersion: number | null): ResolvedWordmark {
  if (a.wordmark?.kind === "image" && logoVersion) {
    return {
      kind: "image",
      src: `/api/logo?v=${logoVersion}`,
      alt: BRAND.name,
      height: a.wordmark.height,
    };
  }
  if (a.wordmark?.kind === "text") return { kind: "text", text: a.wordmark.text };

  const w = BRAND.wordmark;
  return w.kind === "image"
    ? { kind: "image", src: w.src, alt: w.alt, height: w.height }
    : { kind: "text", text: w.text };
}
