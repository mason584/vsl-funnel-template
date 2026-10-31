import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { iclosedEnvFallback, metaEnvFallback, reviewEnvFallback } from "@/lib/env";
import { IS_PREVIEW } from "@/lib/preview";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES RÉGLAGES — Meta, iClosed et le verrou, modifiables sans redéploiement.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Vercel fige les variables d'environnement au build : « je colle mon pixel
 * et il s'affiche sur tout le site » ne peut donc pas passer par elles. Les
 * valeurs saisies dans /admin/reglages ont la priorité, l'environnement sert
 * de repli pour un déploiement scripté.
 */

function hasDatabase(): boolean {
  // Aucune base configurée : c'est le cas pendant `next build`, qui prérend
  // les pages statiques sans environnement. Interroger la base y produirait
  // une erreur rattrapée mais bruyante à chaque page.
  return IS_PREVIEW || Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

async function readSetting(key: string): Promise<Record<string, unknown>> {
  if (!hasDatabase()) return {};
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return ((row?.value ?? {}) as Record<string, unknown>) ?? {};
}

async function writeSetting(key: string, value: object): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** « configuré · …a4f2 » — de quoi vérifier sans jamais réafficher le secret. */
export function maskToken(token: string): string {
  if (!token) return "";
  return `…${token.slice(-4)}`;
}

/* ── Meta ───────────────────────────────────────────────────────────────── */

export const META_KEY = "meta";

export type MetaSettings = {
  /** Identifiant du dataset (« pixel »). Public : il vit dans la page. */
  pixelId: string;
  /** Token de la Conversions API. Serveur uniquement, jamais réaffiché. */
  capiToken: string;
  /** Code de l'onglet « Événements de test » d'Events Manager. */
  testEventCode: string;
};

const META_EMPTY: MetaSettings = { pixelId: "", capiToken: "", testEventCode: "" };

/**
 * Les réglages effectifs. Une base injoignable ne doit pas faire tomber une
 * page publique : on retombe sur l'environnement, quitte à perdre le pixel.
 */
export const getMetaSettings = cache(async (): Promise<MetaSettings> => {
  const fallback: MetaSettings = { ...META_EMPTY, ...metaEnvFallback() };
  try {
    const raw = await readSetting(META_KEY);
    return {
      pixelId: str(raw.pixelId) || fallback.pixelId,
      capiToken: str(raw.capiToken) || fallback.capiToken,
      testEventCode: str(raw.testEventCode),
    };
  } catch (error) {
    console.error("Réglages Meta illisibles, repli sur l'environnement", error);
    return fallback;
  }
});

/**
 * Enregistre les réglages. Un champ laissé vide **conserve** la valeur
 * existante : le token n'étant jamais réaffiché, un formulaire soumis pour
 * changer le seul pixel l'effacerait autrement.
 */
export async function saveMetaSettings(next: Partial<MetaSettings>): Promise<void> {
  const raw = await readSetting(META_KEY);
  const current = { ...META_EMPTY, pixelId: str(raw.pixelId), capiToken: str(raw.capiToken), testEventCode: str(raw.testEventCode) };
  await writeSetting(META_KEY, {
    pixelId: next.pixelId?.trim() || current.pixelId,
    capiToken: next.capiToken?.trim() || current.capiToken,
    // Le code de test, lui, doit pouvoir se vider : c'est ainsi qu'on repasse
    // en envoi réel après une session de vérification.
    testEventCode: next.testEventCode?.trim() ?? current.testEventCode,
  } satisfies MetaSettings);
}

/* ── iClosed ────────────────────────────────────────────────────────────── */

export const ICLOSED_KEY = "iclosed";

export type IclosedSettings = {
  /** La clé d'API, préfixe `iclosed_` compris. Serveur uniquement. */
  apiKey: string;
  /** L'identifiant numérique de l'événement à réserver. */
  eventId: string;
};

const ICLOSED_EMPTY: IclosedSettings = { apiKey: "", eventId: "" };

export const getIclosedSettings = cache(async (): Promise<IclosedSettings> => {
  const fallback: IclosedSettings = { ...ICLOSED_EMPTY, ...iclosedEnvFallback() };
  try {
    const raw = await readSetting(ICLOSED_KEY);
    return {
      apiKey: str(raw.apiKey) || fallback.apiKey,
      eventId: str(raw.eventId) || fallback.eventId,
    };
  } catch (error) {
    console.error("Réglages iClosed illisibles, repli sur l'environnement", error);
    return fallback;
  }
});

/** Un champ vide conserve la valeur en place, comme pour Meta. */
export async function saveIclosedSettings(next: Partial<IclosedSettings>): Promise<void> {
  const raw = await readSetting(ICLOSED_KEY);
  await writeSetting(ICLOSED_KEY, {
    apiKey: next.apiKey?.trim() || str(raw.apiKey),
    eventId: next.eventId?.trim() || str(raw.eventId),
  } satisfies IclosedSettings);
}

/* ── La relecture IA ────────────────────────────────────────────────────── */

export const REVIEW_KEY = "review";

export type ReviewSettings = {
  /** Relire chaque réservation venue de Meta avant d'envoyer l'événement. */
  enabled: boolean;
  /** Clé d'API Anthropic. Serveur uniquement, jamais réaffichée. */
  apiKey: string;
  /**
   * Le profil recherché, dans les mots de l'équipe. C'est ce que le modèle
   * lit en premier : sans lui, la relecture n'a rien à juger et passe tout.
   */
  criteria: string;
};

const REVIEW_EMPTY: ReviewSettings = { enabled: false, apiKey: "", criteria: "" };

export const getReviewSettings = cache(async (): Promise<ReviewSettings> => {
  const fallback: ReviewSettings = { ...REVIEW_EMPTY, ...reviewEnvFallback() };
  try {
    const raw = await readSetting(REVIEW_KEY);
    return {
      enabled: raw.enabled === true,
      apiKey: str(raw.apiKey) || fallback.apiKey,
      criteria: str(raw.criteria),
    };
  } catch (error) {
    console.error("Réglages de relecture illisibles, relecture désactivée", error);
    // Sans base, aucune relecture : l'événement part comme avant.
    return { ...fallback, enabled: false };
  }
});

/** Une clé vide conserve la clé en place ; les critères, eux, s'écrivent tels quels. */
export async function saveReviewSettings(next: Partial<ReviewSettings>): Promise<void> {
  const raw = await readSetting(REVIEW_KEY);
  await writeSetting(REVIEW_KEY, {
    enabled: next.enabled ?? raw.enabled === true,
    apiKey: next.apiKey?.trim() || str(raw.apiKey),
    criteria: (next.criteria ?? str(raw.criteria)).trim(),
  } satisfies ReviewSettings);
}

/* ── Le verrou de la landing ────────────────────────────────────────────── */

export const LOCK_KEY = "lock";

export type LockSettings = {
  /** Décompte actif : le bouton de candidature reste fermé jusqu'à la fin. */
  enabled: boolean;
  /** Durée du décompte, en secondes. */
  durationSeconds: number;
};

export const LOCK_DEFAULTS: LockSettings = { enabled: true, durationSeconds: 600 };

function parseLock(raw: Record<string, unknown>): LockSettings {
  const duration = Number(raw.durationSeconds);
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : LOCK_DEFAULTS.enabled,
    // Un décompte de zéro seconde équivaudrait à désactiver le verrou par la
    // bande, sans que l'administration l'affiche comme désactivé.
    durationSeconds:
      Number.isFinite(duration) && duration >= 1
        ? Math.floor(duration)
        : LOCK_DEFAULTS.durationSeconds,
  };
}

/**
 * Lu **côté serveur** à chaque requête de la landing : lu côté navigateur, le
 * réglage ferait clignoter l'état du verrou après l'hydratation.
 */
export const getLockSettings = cache(async (): Promise<LockSettings> => {
  try {
    return parseLock(await readSetting(LOCK_KEY));
  } catch (error) {
    // La landing est la porte d'entrée du tunnel : une base indisponible ne
    // doit pas la faire tomber. On sert les valeurs par défaut.
    console.error("Réglage du verrou illisible, valeurs par défaut appliquées", error);
    return LOCK_DEFAULTS;
  }
});

export async function saveLockSettings(next: LockSettings): Promise<void> {
  await writeSetting(LOCK_KEY, parseLock(next as unknown as Record<string, unknown>));
}
