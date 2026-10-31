import { BRAND } from "@/brand/brand";

/**
 * Les polices Google de la charte par défaut, déclarées dans `brand.ts`.
 *
 * Chargées ici plutôt que par un `@import` dans la feuille de style : Tailwind
 * inline `tokens.css` au milieu de la feuille compilée, et un `@import` qui
 * n'est pas en tête de fichier est ignoré par le navigateur. Le layout racine
 * monte ce composant, donc l'administration comme le site public reçoivent
 * les polices.
 */
export function DefaultFonts() {
  const specs = [BRAND.fonts.display, BRAND.fonts.body, BRAND.fonts.mono]
    .map((f) => f.google)
    .filter((g): g is string => Boolean(g));

  if (specs.length === 0) return null;

  const href = `https://fonts.googleapis.com/css2?${specs.map((s) => `family=${s}`).join("&")}&display=swap`;
  return <link rel="stylesheet" href={href} precedence="brand-fonts" />;
}
