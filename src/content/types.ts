import { z } from "zod";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA FORME DU CONTENU — le contrat entre les fichiers de `src/content/` et
 * le moteur.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tout le texte, toutes les vidéos et toutes les questions du tunnel vivent
 * dans `src/content/`. Le moteur (pages, formulaire, administration, export,
 * synchro iClosed) ne connaît aucune question par son nom : il déroule ce que
 * le contenu déclare.
 *
 * Les schémas zod ci-dessous sont vérifiés **au chargement du module** : une
 * faute de frappe dans un fichier de contenu casse le build, pas la
 * production.
 */

/* ── Vidéos ─────────────────────────────────────────────────────────────── */

export const videoSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("vidalytics"),
    embedId: z.string().min(1),
    /** Base de l'embed, barre oblique finale comprise. */
    baseUrl: z.string().url(),
  }),
  z.object({ provider: z.literal("youtube"), id: z.string().min(1) }),
  z.object({ provider: z.literal("vimeo"), id: z.string().min(1) }),
  /** Wistia : l'identifiant du média (« abc123defg »), lu dans l'embed. */
  z.object({ provider: z.literal("wistia"), id: z.string().min(1) }),
  z.object({ provider: z.literal("file"), src: z.string().min(1), poster: z.string().optional() }),
]);
export type Video = z.infer<typeof videoSchema>;

/* ── Questions ──────────────────────────────────────────────────────────── */

/**
 * `name` et `phone` rendent deux champs sur un même écran ; les autres, un.
 * Le type décide du rendu, du clavier et de la validation — le contenu n'a
 * jamais à décrire une interface.
 */
export const questionKindSchema = z.enum([
  "name", // prénom + nom
  "phone", // indicatif + numéro
  "email",
  "single", // un choix, avance toute seule
  "multi", // plusieurs choix, bouton de validation
  "short", // une ligne
  "long", // paragraphe
]);
export type QuestionKind = z.infer<typeof questionKindSchema>;

export const optionSchema = z.object({
  /** Ce que lit le visiteur, et ce qui est stocké tel quel. */
  label: z.string().min(1),
  /**
   * Cette réponse élimine : le parcours s'arrête là, sur la page de sortie,
   * sans proposer de créneau. Le lead est enregistré quand même — c'est de la
   * donnée de ciblage, pas du déchet.
   */
  disqualifies: z.boolean().optional(),
  /** Champ de précision qui s'ouvre sous l'option choisie — « Laquelle ? ». */
  followUp: z
    .object({
      label: z.string().min(1),
      placeholder: z.string().optional(),
      multiline: z.boolean().optional(),
    })
    .optional(),
});
export type Option = z.infer<typeof optionSchema>;

export const questionSchema = z
  .object({
    /** Clé de stockage de la réponse. Stable : la renommer perd l'historique. */
    id: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, "id de question : minuscules, chiffres et _"),
    kind: questionKindSchema,
    /** La question posée, telle quelle. */
    label: z.string().min(1),
    /** Précision sous le libellé — l'exemple, l'unité, le cadrage. */
    help: z.string().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().default(true),

    /** `single` et `multi` uniquement. */
    options: z.array(optionSchema).optional(),
    /** `multi` : bornes du nombre de cases cochées. */
    min: z.number().int().positive().optional(),
    max: z.number().int().positive().optional(),

    /** `short` et `long` : longueur minimale acceptée. */
    minLength: z.number().int().nonnegative().optional(),

    /**
     * L'identifiant **nu** du champ iClosed qui reçoit la réponse
     * (« qualification », pas « call.qualification »). Se lit dans
     * `GET /v1/fields/objects?objectType=CALL` ou dans l'administration
     * (Réglages → iClosed → Vérifier). Sans lui, la réponse reste chez nous
     * et part regroupée dans le champ fourre-tout, s'il est déclaré.
     */
    iclosed: z.string().min(1).optional(),
  })
  .refine(
    (q) => !["single", "multi"].includes(q.kind) || (q.options?.length ?? 0) >= 2,
    { message: "une question à choix demande au moins deux options" }
  )
  .refine((q) => !["short", "long"].includes(q.kind) || q.minLength !== undefined, {
    message: "une question ouverte doit fixer minLength",
  });
