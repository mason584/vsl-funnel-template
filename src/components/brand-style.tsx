import { fontHrefs, overrideCss, type Appearance } from "@/lib/appearance";

/**
 * Les surcharges d'apparence, injectées dans la page.
 *
 * Rendu côté serveur, dans le layout : la page arrive déjà aux couleurs du
 * client. Les lire côté navigateur ferait clignoter la charte par défaut le
 * temps de l'hydratation — le défaut exact que la plateforme évite pour le
 * verrou de sa VSL.
 *
 * `precedence` demande à React de hisser ces balises dans `<head>` et de les
 * dédoublonner entre le layout du site et celui du questionnaire.
 */
export function BrandStyle({ appearance }: { appearance: Appearance }) {
  const css = overrideCss(appearance);
  const fonts = fontHrefs(appearance);

  return (
    <>
      {fonts.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="brand-fonts" />
      ))}
      {css && (
        <style href="brand-overrides" precedence="brand">
          {css}
        </style>
      )}
    </>
  );
}
