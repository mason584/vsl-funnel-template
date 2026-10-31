"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appearanceSchema, type Appearance } from "@/lib/appearance";
import {
  deleteLogo,
  getAppearance,
  getLogoVersion,
  LOGO_MAX_BYTES,
  LOGO_MIMES,
  resetAppearance as resetStored,
  saveAppearance,
  saveLogo,
} from "@/lib/appearance-store";

/**
 * Les actions de la page d'apparence. Le garde est dans chaque action : une
 * action serveur est une route publique.
 */

export type ActionResult = { ok: boolean; detail: string };

/**
 * Enregistre l'apparence.
 *
 * Le formulaire envoie l'objet complet en JSON plutôt qu'un champ par
 * réglage : c'est le même objet que l'aperçu en direct a validé à l'écran,
 * et il n'y a rien à reconstruire ni à interpréter côté serveur.
 */
export async function updateAppearance(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  let draft: Appearance;
  try {
    const parsed = appearanceSchema.safeParse(JSON.parse(String(formData.get("appearance") ?? "{}")));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, detail: `Réglage invalide — ${first?.path.join(".")} : ${first?.message}` };
    }
    draft = parsed.data;
  } catch {
    return { ok: false, detail: "Réglages illisibles." };
  }

  // Le logo, s'il y en a un nouveau.
  const file = formData.get("logo");
  let uploaded = false;
  if (file instanceof File && file.size > 0) {
    if (!LOGO_MIMES.includes(file.type)) {
      return { ok: false, detail: "Logo : formats acceptés SVG, PNG, WebP ou JPEG." };
    }
    if (file.size > LOGO_MAX_BYTES) {
      return {
        ok: false,
        detail: `Logo : ${Math.round(file.size / 1024)} Ko, maximum ${LOGO_MAX_BYTES / 1024} Ko.`,
      };
    }
    try {
      await saveLogo(file.type, Buffer.from(await file.arrayBuffer()));
      uploaded = true;
    } catch (error) {
      console.error("Logo non enregistré", error);
      return { ok: false, detail: "Logo non enregistré — la base est injoignable." };
    }
  }

  // Choisir « logo » sans en avoir téléversé un afficherait une image cassée.
  if (draft.wordmark?.kind === "image" && !uploaded && !(await getLogoVersion())) {
    return { ok: false, detail: "Téléverse un logo, ou reviens au wordmark texte." };
  }

  try {
    await saveAppearance(draft);
  } catch (error) {
    console.error("Apparence non enregistrée", error);
    return { ok: false, detail: "Enregistrement impossible — la base est injoignable." };
  }

  revalidatePath("/", "layout");
  return { ok: true, detail: "Apparence enregistrée. Elle s'applique à la page suivante du site." };
}

/** Revient à la charte de `brand.ts` : supprime les surcharges et le logo. */
export async function resetAppearance(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await resetStored();
    await deleteLogo();
  } catch (error) {
    console.error("Apparence non réinitialisée", error);
    return { ok: false, detail: "Réinitialisation impossible — la base est injoignable." };
  }
  revalidatePath("/", "layout");
  return { ok: true, detail: "Charte par défaut rétablie." };
}

/** Retire le logo et repasse le wordmark en texte s'il en dépendait. */
export async function removeLogo(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await deleteLogo();
    const current = await getAppearance();
    if (current.wordmark?.kind === "image") {
      await saveAppearance({ ...current, wordmark: undefined });
    }
  } catch (error) {
    console.error("Logo non retiré", error);
    return { ok: false, detail: "Suppression impossible — la base est injoignable." };
  }
  revalidatePath("/", "layout");
  return { ok: true, detail: "Logo retiré." };
}
