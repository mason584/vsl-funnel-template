import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE SCHÉMA — trois tables, rien de plus.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les questions du formulaire ne sont PAS des colonnes : elles vivent dans
 * `src/content/form.ts`, et les réponses sont un objet JSON indexé par id de
 * question. Ajouter une question n'est donc jamais une migration.
 */

/**
 * Une visite d'une page publique.
 *
 * Comptée chez nous plutôt que déléguée à un outil tiers : le tableau de bord
 * doit pouvoir afficher « 420 visites, 38 formulaires, 9 rendez-vous » sans
 * dépendre d'un compte externe, et sans poser un traceur de plus. Aucun
 * cookie : un chargement de page compte pour une visite.
 */
export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Session du navigateur — relie la visite au lead qui suivra. */
    sessionId: text("session_id").notNull(),
    /** Chemin visité, sans la query : `/`, `/candidature`, `/merci`, `/immersion`. */
    path: text("path").notNull(),

    referrer: text("referrer"),
    landingUrl: text("landing_url"),
    /** utm_*, fbclid, gclid relevés à l'arrivée. */
    utm: jsonb("utm").notNull().default({}),
    country: text("country"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("visits_created_idx").on(t.createdAt),
    index("visits_path_idx").on(t.path, t.createdAt),
    index("visits_session_idx").on(t.sessionId),
  ]
);

export type VisitRow = typeof visits.$inferSelect;

/**
 * Un lead — une personne qui a démarré le formulaire.
 *
 * La ligne est créée dès le premier écran validé, bien avant la réservation :
 * c'est ce qui rend l'entonnoir mesurable et garde un lead rappelable même
 * s'il abandonne au milieu. iClosed n'est jamais la source de vérité des
 * opt-ins — c'est cette table ; iClosed ne reçoit que ce que la synchro a
 * réussi à pousser.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Session du navigateur. Sert de clé d'idempotence : l'API iClosed n'a
     * aucune idempotence, c'est cet index unique qui empêche un double-clic
     * de créer deux rendez-vous — et deux événements Meta.
     */
    sessionId: text("session_id").notNull(),

    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    /** Format international strict, normalisé avant écriture. */
    phoneNumber: text("phone_number"),

    /** Toutes les réponses, indexées par id de question. */
    answers: jsonb("answers").notNull().default({}),

    /** Dernier écran atteint — l'id d'une question, « slots » ou « booked ». */
    stepReached: text("step_reached"),
    /** `partial` · `qualified` · `disqualified` · `booked`. */
    status: text("status").notNull().default("partial"),
    /** Les ids des questions dont la réponse a éliminé. */
    disqualifiedBy: jsonb("disqualified_by").notNull().default([]),

    /** Identifiants iClosed, une fois le contact créé puis le rendez-vous pris. */
    iclosedContactId: text("iclosed_contact_id"),
    iclosedBookingId: text("iclosed_booking_id"),
    /** Dernière erreur iClosed, pour la lire dans l'administration. */
    iclosedError: text("iclosed_error"),
    /** Le créneau réservé, instant ISO. */
    slotIso: text("slot_iso"),

    /** Renseigné une fois l'événement de conversion accepté par Meta. */
    metaEventSentAt: timestamp("meta_event_sent_at", { withTimezone: true }),
    /** Trace Meta, ou motif d'échec — pour l'afficher dans l'administration. */
    metaEventDetail: text("meta_event_detail"),
    /**
     * Motif Meta de la session (« fbclid », « cookie _fbc »…), voir
     * `lib/meta-touch.ts`. Null = trafic hors Meta : aucun événement ne part.
     */
    metaTouch: text("meta_touch"),

    /**
     * La relecture (`lib/review.ts`), faite après la réservation quand elle
     * est activée et que le trafic vient de Meta. `qualified` : l'événement
     * est parti ; `unqualified` : il a été retenu. Null = pas relu.
     */
    reviewVerdict: text("review_verdict"),
    /** Le motif, une phrase lisible par l'équipe. */
    reviewReason: text("review_reason"),
    /** Le modèle qui a tranché, ou `garde` / `repli`. */
    reviewSource: text("review_source"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    landingUrl: text("landing_url"),
    utm: jsonb("utm").notNull().default({}),
    /** Cookies Meta relevés par le navigateur, pour l'appariement de la CAPI. */
    fbc: text("fbc"),
    fbp: text("fbp"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Le moment du rendez-vous pris, ou de la sortie éliminatoire. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("leads_session_idx").on(t.sessionId),
    index("leads_created_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
  ]
);

export type LeadRow = typeof leads.$inferSelect;

/**
 * Réglages modifiables sans redéploiement.
 *
 * Clé/valeur plutôt que des colonnes : Vercel fige les variables
 * d'environnement au moment du build, et « je colle mon pixel et il s'affiche
 * partout » exige une lecture en base.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SettingRow = typeof settings.$inferSelect;
