"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { FORM } from "@/content/form";
import { THANKS } from "@/content/thanks";
import { asName, asText, type Answers } from "@/lib/answers";
import { publicEnv } from "@/lib/env";
import { stageRank } from "@/lib/funnel";
import {
  configuredEventId,
  createContact,
  createEventCall,
  getAvailabilities,
  getEventForm,
  IclosedError,
  IclosedNotConfigured,
  submitInviteeAnswers,
  updateContact,
  type ContactInput,
  type FieldAnswer,
} from "@/lib/iclosed";
import { buildFieldAnswers } from "@/lib/iclosed-answers";
import { sendConversionEvent } from "@/lib/meta-capi";
import { normalizePhone } from "@/lib/phone";
import { reviewApplication, type ReviewOutcome } from "@/lib/review";
import { getReviewSettings } from "@/lib/settings";
import { computeVerdict, shouldExitNow } from "@/lib/verdict";
import { W } from "@/lib/wording";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES ACTIONS DU FORMULAIRE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toutes publiques — la page l'est. Elles ne lisent donc aucune identité et
 * n'exposent rien d'autre que ce que le visiteur vient de saisir. La clé
 * iClosed et le token Meta ne quittent jamais ce périmètre.
 *
 * Règle qui gouverne tout ce fichier : **le navigateur ne décide de rien**.
 * Il envoie des réponses, le serveur recalcule le verdict, et c'est ce
 * verdict-là qui commande le créneau, la redirection et l'événement de
 * conversion.
 */

/** Les champs d'identité, extraits des réponses selon le type de question. */
function identityFrom(answers: Answers) {
  const out = {
    firstName: null as string | null,
    lastName: null as string | null,
    email: null as string | null,
    phoneNumber: null as string | null,
  };

  for (const question of FORM.questions) {
    const value = answers[question.id];
    if (value === undefined) continue;

    if (question.kind === "name") {
      const name = asName(value);
      if (name) {
        out.firstName = name.first.trim() || null;
        out.lastName = name.last.trim() || null;
      }
    }
    if (question.kind === "email") out.email = asText(value).trim() || null;
    if (question.kind === "phone") {
      // iClosed n'accepte qu'un téléphone en format international strict, Meta
      // apparie sur des chiffres, un lien WhatsApp veut la forme internationale :
      // une seule forme canonique.
      out.phoneNumber = normalizePhone(asText(value)) ?? null;
    }
  }
  return out;
}

export type ProgressInput = {
  sessionId: string;
  /** Les réponses de l'écran qui vient d'être validé. */
  answers: Answers;
  /** L'id de la question franchie, ou « slots » à l'arrivée sur les créneaux. */
  stepReached: string;
  landingUrl?: string;
  utm?: Record<string, string>;
  fbc?: string | null;
  fbp?: string | null;
  /** Motif Meta relevé dans le navigateur (`lib/meta-touch.ts`), ou null. */
  metaTouch?: string | null;
};

export type ProgressResult = {
  ok: boolean;
  /** Vrai quand la réponse élimine : le formulaire envoie sur la page de sortie. */
  exit?: boolean;
};

/**
 * Enregistre l'avancement, à chaque écran franchi — puis pousse le lead vers
 * iClosed dès qu'il a laissé un email ou un numéro.
 *
 * C'est cette table qui dit où les gens décrochent, et c'est elle qui garde
 * un lead disqualifié : un « 0 – 10 K€ » ne prend pas rendez-vous, mais son
 * contact reste de la donnée de ciblage.
 */
