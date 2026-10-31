/**
 * ═══════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ DE MARQUE — le pendant TypeScript de `tokens.css`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tout ce qui nomme l'entreprise vit ici : aucun composant n'écrit « Savoire »
 * en dur. Pour rebrander, on remplace ce fichier, `tokens.css`, et les images
 * de `public/brand/`.
 */

export type Brand = {
  /** Nom d'usage, celui qui s'affiche partout. */
  name: string;
  /** Raison sociale complète — mentions légales et politique de confidentialité. */
  legalName: string;
  /** Wordmark de l'en-tête : le texte, ou un logo dans public/brand/. */
  wordmark: { kind: "text"; text: string } | { kind: "image"; src: string; alt: string; height: number };
  /** Domaine canonique, sans barre oblique finale. Sert aux métadonnées. */
  siteUrl: string;
  /** Image de partage (LinkedIn, WhatsApp) — 1200 × 630. */
  ogImage: string;
  favicon: string;

  /** Contacts affichés dans les pages légales et le pied de page. */
  contact: {
    email: string;
    address?: string;
    /** Numéro d'immatriculation (SIREN, RCS…) — mentions légales. */
    registration?: string;
  };

  /** Liens sociaux du pied de page. Une entrée vide n'affiche rien. */
  social: { label: string; url: string }[];

  /**
   * Tutoiement ou vouvoiement. Les textes gabarits (pages légales,
   * messages d'erreur) s'y adaptent ; le contenu éditorial, lui, est écrit
   * à la main dans `src/content/`.
   */
  address: "tu" | "vous";

  /** Hébergeur, pour les mentions légales. */
  host: { name: string; address: string };

  /** Durée de conservation des réponses d'un lead, en mois. */
  retentionMonths: number;

  /**
   * Les cinq couleurs de base de la charte — les mêmes valeurs que dans
   * `tokens.css`, où la palette complète est écrite à la main.
   *
   * Cette duplication est volontaire et minime : l'administration permet de
   * surcharger une couleur sans toucher au code, et les variables dérivées
   * (gris, bordures, ombres) se recalculent à partir de celles qui restent par
   * défaut. Le code ne sait pas lire un fichier CSS ; il lui faut ces cinq
   * valeurs ici. Les changer dans un fichier sans l'autre désynchronise
   * l'aperçu de l'administration et le site.
   */
  colors: { bg: string; text: string; accent: string; inverse: string; panel: string };

  /**
   * Les polices par défaut. `google` porte la spécification à demander à
   * Google Fonts (famille et graisses) ; `null` pour une police auto-hébergée
   * déclarée en `@font-face` dans `tokens.css` ou une police système.
   */
  fonts: {
    display: { family: string; google: string | null };
    body: { family: string; google: string | null };
    mono: { family: string; google: string | null };
  };
};

export const BRAND: Brand = {
  name: "Savoire",
  legalName: "Savoire",
  wordmark: { kind: "text", text: "Savoire" },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000",
  ogImage: "/brand/og.png",
  favicon: "/brand/favicon.svg",

  contact: {
    email: "contact@savoire.io",
    address: undefined,
    registration: undefined,
  },

  social: [],

  address: "tu",

  host: {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  },

  retentionMonths: 24,

  colors: {
    bg: "#FEFAEB",
    text: "#221F1B",
    accent: "#E35A2E",
    inverse: "#221F1B",
    panel: "#FFFFFF",
  },

  fonts: {
    display: { family: "Cormorant Garamond", google: "Cormorant+Garamond:wght@400;500;600;700" },
    body: { family: "Hanken Grotesk", google: "Hanken+Grotesk:ital,wght@0,300..800;1,300..800" },
    mono: { family: "JetBrains Mono", google: "JetBrains+Mono:wght@400;500" },
  },
};