export type Question = z.infer<typeof questionSchema>;

/* ── Le formulaire ──────────────────────────────────────────────────────── */

export const formSchema = z
  .object({
    /** Écran d'accueil du formulaire, avant la première question. */
    intro: z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      cta: z.string().min(1),
    }),
    questions: z.array(questionSchema).min(1),
    /**
     * Le champ iClosed qui reçoit, regroupées question et réponse, les
     * réponses dont le champ n'est pas rattaché à l'événement. iClosed refuse
     * tout envoi qui contient un champ non rattaché : sans ce repli, une
     * seule question mal mappée ferait perdre toutes les autres.
     */
    iclosedCatchAll: z.string().min(1).optional(),
    /** L'écran de choix du créneau. */
    slots: z.object({
      title: z.string().min(1),
      hint: z.string().min(1),
      cta: z.string().min(1),
      /** Nombre de jours proposés — au-delà de quatre, le choix dilue l'urgence. */
      maxDays: z.number().int().min(1).max(14).default(4),
      /** Fuseau des créneaux affichés. */
      timeZone: z.string().min(1).default("Europe/Paris"),
    }),
    /** La page de sortie des profils éliminés. */
    exit: z.object({
      title: z.string().min(1),
      /** Paragraphes. `{prenom}` y est remplacé par le prénom. */
      body: z.array(z.string().min(1)).min(1),
      cta: z.object({ label: z.string().min(1), url: z.string().min(1) }).optional(),
    }),
  })
  .refine((f) => f.questions.some((q) => q.kind === "email") && f.questions.some((q) => q.kind === "phone"), {
    message: "le formulaire doit demander un email et un téléphone : iClosed les exige pour réserver",
  })
  .refine((f) => new Set(f.questions.map((q) => q.id)).size === f.questions.length, {
    message: "deux questions portent le même id",
  });
export type Form = z.infer<typeof formSchema>;

/* ── La landing ─────────────────────────────────────────────────────────── */

/**
 * Un témoignage client : qui, quoi, le résultat, la vidéo.
 *
 * La carte montre la vignette (`poster`, la tête du client) avec l'accroche
 * en surimpression ; `**…**` dans `headline` met le chiffre en gras. Cliquer
 * ouvre la vidéo en calque. Sans `poster`, la carte prend un fond sombre.
 */
export const testimonialSchema = z.object({
  name: z.string().min(1),
  /** Le métier et le lieu — « Climatisation (Salon-de-Provence) ». */
  business: z.string().min(1),
  /** L'accroche en surimpression, le résultat en gras entre `**`. */
  headline: z.string().min(1),
  /** Vignette 4:3, chemin sous `public/` ou URL. */
  poster: z.string().optional(),
  video: videoSchema.nullable(),
});
export type Testimonial = z.infer<typeof testimonialSchema>;

/** Une section de témoignages — la landing et l'immersion la partagent. */
export const testimonialsSectionSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  items: z.array(testimonialSchema).min(1),
});

