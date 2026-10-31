import { BrandStyle } from "@/components/brand-style";
import { PublicTracking } from "@/components/public-tracking";
import { getAppearance } from "@/lib/appearance-store";

/**
 * Le questionnaire, sans le décor du site.
 *
 * Ni en-tête ni pied de page : une question par écran suppose que l'écran
 * n'appartienne qu'à la question. Le formulaire pose son propre wordmark et
 * son compteur, et rien d'autre ne doit disputer l'attention.
 *
 * Le pixel, lui, reste monté : la page fait partie du tunnel mesuré.
 */
export default async function FormLayout({ children }: { children: React.ReactNode }) {
  const appearance = await getAppearance();
  return (
    <>
      <BrandStyle appearance={appearance} />
      {children}
      <PublicTracking />
    </>
  );
}