export async function saveProgress(input: ProgressInput): Promise<ProgressResult> {
  try {
    const [existing] = await db
      .select({
        id: leads.id,
        answers: leads.answers,
        stepReached: leads.stepReached,
        status: leads.status,
        metaTouch: leads.metaTouch,
      })
      .from(leads)
      .where(eq(leads.sessionId, input.sessionId))
      .limit(1);

    // Une session qui a déjà réservé ne se réécrit plus : un retour arrière
    // dans un onglet resté ouvert ne doit pas rétrograder le statut.
    if (existing?.status === "booked") return { ok: true };

    // Les réponses arrivent écran par écran : on fusionne au lieu d'écraser,
    // sinon un retour en arrière effacerait ce qui précède.
    const answers: Answers = {
      ...((existing?.answers as Answers) ?? {}),
      ...input.answers,
    };

    const previous = existing?.stepReached ?? "";
    const best =
      stageRank(previous) > stageRank(input.stepReached) ? previous : input.stepReached;

    // Sortie anticipée : la réponse élimine. On clôt tout de suite plutôt que
    // de faire écrire un paragraphe à quelqu'un à qui on ne proposera pas de
    // créneau.
    const exit = shouldExitNow(FORM, input.stepReached, answers);
    const verdict = computeVerdict(FORM, answers);
    const identity = identityFrom(answers);

    const values = {
      sessionId: input.sessionId,
      ...identity,
      answers,
      stepReached: best,
      status: exit ? "disqualified" : (existing?.status ?? "partial"),
      disqualifiedBy: exit ? verdict.disqualifiedBy : [],
      landingUrl: input.landingUrl ?? null,
      utm: input.utm ?? {},
      fbc: input.fbc ?? null,
      fbp: input.fbp ?? null,
      // Une touche Meta ne se perd pas en route : les signaux s'accumulent
      // dans le navigateur, ils ne disparaissent pas d'une étape à l'autre.
      metaTouch: input.metaTouch ?? existing?.metaTouch ?? null,
      userAgent: (await headers()).get("user-agent")?.slice(0, 400) ?? null,
      updatedAt: new Date(),
      ...(exit ? { completedAt: new Date() } : {}),
    };

    if (existing) {
      await db.update(leads).set(values).where(eq(leads.id, existing.id));
    } else {
      await db.insert(leads).values(values);
    }

    // iClosed suit chaque étape, pas seulement la réservation : un lead qui
    // décroche après ses coordonnées y figure avec tout ce qu'il a déjà
    // répondu. Après la réponse, pour ne pas faire attendre l'écran suivant.
    if (identity.email || identity.phoneNumber) {
      after(() => pushLead(input.sessionId, answers, values));
    }

    return { ok: true, exit };
  } catch (error) {
    // Le parcours du visiteur ne doit jamais s'arrêter parce que notre
    // journal est en panne.
    console.error("Avancement non enregistré", error);
    return { ok: false };
  }
}

/* ── Synchro iClosed ──────────────────────────────────────────────────────── */

type LeadValues = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  landingUrl?: string | null;
  utm?: Record<string, string>;
};

type PushResult = {
  contactId: string | null;
  /** iClosed refuse l'adresse : le contact existe peut-être, mais sans email. */
  badEmail: boolean;
  /** Les réponses telles qu'envoyées, pour les attacher aussi au rendez-vous. */
  answers: FieldAnswer[];
};

/** iClosed valide l'email plus durement que nous (« email: Invalid email address »). */
function isBadEmail(error: unknown): boolean {
  return (
    error instanceof IclosedError && error.status === 400 && error.message.includes("Invalid email")
  );
}

async function noteIclosedError(sessionId: string, message: string | null) {
  try {
    await db
      .update(leads)
      .set({ iclosedError: message ? message.slice(0, 500) : null })
      .where(eq(leads.sessionId, sessionId));
  } catch {
    /* la trace est un confort, pas une nécessité */
  }
}

/**
 * Pousse l'état du lead vers iClosed : le contact d'abord (création, puis
 * mise à jour), ses réponses ensuite. Appelée à chaque étape une fois les
 * coordonnées connues, et une dernière fois juste avant la réservation.
 *
 * Ne lève jamais : le parcours ne s'arrête pas parce qu'iClosed tousse, et
 * une étape ratée est rattrapée par la suivante, qui renvoie tout. L'erreur
 * est notée sur le lead pour se lire dans l'administration.
 */