export const landingSchema = z.object({
  /**
   * Où vit le formulaire. `inline` : sous la vidéo, derrière le décompte,
   * sans bouton — le montage du tunnel Savoire. `page` : un bouton ouvre
   * `/candidature`, et la visite du formulaire devient un étage de l'entonnoir.
   */
  form: z.enum(["inline", "page"]).default("page"),
  /** Sur-titre en mono au-dessus du titre. */
  eyebrow: z.string().optional(),
  /** Le titre ; `figure` est mis en valeur à sa suite (un chiffre, une promesse). */
  headline: z.string().min(1),
  figure: z.string().optional(),
  /** Une phrase sous le titre — la garantie, la condition, le cadre. */
  lede: z.string().optional(),
  /** Le bloc de réserve légale sous le titre — les résultats ne sont pas typiques. */
  disclaimer: z.string().optional(),
  video: videoSchema.nullable(),
  /** Libellé affiché sur la vignette quand aucune vidéo n'est posée. */
  videoCaption: z.string().min(1),
  /** Le bouton qui ouvre le formulaire, et sa réassurance. */
  cta: z.string().min(1),
  ctaNote: z.string().optional(),
  /** Le texte du verrou, tant que le décompte tourne. */
  lock: z.object({
    title: z.string().min(1),
    hint: z.string().min(1),
  }),
  /** Preuve sociale sous la vidéo : une ligne d'étoiles et sa mention. */
  proof: z.string().optional(),
  /** Les témoignages, sous le bouton. Sans eux, la section disparaît. */
  testimonials: testimonialsSectionSchema
    .extend({
      /** Un second bouton de candidature après les témoignages. */
      closingTitle: z.string().optional(),
    })
    .optional(),
  /** Métadonnées de partage. */
  meta: z.object({ title: z.string().min(1), description: z.string().min(1) }),
});
export type Landing = z.infer<typeof landingSchema>;

/* ── La page de remerciement ────────────────────────────────────────────── */

export const breakoutSchema = z.object({
  /** La question à laquelle la vidéo répond. */
  title: z.string().min(1),
  video: videoSchema.nullable(),
  /** Vignette (chemin sous `public/` ou URL). Sans elle, une vignette neutre. */
  poster: z.string().optional(),
});
export type Breakout = z.infer<typeof breakoutSchema>;

export const thanksSchema = z.object({
  /** Bandeau de confirmation. `{prenom}` et `{creneau}` y sont remplacés. */
  banner: z.object({ title: z.string().min(1), detail: z.string().min(1) }),
  eyebrow: z.string().optional(),
  headline: z.string().min(1),
  lede: z.string().optional(),
  mainVideo: videoSchema.nullable(),
  mainVideoCaption: z.string().min(1),
  /** La section des six vidéos courtes. */
  breakouts: z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    lede: z.string().optional(),
    items: z.array(breakoutSchema).length(6, "la page de remerciement attend six vidéos courtes"),
  }),
  /** Le renvoi vers l'immersion. */
  next: z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    lede: z.string().optional(),
    cta: z.string().min(1),
  }),
  /**
   * Nom de l'événement de conversion Meta. `Schedule` est un événement
   * standard, directement sélectionnable comme objectif de campagne ; un nom
   * personnalisé (50 caractères max) exige une conversion personnalisée.
   */
  metaEventName: z.string().min(1).max(50).default("Schedule"),
});
export type Thanks = z.infer<typeof thanksSchema>;

/* ── La page d'immersion ────────────────────────────────────────────────── */

export const immersionVideoSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  /** Masquée tant qu'elle n'est pas renseignée. */
  duration: z.string().nullable(),
  note: z.string().min(1),
  video: videoSchema.nullable(),
  videoCaption: z.string().min(1),
  /** « Au programme » : les points abordés. `locked` = réservé aux membres. */
  programme: z.array(z.object({ text: z.string().min(1), locked: z.boolean().optional() })).default([]),
});
export type ImmersionVideo = z.infer<typeof immersionVideoSchema>;

export const immersionSchema = z.object({
  access: z.string().min(1),
  headline: z.string().min(1),
  lede: z.string().min(1),
  lockLabel: z.string().min(1),
  videos: z.array(immersionVideoSchema).length(2, "la page d'immersion attend deux vidéos"),
  /** Les témoignages clients sous les vidéos — les mêmes cartes que la landing. */
  testimonials: testimonialsSectionSchema.optional(),
  /**
   * Le mur d'avis : des captures (avis Google, messages) en grille, chemins
   * sous `public/` ou URL. C'est la preuve en volume, après la preuve en
   * détail des témoignages vidéo.
   */
  reviews: z
    .object({
      eyebrow: z.string().optional(),
      title: z.string().min(1),
      images: z.array(z.string().min(1)).min(1),
    })
    .optional(),
  meta: z.object({ title: z.string().min(1), description: z.string().min(1) }),
});
export type Immersion = z.infer<typeof immersionSchema>;
