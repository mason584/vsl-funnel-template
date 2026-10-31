"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { FORM } from "@/content/form";
import { THANKS } from "@/content/thanks";
import { requireAdmin } from "@/lib/admin";
import { publicEnv } from "@/lib/env";
import { diagnose } from "@/lib/iclosed";
import { sendConversionEvent } from "@/lib/meta-capi";
import { REVIEW_MODEL, reviewApplication, sampleAnswers, sampleIdentity } from "@/lib/review";
import { getReviewSettings, saveIclosedSettings, saveLockSettings, saveMetaSettings, saveReviewSettings } from "@/lib/settings";

/**
 * Les actions de l'administration.
 *
 * Le garde est dans CHAQUE action, pas seulement dans les pages : une action
 * serveur est une route publique, et la protéger au rendu ne la protège pas à
 * l'appel.
 */

export type ActionResult = { ok: boolean; detail: string; lines?: string[] };

/**
 * Rejoue l'événement de conversion d'une réservation.
 *
 * Le même `event_id` est réutilisé — Meta dédoublonne, donc un double clic ne
 * peut pas compter deux conversions. Sert quand le token manquait ou que Meta
 * était injoignable au moment de la réservation.
 */
export async function resendMetaEvent(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, detail: "Lead introuvable." };

  const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!row) return { ok: false, detail: "Lead introuvable." };

  // Les gardes qui comptent : seule une réservation venue de Meta remonte.
  if (row.status !== "booked") {
    return { ok: false, detail: "Ce lead n'a pas réservé — aucun envoi possible." };
  }
  if (!row.metaTouch) {
    return { ok: false, detail: "Trafic hors Meta — aucun envoi possible, c'est le principe du montage." };
  }
  if (row.reviewVerdict === "unqualified") {
    return { ok: false, detail: `Candidature écartée par la relecture — aucun envoi possible. Motif : ${row.reviewReason ?? "non précisé"}` };
  }

  const result = await sendConversionEvent({
    eventId: row.sessionId,
    eventName: THANKS.metaEventName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    eventSourceUrl: row.landingUrl ?? publicEnv.NEXT_PUBLIC_SITE_URL,
    clientUserAgent: row.userAgent,
    fbc: row.fbc,
    fbp: row.fbp,
  });

  await db
    .update(leads)
    .set({
      metaEventSentAt: result.ok ? new Date() : row.metaEventSentAt,
      metaEventDetail: result.detail,
    })
    .where(eq(leads.id, id));

  revalidatePath(`/admin/leads/${id}`);
  return result;
}

/** Enregistre les réglages Meta. Un champ vide conserve la valeur en place. */
export async function updateMetaSettings(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  try {
    await saveMetaSettings({
      pixelId: String(formData.get("pixelId") ?? ""),
      capiToken: String(formData.get("capiToken") ?? ""),
      testEventCode: String(formData.get("testEventCode") ?? ""),
    });
  } catch (error) {
    console.error("Réglages Meta non enregistrés", error);
    return { ok: false, detail: "Enregistrement impossible — la base est injoignable." };
  }

  // Le pixel est lu par le layout public : sans purge, les pages déjà rendues
  // continueraient de servir l'ancien identifiant.
  revalidatePath("/", "layout");
  return { ok: true, detail: "Réglages enregistrés. Ils s'appliquent à la page suivante." };
}

/**
 * Envoie un événement de test, depuis le serveur — le seul endroit où vit le
 * token. Avec un code de l'onglet « Événements de test », il s'affiche en
 * quelques secondes sans compter nulle part. Sans code, il entre dans le vrai
 * pipeline.
 */
export async function sendTestEvent(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const code = String(formData.get("testEventCode") ?? "").trim();

  return sendConversionEvent({
    eventId: `test-admin-${Date.now()}`,
    eventName: THANKS.metaEventName,
    email: "zztest@exemple.com",
    firstName: "Test",
    lastName: "Tunnel",
    eventSourceUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
    testEventCode: code || null,
  });
}