async function pushLead(sessionId: string, answers: Answers, lead: LeadValues): Promise<PushResult> {
  const result: PushResult = { contactId: null, badEmail: false, answers: [] };
  if (!lead.email && !lead.phoneNumber) return result;

  try {
    const [row] = await db
      .select({ contactId: leads.iclosedContactId })
      .from(leads)
      .where(eq(leads.sessionId, sessionId))
      .limit(1);
    const known = row?.contactId ?? null;
    result.contactId = known;

    const contact: ContactInput = {
      firstName: lead.firstName ?? undefined,
      lastName: lead.lastName ?? undefined,
      email: lead.email ?? undefined,
      phoneNumber: lead.phoneNumber ?? undefined,
      utm: lead.utm,
      referrerUrl: lead.landingUrl ?? undefined,
    };
    const write = async (payload: ContactInput) => {
      if (!known) return createContact(payload);
      await updateContact(known, payload);
      return known;
    };

    let contactId: string | null;
    try {
      contactId = await write(contact);
    } catch (error) {
      // Un email refusé ne doit pas coûter le lead : on a son numéro, il part
      // sans l'adresse. La réservation, elle, redemandera un email valide.
      if (!isBadEmail(error) || !lead.phoneNumber) throw error;
      result.badEmail = true;
      contactId = await write({ ...contact, email: undefined });
    }

    if (contactId && contactId !== known) {
      await db
        .update(leads)
        .set({ iclosedContactId: contactId, updatedAt: new Date() })
        .where(eq(leads.sessionId, sessionId));
    }
    result.contactId = contactId ?? known;
    await noteIclosedError(sessionId, result.badEmail ? "Email refusé par iClosed — contact créé sans adresse." : null);
  } catch (error) {
    if (isBadEmail(error)) result.badEmail = true;
    if (error instanceof IclosedNotConfigured) {
      console.error("Clé iClosed absente — contact non synchronisé");
      await noteIclosedError(sessionId, "Clé iClosed absente : contact non synchronisé.");
    } else {
      console.error("Contact iClosed non synchronisé", error);
      await noteIclosedError(sessionId, `Contact non synchronisé : ${String(error).slice(0, 300)}`);
    }
  }

  if (!result.contactId) return result;

  try {
    const eventId = await configuredEventId();
    if (!eventId) throw new Error("aucun identifiant d'événement iClosed renseigné");
    const form = await getEventForm(eventId);
    if (!form) throw new Error(`linkPrefix introuvable pour l'événement ${eventId}`);

    result.answers = buildFieldAnswers(FORM, form.fields, answers);
    if (result.answers.length > 0) {
      await submitInviteeAnswers({
        contactId: result.contactId,
        linkPrefix: form.linkPrefix,
        identity: {
          email: result.badEmail ? undefined : (lead.email ?? undefined),
          phoneNumber: lead.phoneNumber ?? undefined,
          firstName: lead.firstName ?? undefined,
          lastName: lead.lastName ?? undefined,
        },
        answers: result.answers,
      });
    }
  } catch (error) {
    console.error("Réponses de qualification non transmises à iClosed", error);
    await noteIclosedError(sessionId, `Réponses non transmises : ${String(error).slice(0, 300)}`);
  }

  return result;
}

/* ── Créneaux ─────────────────────────────────────────────────────────────── */

export type SlotsResult =
  | { state: "ok"; days: { date: string; times: string[] }[] }
  | { state: "empty" }
  | { state: "error" };

/**
 * Créneaux disponibles, pour une session qualifiée.
 *
 * On propose les prochains **jours pourvus**, pas les prochains jours du
 * calendrier : les jours sans disponibilité sont sautés. Les trois états sont
 * distincts à dessein : un chargement infini sur des créneaux vides est le
 * bug le plus coûteux de ce montage, parce que la page a l'air de fonctionner.
 */
export async function loadSlots(sessionId: string): Promise<SlotsResult> {
  try {
    // Le créneau ne se montre qu'à une session qualifiée : forger l'URL du
    // formulaire sans répondre ne mène nulle part.
    const [row] = await db
      .select({ answers: leads.answers, status: leads.status })
      .from(leads)
      .where(eq(leads.sessionId, sessionId))
      .limit(1);
    if (!row || row.status === "disqualified") return { state: "error" };
    if (computeVerdict(FORM, row.answers as Answers).status !== "qualified") return { state: "error" };

    const eventId = await configuredEventId();
    if (!eventId) return { state: "error" };
    const form = await getEventForm(eventId);
    if (!form) return { state: "error" };

    const availabilities = await getAvailabilities(form.linkPrefix, FORM.slots.timeZone);
    const days = Object.entries(availabilities)
      .map(([date, times]) => ({ date, times: [...new Set(times)].sort() }))
      .filter((d) => d.times.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, FORM.slots.maxDays);

    return days.length > 0 ? { state: "ok", days } : { state: "empty" };
  } catch (error) {
    console.error("Créneaux iClosed illisibles", error);
    return { state: "error" };
  }
}

