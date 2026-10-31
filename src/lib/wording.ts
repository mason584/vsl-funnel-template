import { BRAND } from "@/brand/brand";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TUTOIEMENT OU VOUVOIEMENT — les phrases du moteur, dans les deux registres.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le contenu éditorial (`src/content/`) est écrit à la main dans le registre
 * de la marque. Mais le moteur a ses propres phrases — messages d'erreur,
 * aides du formulaire, politique de confidentialité — et une marque qui
 * vouvoie ne doit pas trouver un « Ton prénom, en entier. » au milieu de son
 * formulaire. `BRAND.address` tranche, ici et nulle part ailleurs.
 *
 * Sans `server-only` : le formulaire (navigateur) et les actions (serveur)
 * lisent le même fichier.
 */

export const ADDRESS: "tu" | "vous" = BRAND.address;

/** La variante du registre de la marque. */
export function t(tu: string, vous: string): string {
  return ADDRESS === "vous" ? vous : tu;
}

export const W = {
  // ── Validation des réponses ──
  firstName: t("Ton prénom, en entier.", "Votre prénom, en entier."),
  lastName: t("Ton nom, en entier.", "Votre nom, en entier."),
  emailNeeded: t("On a besoin d'une adresse email.", "Nous avons besoin d'une adresse email."),
  emailInvalid: t(
    "Adresse email invalide — vérifie le « @ » et le domaine.",
    "Adresse email invalide — vérifiez le « @ » et le domaine."
  ),
  phoneNeeded: t("On a besoin d'un numéro pour te joindre.", "Nous avons besoin d'un numéro pour vous joindre."),
  phoneRecount: t("recompte le tien", "recomptez le vôtre"),
  pickOne: t("Choisis une réponse.", "Choisissez une réponse."),
  pickAtLeastOne: t("Choisis au moins une réponse.", "Choisissez au moins une réponse."),
  pickAtLeast: (n: number) => t(`Choisis au moins ${n} réponses.`, `Choisissez au moins ${n} réponses.`),
  answerNeeded: "Cette réponse est nécessaire pour continuer.",
  tooShort: t(
    "Réponse un peu courte — développe en quelques mots, c'est ce qu'on lira en premier.",
    "Réponse un peu courte — développez en quelques mots, c'est ce que nous lirons en premier."
  ),
  looksFake: t(
    "Cette réponse ne nous dit rien. Une phrase suffit, mais une vraie.",
    "Cette réponse ne nous dit rien. Une phrase suffit, mais une vraie."
  ),

  // ── Le formulaire ──
  pressEnter: t("ou appuie sur Entrée ↵", "ou appuyez sur Entrée ↵"),
  cmdEnter: "Cmd/Ctrl + Entrée pour continuer",
  seeSlots: "Voir les créneaux",
  slotsEmpty: t(
    "Aucun créneau disponible pour le moment. Reviens un peu plus tard — tes réponses sont enregistrées.",
    "Aucun créneau disponible pour le moment. Revenez un peu plus tard — vos réponses sont enregistrées."
  ),
  slotsError: "Impossible de charger les créneaux pour le moment.",
  slotsLoading: "Chargement des créneaux…",
  booked: t(
    "Créneau confirmé — on t'emmène sur la page suivante…",
    "Créneau confirmé — nous vous emmenons sur la page suivante…"
  ),
  retry: "Réessayer",
  booking: "Réservation…",

  // ── Réservation (serveur) ──
  bookSaveFailed: t(
    "Impossible d'enregistrer ta réservation. Réessaie.",
    "Impossible d'enregistrer votre réservation. Réessayez."
  ),
  bookNotFound: t(
    "Ta candidature n'a pas été retrouvée. Recommence le formulaire.",
    "Votre candidature n'a pas été retrouvée. Recommencez le formulaire."
  ),
  bookNotQualified: t(
    "Ta candidature ne permet pas de réserver un créneau.",
    "Votre candidature ne permet pas de réserver un créneau."
  ),
  bookMissingContact: t(
    "Il manque ton email ou ton téléphone pour réserver.",
    "Il manque votre email ou votre téléphone pour réserver."
  ),
  bookNotConfigured: t(
    "La réservation n'est pas configurée. Préviens-nous par email.",
    "La réservation n'est pas configurée. Prévenez-nous par email."
  ),
  bookBadEmail: t(
    "Ton adresse email est refusée par le système de réservation — vérifie-la.",
    "Votre adresse email est refusée par le système de réservation — vérifiez-la."
  ),
  bookNoContact: t(
    "Impossible de créer ton contact. Réessaie dans un instant.",
    "Impossible de créer votre contact. Réessayez dans un instant."
  ),
  bookSlotTaken: t(
    "Ce créneau vient d'être pris. Choisis-en un autre.",
    "Ce créneau vient d'être pris. Choisissez-en un autre."
  ),
  bookFailed: t("Réservation impossible pour le moment. Réessaie.", "Réservation impossible pour le moment. Réessayez."),

  // ── Pages ──
  thanksTitle: t("Ton appel est réservé", "Votre appel est réservé"),
  backToVideo: "Revenir à la vidéo",
} as const;
