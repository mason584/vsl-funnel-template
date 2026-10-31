import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FORM } from "@/content/form";
import { FormLoader } from "@/components/form/form-loader";
import { VisitPing } from "@/components/visit-ping";
import { resolveWordmark } from "@/lib/appearance";
import { getAppearance, getLogoVersion } from "@/lib/appearance-store";
import { FORM_INLINE, FORM_PATH } from "@/lib/funnel";
import { defaultCountry } from "@/lib/phone";

/**
 * Le formulaire de candidature, puis le choix du créneau.
 *
 * Sa visite est comptée à part de la landing : c'est la deuxième marche de
 * l'entonnoir, celle qui dit combien de gens cliquent le bouton après la vidéo.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Candidature",
  robots: { index: false, follow: false },
};

export default async function ApplyPage() {
  // Formulaire sous la vidéo : cette page n'existe plus, la landing fait tout.
  if (FORM_INLINE) redirect("/");

  // Vercel géolocalise chaque requête : le menu d'indicatifs démarre sur le
  // pays du visiteur. En local l'en-tête est absent — la France par défaut.
  const country = defaultCountry((await headers()).get("x-vercel-ip-country"));

  // Le formulaire est un composant client : il ne peut pas lire la base. Le
  // wordmark lui arrive résolu.
  const [appearance, logoVersion] = await Promise.all([getAppearance(), getLogoVersion()]);
  const mark = resolveWordmark(appearance, logoVersion);

  return (
    <>
      <VisitPing path={FORM_PATH} />
      <FormLoader form={FORM} defaultDialCountry={country} wordmark={mark} />
    </>
  );
}