/**
 * `eventDates` renvoie des heures locales (« 08:30 »), pas des instants. On
 * reconstruit l'horodatage complet en lisant le décalage du fuseau **ce
 * jour-là** : entre septembre et novembre, Paris passe de +02:00 à +01:00, et
 * un décalage figé décalerait toutes les réservations d'une heure.
 */
function toInstant(date: string, time: string, timeZone: string): string {
  const probe = new Date(`${date}T${time}:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((part) => part.type === "timeZoneName")?.value;

  const offset = name?.replace("GMT", "") || "+00:00";
  return `${date}T${time}:00${offset}`;
}

/* ── Réservation ──────────────────────────────────────────────────────────── */

export type BookInput = {
  sessionId: string;
  /** Jour et heure locale retenus, tels que les renvoie iClosed. */
  slotDate: string;
  slotTime: string;
  fbc?: string | null;
  fbp?: string | null;
  metaTouch?: string | null;
};

export type BookResult =
  | { state: "booked" }
  | { state: "already" }
  | { state: "error"; message: string };

/**
 * Réservation : verdict relu, dernière synchro iClosed, rendez-vous, puis
 * Meta.
 *
 * L'ordre compte. Le verdict est recalculé depuis la base — pas depuis le
 * navigateur. Les réponses partent **avant** le rendez-vous : c'est ce qui
 * les fait apparaître sur la fiche du closer. Et l'événement Meta ne part que
 * si le trafic vient de Meta — et, quand la relecture est activée, que si
 * elle retient la candidature (`lib/review.ts`).
 */
export async function bookSlot(input: BookInput): Promise<BookResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.slotDate) || !/^\d{2}:\d{2}$/.test(input.slotTime)) {
    return { state: "error", message: "Créneau invalide." };
  }

  let existing;
  try {
    [existing] = await db.select().from(leads).where(eq(leads.sessionId, input.sessionId)).limit(1);
  } catch (error) {
    console.error("Lead illisible", error);
    return { state: "error", message: W.bookSaveFailed };
  }
  if (!existing) return { state: "error", message: W.bookNotFound };

  // iClosed n'a aucune idempotence : sans ce garde, un double-clic crée deux
  // rendez-vous. La déduplication est à nous.
  if (existing.iclosedBookingId) return { state: "already" };

  const answers = existing.answers as Answers;
  const verdict = computeVerdict(FORM, answers);
  if (verdict.status !== "qualified") {
    return { state: "error", message: W.bookNotQualified };
  }

  const identity = identityFrom(answers);
  if (!identity.email || !identity.phoneNumber) {
    return { state: "error", message: W.bookMissingContact };
  }

  const eventId = await configuredEventId();
  if (!eventId) {
    return { state: "error", message: W.bookNotConfigured };
  }

  // Dernière synchro : le contact à jour, puis le jeu complet des réponses.
  const pushed = await pushLead(input.sessionId, answers, {
    ...identity,
    landingUrl: existing.landingUrl,
    utm: (existing.utm ?? {}) as Record<string, string>,
  });

  // Un contact créé sans son email (adresse refusée) suffit pour être
  // rappelé, pas pour réserver : la confirmation part par email.
  const contactId = pushed.badEmail ? null : pushed.contactId;
  if (!contactId) {
    return {
      state: "error",
      message: pushed.badEmail
        ? W.bookBadEmail
        : W.bookNoContact,
    };
  }

  const slotIso = toInstant(input.slotDate, input.slotTime, FORM.slots.timeZone);
  let bookingId: string | null = null;
  try {
    bookingId = await createEventCall({
      eventId,
      contactId,
      startTime: slotIso,
      timeZone: FORM.slots.timeZone,
      answers: pushed.answers,
    });
  } catch (error) {
    console.error("Réservation iClosed refusée", error);
    await noteIclosedError(input.sessionId, `Réservation refusée : ${String(error).slice(0, 300)}`);
    return { state: "error", message: W.bookSlotTaken };
  }
  if (!bookingId) {
    return { state: "error", message: W.bookFailed };
  }

  const metaTouch = input.metaTouch ?? existing.metaTouch ?? null;

  // La relecture, seulement quand un événement pourrait partir : hors Meta,
  // il n'y a rien à conditionner, et chaque relecture a un coût et un délai.
  // Elle se fait APRÈS la réservation — le rendez-vous est pris quoi qu'elle
  // dise — et AVANT l'écriture, pour que la page de remerciement lise un
  // verdict déjà posé.
  let review: ReviewOutcome | null = null;
  if (metaTouch) {
    const settings = await getReviewSettings();
    if (settings.enabled) {
      review = await reviewApplication({ form: FORM, answers, identity, settings });
    }
  }

  await db
    .update(leads)
    .set({
      iclosedBookingId: bookingId,
      iclosedContactId: contactId,
      iclosedError: null,
      slotIso,
      status: "booked",
      stepReached: "booked",
      fbc: input.fbc ?? existing.fbc,
      fbp: input.fbp ?? existing.fbp,
      metaTouch,
      ...(review
        ? {
            reviewVerdict: review.qualified ? "qualified" : "unqualified",
            reviewReason: review.reason,
            reviewSource: review.source,
            reviewedAt: new Date(),
          }
        : {}),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.sessionId, input.sessionId));

  // L'événement de conversion, uniquement si le trafic vient de Meta : un
  // rendez-vous venu d'un email n'apprend rien à l'algorithme. Et seulement
  // si la relecture, quand elle tourne, retient la candidature.
  if (review && !review.qualified) {
    await db
      .update(leads)
      .set({ metaEventDetail: "Écartée par la relecture — aucun événement envoyé." })
      .where(eq(leads.sessionId, input.sessionId));
  } else if (metaTouch) {
    const head = await headers();
    const result = await sendConversionEvent({
      eventId: input.sessionId,
      eventName: THANKS.metaEventName,
      email: identity.email,
      phoneNumber: identity.phoneNumber,
      firstName: identity.firstName,
      lastName: identity.lastName,
      eventSourceUrl: existing.landingUrl ?? publicEnv.NEXT_PUBLIC_SITE_URL,
      clientIpAddress: head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      clientUserAgent: head.get("user-agent"),
      fbc: input.fbc ?? existing.fbc,
      fbp: input.fbp ?? existing.fbp,
    });
    try {
      await db
        .update(leads)
        .set({ metaEventSentAt: result.ok ? new Date() : null, metaEventDetail: result.detail })
        .where(eq(leads.sessionId, input.sessionId));
    } catch (error) {
      console.error("Trace Meta non enregistrée", error);
    }
  } else {
    await db
      .update(leads)
      .set({ metaEventDetail: "Trafic hors Meta — aucun événement envoyé." })
      .where(eq(leads.sessionId, input.sessionId));
  }

  return { state: "booked" };
}

/* ── Les pages de sortie ──────────────────────────────────────────────────── */

export type Outcome = {
  status: string;
  firstName: string | null;
  slotIso: string | null;
  /** Vrai si la page de remerciement a le droit de tirer l'événement au pixel. */
  fireMeta: boolean;
};

/**
 * L'état d'une session, pour la page de remerciement et la page de sortie.
 *
 * Passer le prénom ou le créneau dans l'URL serait plus simple, mais la page
 * doit de toute façon relire le lead côté serveur pour décider si l'événement
 * de conversion a le droit de partir : forcer l'URL ne déclenche rien.
 */
export async function outcomeFor(sessionId: string): Promise<Outcome | null> {
  try {
    const [row] = await db
      .select({
        status: leads.status,
        firstName: leads.firstName,
        slotIso: leads.slotIso,
        metaTouch: leads.metaTouch,
        reviewVerdict: leads.reviewVerdict,
      })
      .from(leads)
      .where(eq(leads.sessionId, sessionId))
      .limit(1);

    if (!row) return null;
    return {
      status: row.status,
      firstName: row.firstName,
      slotIso: row.slotIso,
      // Le pixel suit la même règle que la Conversions API : trafic Meta, et
      // candidature retenue par la relecture quand elle a tourné.
      fireMeta: row.status === "booked" && Boolean(row.metaTouch) && row.reviewVerdict !== "unqualified",
    };
  } catch (error) {
    console.error("Sortie illisible", error);
    return null;
  }
}
