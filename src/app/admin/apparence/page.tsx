import { BRAND } from "@/brand/brand";
import { requireAdmin } from "@/lib/admin";
import { defaultColors } from "@/lib/appearance";
import { getAppearance, getLogoVersion } from "@/lib/appearance-store";
import { AppearanceForm } from "./form";

/**
 * L'apparence — couleurs, polices, wordmark et rayons, sans toucher au code.
 *
 * Même principe que le pixel Meta : ce qui est saisi ici vit en base, est lu
 * côté serveur et s'applique aux pages publiques sans redéploiement.
 * L'administration, elle, garde la charte par défaut : quelle que soit la
 * couleur choisie, cette page reste lisible pour la corriger.
 */
export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  await requireAdmin();
  const [appearance, logoVersion] = await Promise.all([getAppearance(), getLogoVersion()]);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-[32px]">Apparence</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
        Les couleurs, les polices et le logo du site public. L&apos;aperçu à droite montre un
        écran du formulaire tel que le visiteur le verra. Les réglages laissés vides gardent
        la charte par défaut.
      </p>

      <AppearanceForm
        initial={appearance}
        logoVersion={logoVersion}
        defaults={{
          colors: defaultColors(),
          displayFamily: BRAND.fonts.display.family,
          bodyFamily: BRAND.fonts.body.family,
          wordmarkText: BRAND.wordmark.kind === "text" ? BRAND.wordmark.text : BRAND.name,
        }}
        brandName={BRAND.name}
      />
    </div>
  );
}