/** Enregistre les réglages iClosed. Un champ vide conserve la valeur en place. */
export async function updateIclosedSettings(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const eventId = String(formData.get("eventId") ?? "").trim();
  if (eventId && !/^\d+$/.test(eventId)) {
    return { ok: false, detail: "L'identifiant d'événement est un nombre — celui de l'URL d'édition de l'événement dans iClosed." };
  }

  try {
    await saveIclosedSettings({ apiKey: String(formData.get("apiKey") ?? ""), eventId });
  } catch (error) {
    console.error("Réglages iClosed non enregistrés", error);
    return { ok: false, detail: "Enregistrement impossible — la base est injoignable." };
  }

  revalidatePath("/admin/reglages");
  return { ok: true, detail: "Réglages iClosed enregistrés." };
}

/**
 * Vérifie la connexion iClosed : la clé, l'événement, le mapping de chaque
 * question et les créneaux. À lancer après chaque changement de formulaire.
 */
export async function checkIclosed(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const mapped = FORM.questions
    .filter((q) => q.iclosed)
    .map((q) => ({ id: q.id, iclosed: q.iclosed as string }));
  const result = await diagnose(mapped, FORM.iclosedCatchAll);

  return {
    ok: result.ok,
    detail: result.ok ? "iClosed répond et le mapping est complet." : "Quelque chose manque — voir le détail.",
    lines: result.lines,
  };
}

/** Enregistre les réglages de la relecture. Une clé vide conserve la clé en place. */
export async function updateReviewSettings(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const enabled = formData.get("enabled") === "on";
  const criteria = String(formData.get("criteria") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (apiKey && !apiKey.startsWith("sk-ant-")) {
    return { ok: false, detail: "Une clé Anthropic commence par « sk-ant- » — console.anthropic.com → API keys." };
  }

  try {
    await saveReviewSettings({ enabled, apiKey, criteria });
  } catch (error) {
    console.error("Réglages de relecture non enregistrés", error);
    return { ok: false, detail: "Enregistrement impossible — la base est injoignable." };
  }

  revalidatePath("/admin/reglages");
  if (enabled && !criteria) {
    return { ok: true, detail: "Relecture activée, mais sans critères : elle laissera tout passer tant que le profil recherché n'est pas rédigé." };
  }
  return { ok: true, detail: enabled ? "Relecture activée. Elle s'applique à la prochaine réservation venue de Meta." : "Relecture désactivée : l'événement part dès que le trafic vient de Meta." };
}

/**
 * Relit une candidature d'exemple avec les réglages enregistrés : la clé
 * répond-elle, les critères donnent-ils un verdict lisible. Ne touche à aucun
 * lead et n'envoie rien à Meta.
 */
export async function checkReview(_prev: unknown, _formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const settings = await getReviewSettings();
  if (!settings.apiKey) return { ok: false, detail: "Aucune clé Anthropic enregistrée." };
  if (!settings.criteria) return { ok: false, detail: "Aucun critère rédigé : le modèle n'aurait rien à juger." };

  const answers = sampleAnswers(FORM);
  const outcome = await reviewApplication({
    form: FORM,
    answers,
    identity: sampleIdentity(FORM, answers),
    settings,
  });

  const fell = outcome.source === "repli";
  return {
    ok: !fell,
    detail: fell
      ? "La relecture n'a pas abouti — voir le motif."
      : `Le modèle répond. Sur la candidature d'exemple : ${outcome.qualified ? "retenue" : "écartée"}.`,
    lines: [`Modèle : ${fell ? REVIEW_MODEL : outcome.source}`, `Motif : ${outcome.reason}`],
  };
}

/** Le verrou de la landing : actif ou non, et sa durée. */
export async function updateLock(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const minutes = Number.parseInt(String(formData.get("minutes") ?? "0"), 10) || 0;
  const seconds = Number.parseInt(String(formData.get("seconds") ?? "0"), 10) || 0;
  const durationSeconds = Math.max(1, minutes * 60 + seconds);

  try {
    await saveLockSettings({ enabled: formData.get("enabled") === "on", durationSeconds });
  } catch (error) {
    console.error("Verrou non enregistré", error);
    return { ok: false, detail: "Enregistrement impossible — la base est injoignable." };
  }

  revalidatePath("/");
  return { ok: true, detail: "Verrou enregistré. Il s'applique au visiteur suivant." };
}
