import { MetaPixel } from "@/components/meta-pixel";
import { getMetaSettings } from "@/lib/settings";

/**
 * Les traceurs des pages publiques.
 *
 * Extrait pour être monté par les deux layouts publics — le site et le
 * questionnaire — sans dupliquer la lecture des réglages. Il n'est jamais
 * monté par le layout racine : `/admin` ne doit ni être pisté, ni polluer
 * l'attribution des campagnes avec notre trafic interne.
 */
export async function PublicTracking() {
  const { pixelId } = await getMetaSettings();
  return <MetaPixel pixelId={pixelId} />;
}
