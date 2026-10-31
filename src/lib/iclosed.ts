import "server-only";
import { normalizePhone } from "@/lib/phone";
import { getIclosedSettings } from "@/lib/settings";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLIENT ICLOSED — le seul endroit qui connaît la clé.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La clé donne accès à **tous** les contacts et rendez-vous du compte : elle
 * ne doit jamais traverser vers le navigateur. D'où le `server-only` en tête,
 * qui fait échouer le build si un composant client importe ce fichier.
 *
 * Tout ce que ce fichier sait de l'API a été vérifié sur un compte réel ; les
 * commentaires notent les pièges, parce que la documentation ne les dit pas.
 */

const BASE = "https://public.api.iclosed.io";

export class IclosedError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "IclosedError";
  }
}

/** Levée quand la clé n'est pas configurée — distincte d'une panne d'API. */
export class IclosedNotConfigured extends Error {
  constructor() {
    super("Clé iClosed absente");
    this.name = "IclosedNotConfigured";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = await getIclosedSettings();
  if (!apiKey) throw new IclosedNotConfigured();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      // Le préfixe `iclosed_` fait partie du token : le retirer donne un 401.
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new IclosedError(`iClosed ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  return (await res.json()) as T;
}

/** L'identifiant d'événement des réglages, en nombre, ou null. */
export async function configuredEventId(): Promise<number | null> {
  const { eventId } = await getIclosedSettings();
  const id = Number.parseInt(eventId, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */

export type ContactInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  utm?: Record<string, string>;
  referrerUrl?: string;
};

/**
 * iClosed plafonne ses champs texte à 500 caractères (« Too big: expected
 * string to have <=500 characters », en 400). Une URL d'arrivée de pub Meta —
 * utm verbeux + fbclid — dépasse facilement : envoyée telle quelle, elle fait
 * échouer la création de contact de tout le trafic payant pendant que
 * l'organique passe — le tri le plus trompeur possible. Tout est écrêté.
 */
const FIELD_MAX = 500;

function clip(value: string | undefined): string | undefined {
  return value && value.length > FIELD_MAX ? value.slice(0, FIELD_MAX) : value;
}

/** Pour une URL trop longue, la partie requête (le soupçon d'utm) saute d'abord. */
function clipUrl(url: string | undefined): string | undefined {
  if (!url || url.length <= FIELD_MAX) return url;
  return clip(url.split("?")[0]);
}

/**
 * Prénom et nom sont plafonnés bien plus bas : 25 caractères, sinon 400
 * (« lastName: Too big »), en création comme en mise à jour. Le nom entier
 * reste chez nous, dans `leads`.
 */
const NAME_MAX = 25;

function clipName(value: string | undefined): string | undefined {
  return value && value.length > NAME_MAX ? value.slice(0, NAME_MAX).trim() : value;
}

/**
 * iClosed attend l'attribution en chaîne de requête (`utm_source=…`), pas en
 * objet — et un téléphone en format international strict (« + » optionnel
 * puis chiffres seuls), sinon 400 (voir `phone.ts`).
 */
function serialize(input: ContactInput) {
  const { utm, phoneNumber, referrerUrl, firstName, lastName, ...rest } = input;
  const flat = utm && Object.keys(utm).length > 0 ? new URLSearchParams(utm).toString() : undefined;
  return {
    ...rest,
    firstName: clipName(firstName),
    lastName: clipName(lastName),
    phoneNumber: phoneNumber ? normalizePhone(phoneNumber) : undefined,
    referrerUrl: clipUrl(referrerUrl),
    utm: clip(flat),
  };
}

type ContactResponse = {
  id?: number | string;
  data?: { id?: number | string; contact?: { id?: number | string } };
};

function readId(payload: ContactResponse): string | null {
  // La forme observée est `{ data: { contact: { id } } }` ; les deux autres
  // chemins restent au cas où un endpoint répondrait plus à plat.
  const id = payload.data?.contact?.id ?? payload.data?.id ?? payload.id;
  return id === undefined || id === null ? null : String(id);
}

type ContactSearch = {
  data?: { contacts?: { id: number | string }[] };
};

/** Retrouve un contact par email ou téléphone — le premier résultat de `search`. */
export async function findContact(term: string): Promise<string | null> {
  const payload = await call<ContactSearch>(`/v1/contacts?search=${encodeURIComponent(term)}`);
  const first = payload.data?.contacts?.[0];
  return first ? String(first.id) : null;
}

/**
 * Crée le contact avant la réservation, dès qu'un email ou un téléphone est
 * valide. Quelqu'un qui abandonne à l'étape créneau reste ainsi rappelable.
 *
 * Un doublon — téléphone ou email déjà connu — fusionne le plus souvent en
 * silence dans le contact existant (201, même id), mais un 409 a aussi été
 * observé sur email connu. On garde le filet : retrouver le contact et le
 * compléter au lieu d'échouer. Attention : la fusion **écrase** nom et email
 * du contact existant avec les valeurs envoyées.
 */
export async function createContact(input: ContactInput): Promise<string | null> {
  try {
    const payload = await call<ContactResponse>("/v1/contacts", {
      method: "POST",
      body: JSON.stringify({ ...serialize(input), status: "POTENTIAL" }),
    });
    return readId(payload);
  } catch (error) {
    if (error instanceof IclosedError && error.status === 409) {
      // La recherche doit viser ce qu'iClosed a stocké : le numéro normalisé.
      const term = input.email ?? (input.phoneNumber && normalizePhone(input.phoneNumber));
      const id = term ? await findContact(term) : null;
      if (!id) throw error;
      await updateContact(id, input);
      return id;
    }
    throw error;
  }
}

export async function updateContact(id: string, input: ContactInput): Promise<void> {
  await call("/v1/contacts", {
    method: "PUT",
    // L'API exige les identifiants en nombre ; nous les stockons en texte.
    body: JSON.stringify({ id: Number(id), ...serialize(input) }),
  });
}

/* ── Événements et créneaux ───────────────────────────────────────────────── */

export type IclosedEvent = {
  id: number;
  name: string;
  linkPrefix: string | null;
  duration: number;
  durationUnit: string;
};

export async function listEvents(): Promise<IclosedEvent[]> {
  const payload = await call<{ data?: IclosedEvent[] }>("/v1/events");
  return payload.data ?? [];
}

type EventDates = {
  data?: { isPreview?: boolean; availabilities?: Record<string, string[]> };
};

/**
 * Disponibilités de l'événement.
 *
 * L'endpoint n'accepte que `linkPrefix` et `timeZone` — `eventId`, `date` et
 * `month` sont ignorés silencieusement. `/v1/events/timeSlots`, que la doc
 * mentionne, renvoie 404. La réponse est `{ "2026-09-03": ["08:30", "10:30"] }` :
 * des **heures locales** dans le fuseau demandé, pas des instants. Les jours
 * sans disponibilité sont déjà omis.
 */
export async function getAvailabilities(
  linkPrefix: string,
  timeZone: string
): Promise<Record<string, string[]>> {
  const payload = await call<EventDates>("/v1/events/eventDates", {
    method: "POST",
    body: JSON.stringify({ linkPrefix, timeZone }),
  });
  return payload.data?.availabilities ?? {};
}

/* ── Questions de l'événement ─────────────────────────────────────────────── */

export type EventForm = {
  linkPrefix: string;
  /**
   * Les identifiants **nus** des questions de qualification rattachées à
   * l'événement (« qualification », « business »…). Ce n'est pas la liste des
   * champs du compte : un champ qui existe sans être rattaché fait rejeter
   * tout l'envoi (400 « Invalid secondary question »).
   */
  fields: Set<string>;
};

type EventDetail = {
  data?: {
    linkPrefix?: string | null;
    CustomFieldEventMap?: { customField?: { identifier: string; label?: string } }[];
  };
};

export async function getEventForm(eventId: number): Promise<EventForm | null> {
  const payload = await call<EventDetail>(`/v1/events/detail?id=${eventId}`);
  const linkPrefix = payload.data?.linkPrefix;
  if (!linkPrefix) return null;

  const fields = new Set<string>();
  for (const { customField } of payload.data?.CustomFieldEventMap ?? []) {
    if (customField?.identifier) fields.add(customField.identifier);
  }
  return { linkPrefix, fields };
}

/** Une réponse de qualification : l'identifiant du champ visé, et le texte. */
export type FieldAnswer = { identifier: string; value: string };

/**
 * Les réponses passent par un autre validateur que les contacts : 2 500
 * caractères y sont acceptés, là où un champ de contact plafonne à 500.
 */
const ANSWER_MAX = 2000;

/** La forme attendue par iClosed : la valeur en tableau, même unique. */
function toSecondary(answers: FieldAnswer[]) {
  return answers.map((a) => ({
    identifier: a.identifier,
    answer: [a.value.slice(0, ANSWER_MAX)],
  }));
}

/* ── Réservation ──────────────────────────────────────────────────────────── */

export type BookingInput = {
  eventId: number;
  contactId: string;
  /** Instant ISO complet, décalage compris — converti en UTC ici. */
  startTime: string;
  timeZone: string;
  /** Réponses de qualification à attacher au rendez-vous. */
  answers?: FieldAnswer[];
};

type EventCallResponse = ContactResponse & {
  data?: ContactResponse["data"] & {
    eventCall?: { data?: { id?: number | string } };
  };
};

/**
 * Réserve le créneau. **Aucune idempotence côté API** : un double-clic crée
 * deux rendez-vous. La déduplication est à nous (index unique sur la session).
 */
export async function createEventCall(input: BookingInput): Promise<string | null> {
  const book = (answers: FieldAnswer[]) =>
    call<EventCallResponse>("/v1/eventCalls", {
      method: "POST",
      body: JSON.stringify({
        eventId: input.eventId,
        // Même exigence que sur les contacts : identifiants en nombre.
        contactId: Number(input.contactId),
        // Le champ s'appelle `dateTime` (pas `startTime`), et l'endpoint ne
        // tolère l'ISO 8601 qu'en UTC suffixé « Z » — un décalage local
        // (« +02:00 ») est rejeté en 400.
        dateTime: new Date(input.startTime).toISOString(),
        timeZone: input.timeZone,
        // Clé omise plutôt qu'envoyée vide : un tableau vide pourrait effacer
        // les réponses déjà attachées au contact.
        secondaryQuestionsAnswer: answers.length > 0 ? toSecondary(answers) : undefined,
      }),
    });

  let payload: EventCallResponse;
  try {
    payload = await book(input.answers ?? []);
  } catch (error) {
    // Une réponse refusée ne doit jamais coûter un rendez-vous. Un 400 est un
    // rejet — rien n'a été créé — donc le second essai, sans les réponses, ne
    // peut pas doubler la réservation.
    const retriable =
      error instanceof IclosedError && error.status === 400 && (input.answers?.length ?? 0) > 0;
    if (!retriable) throw error;
    console.error("Réservation iClosed refusée avec les réponses — nouvel essai sans", error);
    payload = await book([]);
  }

  // La réservation répond dans sa propre enveloppe, `data.eventCall.data.id`.
  const id = payload.data?.eventCall?.data?.id;
  return id === undefined || id === null ? readId(payload) : String(id);
}

/* ── Réponses de qualification ────────────────────────────────────────────── */

/**
 * Attache les réponses de qualification au contact, sur l'événement — sans
 * attendre un rendez-vous. C'est ce qui rend lisible dans iClosed un lead qui
 * a donné son numéro puis décroché avant le créneau.
 *
 * Trois comportements vérifiés, chacun capable de vider la fiche en silence :
 *
 *  - Les réponses vont dans **`secondaryQuestionsAnswer`**, valeur en tableau.
 *    Une clé inconnue est ignorée avec un 201 : un 201 ne prouve donc rien
 *    ici — relire le contact dans iClosed après un premier test.
 *  - Chaque envoi **remplace** tout le jeu de réponses du contact. Envoyer
 *    une seule question efface les autres : toujours renvoyer l'ensemble.
 *  - Un champ qui n'est pas rattaché à l'événement fait rejeter tout l'envoi
 *    (400 « Invalid secondary question »). D'où `getEventForm`.
 */
export async function submitInviteeAnswers(input: {
  contactId: string;
  linkPrefix: string;
  identity: { email?: string; phoneNumber?: string; firstName?: string; lastName?: string };
  /** Le jeu complet des réponses connues, pas seulement les nouvelles. */
  answers: FieldAnswer[];
}): Promise<void> {
  const { identity } = input;
  const phoneNumber = identity.phoneNumber && normalizePhone(identity.phoneNumber);

  // Au moins une entrée d'identité est exigée.
  const inviteeQuestionAnswers = [
    { type: "EMAIL", answer: identity.email },
    { type: "PHONE_NO", answer: phoneNumber },
    { type: "FIRST_NAME", answer: clipName(identity.firstName) },
    { type: "LAST_NAME", answer: clipName(identity.lastName) },
  ].filter((entry): entry is { type: string; answer: string } => Boolean(entry.answer));

  await call("/v1/fields/inviteeAnswers", {
    method: "POST",
    body: JSON.stringify({
      contactId: Number(input.contactId),
      linkPrefix: input.linkPrefix,
      inviteeQuestionAnswers,
      secondaryQuestionsAnswer: toSecondary(input.answers),
    }),
  });
}

/* ── Diagnostic ───────────────────────────────────────────────────────────── */

export type Diagnostic = {
  ok: boolean;
  /** Une ligne par vérification, lisible dans l'administration. */
  lines: string[];
};

/**
 * Vérifie la connexion depuis l'administration : la clé répond, l'événement
 * existe, et chaque question mappée a bien son champ rattaché. C'est ce qui
 * évite de découvrir un mapping cassé sur la fiche vide du premier closer.
 */
export async function diagnose(mapped: { id: string; iclosed: string }[], catchAll?: string): Promise<Diagnostic> {
  const lines: string[] = [];
  try {
    const events = await listEvents();
    lines.push(`✓ Clé acceptée — ${events.length} événement(s) sur le compte.`);

    const eventId = await configuredEventId();
    if (!eventId) {
      lines.push("✗ Aucun identifiant d'événement renseigné.");
      return { ok: false, lines };
    }
    const event = events.find((e) => e.id === eventId);
    if (!event) {
      lines.push(`✗ L'événement ${eventId} n'existe pas sur ce compte. Disponibles : ${events.map((e) => `${e.id} (${e.name})`).join(", ")}.`);
      return { ok: false, lines };
    }
    lines.push(`✓ Événement ${event.id} — « ${event.name} », ${event.duration} ${event.durationUnit.toLowerCase()}.`);
    if (!event.linkPrefix || event.linkPrefix.startsWith("null/")) {
      lines.push(`⚠ linkPrefix « ${event.linkPrefix} » : le lien public de l'événement est cassé. Sans effet sur la réservation par l'API.`);
    }

    const form = await getEventForm(eventId);
    if (!form) {
      lines.push("✗ Impossible de lire les questions de l'événement.");
      return { ok: false, lines };
    }
    lines.push(`✓ Champs rattachés à l'événement : ${[...form.fields].join(", ") || "aucun"}.`);

    let ok = true;
    for (const q of mapped) {
      if (form.fields.has(q.iclosed)) {
        lines.push(`✓ ${q.id} → ${q.iclosed}`);
      } else if (catchAll && form.fields.has(catchAll)) {
        lines.push(`⚠ ${q.id} → ${q.iclosed} n'est pas rattaché : la réponse partira regroupée dans « ${catchAll} ».`);
      } else {
        ok = false;
        lines.push(`✗ ${q.id} → ${q.iclosed} n'est pas rattaché, et aucun champ fourre-tout ne le rattrape : la réponse restera chez nous.`);
      }
    }

    const availabilities = await getAvailabilities(form.linkPrefix, "Europe/Paris");
    const days = Object.keys(availabilities).length;
    lines.push(days > 0 ? `✓ ${days} jour(s) avec des créneaux disponibles.` : "⚠ Aucun créneau disponible en ce moment.");

    return { ok, lines };
  } catch (error) {
    if (error instanceof IclosedNotConfigured) {
      lines.push("✗ Aucune clé iClosed renseignée.");
    } else {
      lines.push(`✗ ${String(error).slice(0, 300)}`);
    }
    return { ok: false, lines };
  }
}
