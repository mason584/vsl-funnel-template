import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { IS_PREVIEW } from "@/lib/preview";
import { appearanceSchema, EMPTY_APPEARANCE, type Appearance } from "@/lib/appearance";

/**
 * L'apparence en base — lecture et écriture.
 *
 * Deux clés dans `settings` : `appearance` (petit objet, lu à chaque page
 * publique) et `logo` (l'image, lue uniquement par `/api/logo`). Les séparer
 * évite de charger une image à chaque rendu pour savoir de quelle couleur
 * sont les boutons.
 */

export const APPEARANCE_KEY = "appearance";
export const LOGO_KEY = "logo";

export type StoredLogo = { mime: string; data: string; updatedAt: number };

export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_MIMES = ["image/svg+xml", "image/png", "image/webp", "image/jpeg"];

function hasDatabase(): boolean {
  return IS_PREVIEW || Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

/**
 * L'apparence enregistrée, ou l'apparence vide (charte par défaut).
 *
 * Mise en cache par requête (`cache` de React) : le layout et la page la
 * lisent tous deux, une seule requête part. Une base injoignable ou une
 * valeur illisible ne doit jamais faire tomber une page publique : on sert
 * la charte par défaut, quitte à ignorer un réglage.
 */
export const getAppearance = cache(async (): Promise<Appearance> => {
  if (!hasDatabase()) return EMPTY_APPEARANCE;
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, APPEARANCE_KEY))
      .limit(1);
    const parsed = appearanceSchema.safeParse(row?.value ?? EMPTY_APPEARANCE);
    return parsed.success ? parsed.data : EMPTY_APPEARANCE;
  } catch (error) {
    console.error("Apparence illisible, charte par défaut appliquée", error);
    return EMPTY_APPEARANCE;
  }
});

/** L'horodatage du logo téléversé, ou null s'il n'y en a pas. Sert à casser le cache. */
export const getLogoVersion = cache(async (): Promise<number | null> => {
  if (!hasDatabase()) return null;
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, LOGO_KEY))
      .limit(1);
    const logo = row?.value as Partial<StoredLogo> | undefined;
    return typeof logo?.updatedAt === "number" ? logo.updatedAt : null;
  } catch {
    return null;
  }
});

export async function getLogo(): Promise<StoredLogo | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, LOGO_KEY))
    .limit(1);
  const logo = row?.value as Partial<StoredLogo> | undefined;
  if (!logo?.mime || !logo.data) return null;
  return { mime: logo.mime, data: logo.data, updatedAt: logo.updatedAt ?? 0 };
}

async function upsert(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as object, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as object, updatedAt: new Date() } });
}

export async function saveAppearance(next: Appearance): Promise<void> {
  await upsert(APPEARANCE_KEY, appearanceSchema.parse(next));
}

export async function resetAppearance(): Promise<void> {
  await db.delete(settings).where(eq(settings.key, APPEARANCE_KEY));
}

export async function saveLogo(mime: string, bytes: Buffer): Promise<number> {
  const updatedAt = Date.now();
  await upsert(LOGO_KEY, {
    mime,
    data: bytes.toString("base64"),
    updatedAt,
  } satisfies StoredLogo);
  return updatedAt;
}

export async function deleteLogo(): Promise<void> {
  await db.delete(settings).where(eq(settings.key, LOGO_KEY));
}
