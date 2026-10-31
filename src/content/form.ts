import { formSchema, type Form } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE FORMULAIRE — les questions, dans l'ordre, et le choix du créneau.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une question par écran. Le moteur ne connaît aucune question par son nom :
 * ajouter, retirer ou réordonner une question ici suffit — l'entonnoir de
 * l'administration, les colonnes de l'export et la synchro iClosed suivent.
 *
 * Trois conventions à respecter en éditant :
 *  · un `id` de question ne se renomme pas — c'est la clé de stockage des
 *    réponses déjà reçues ;
 *  · `disqualifies` arrête le parcours sur place, sans créneau. Le lead est
 *    enregistré quand même : à ne poser que sur un critère objectif ;
 *  · `iclosed` est l'identifiant **nu** du champ iClosed de l'événement. Les
 *    libellés se renomment côté iClosed sans que les identifiants bougent :
 *    toujours s'appuyer sur l'identifiant. Un champ qui existe dans le compte
 *    mais n'est pas **rattaché à l'événement** fait rejeter tout l'envoi ;
 *    le moteur range alors la réponse dans `iclosedCatchAll`.
 *
 * L'identité (nom, téléphone, email) part dans les champs de contact iClosed,
 * pas dans une question : pas de `iclosed` sur ces trois-là.
 */
export const FORM: Form = formSchema.parse({
  intro: {
    title: "Candidate pour un appel",
    body: "Sept questions, deux minutes. Réponds franchement : c'est ce qu'on lit avant l'appel, et se tromper mutuellement coûte du temps aux deux.",
    cta: "Commencer",
  },

  /** L'ancienne question fourre-tout d'iClosed : elle reçoit ce qui n'a pas de champ. */
  iclosedCatchAll: "business",

  questions: [
    {
      id: "identity",
      kind: "name",
      label: "On commence par toi. Ton prénom et ton nom ?",
    },
    {
      id: "revenue",
      kind: "single",
      label: "Quel est ton chiffre d'affaires mensuel actuel ?",
      help: "Le chiffre d'affaires de ton activité, pas ton objectif.",
      // Les libellés sont stockés tels quels et envoyés à iClosed tels quels :
      // les aligner sur les options du champ dans iClosed, sinon le closer lit
      // une valeur que le champ ne connaît pas.
      iclosed: "quel-est-ton-ca-mensuel-actuel",
      options: [
        { label: "0 – 10 K€ / mois", disqualifies: true },
        { label: "10 – 50 K€ / mois" },
        { label: "50 – 200 K€ / mois" },
        { label: "200 – 500 K€ / mois" },
        { label: "+ 500 K€ / mois" },
        // Un « confidentiel » n'est pas une tranche basse : c'est quelqu'un
        // qui ne veut pas donner son chiffre. Il qualifie.
        { label: "Confidentiel (+ 50 K€ seulement)" },
      ],
    },
    {
      id: "email",
      kind: "email",
      label: "Ton adresse email.",
      help: "C'est là qu'arrive le lien de l'appel.",
      placeholder: "prenom@exemple.com",
    },
    {
      id: "phone",
      kind: "phone",
      label: "Ton numéro de téléphone.",
      help: "De préférence celui sur lequel tu as WhatsApp — c'est là qu'on confirme.",
    },
    {
      id: "activity",
      kind: "short",
      label: "Qu'est-ce que tu vends, à qui, et à quel prix ?",
      placeholder: "Ex : accompagnement pour coachs sportifs, 4 500 € le programme",
      minLength: 12,
      iclosed: "quelle-est-ton-activit-actuelle",
    },
    {
      id: "acquisition",
      kind: "short",
      label: "D'où viennent tes clients aujourd'hui, et combien de nouveaux par mois ?",
      placeholder: "Ex : organique Instagram, une dizaine de nouveaux clients par mois",
      minLength: 12,
      iclosed: "comment-gnres-tu-des-clients-aujourdhui",
    },
    {
      id: "blocker",
      kind: "short",
      label: "Qu'est-ce qui t'empêche d'aller plus vite en ce moment ?",
      placeholder: "Ex : je ne peux pas remplir l'agenda de mes closers de façon régulière",
      minLength: 12,
      iclosed: "quest-ce-qui-selon-toi-te-bloque-aujourdhui",
    },
    {
      id: "goal",
      kind: "short",
      label: "Où veux-tu être dans 12 mois, en chiffres ?",
      placeholder: "Ex : 150 K€/mois avec deux closers",
      minLength: 6,
      iclosed: "cest-quoi-ton-objectif-612-mois",
    },
    {
      id: "qualification",
      kind: "long",
      label: "Qu'est-ce qui te rend légitime à vendre, et fait que ton offre est meilleure que celle de tes concurrents ?",
      placeholder: "Tes résultats, ceux de tes clients, ton parcours.",
      minLength: 40,
      iclosed: "qualification",
    },
  ],

  slots: {
    title: "Choisis ton créneau",
    hint: "Visio de 45 minutes, en français.",
    cta: "Confirmer mon créneau",
    maxDays: 4,
    timeZone: "Europe/Paris",
  },

  exit: {
    title: "Pas encore — et c'est normal",
    body: [
      "On accompagne des activités qui ont déjà dépassé les 10 K€ par mois : avant ce stade, ce n'est pas notre rôle.",
      "Tes réponses sont gardées, {prenom}. Reviens candidater quand tu auras passé ce cap.",
    ],
    // cta: { label: "Suivre sur Instagram", url: "https://instagram.com/…" },
  },
});
