import { thanksSchema, type Thanks } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA PAGE DE REMERCIEMENT — après la réservation.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une vidéo principale (« prépare ton appel »), puis six vidéos courtes qui
 * répondent chacune à une objection, puis le renvoi vers l'immersion. C'est
 * ici que part l'événement de conversion Meta — et seulement si le serveur a
 * vérifié que la session a bel et bien réservé.
 *
 * Les six questions ci-dessous sont celles qu'un prospect se pose entre la
 * réservation et l'appel. Les vidéos se tournent face caméra, deux à trois
 * minutes chacune.
 */
export const THANKS: Thanks = thanksSchema.parse({
  banner: {
    title: "{prenom}, ton appel est réservé — {creneau}",
    detail:
      "45 minutes, en visio. Le lien arrive par email. D'ici là, regarde la vidéo ci-dessous : on partira de là.",
  },

  eyebrow: "Message important",
  headline: "Prépare ton appel.",
  lede: "Cette vidéo te donne le contexte utile pour notre échange.",

  // mainVideo: { provider: "youtube", id: "…" }
  mainVideo: null,
  mainVideoCaption: "VIDÉO PRINCIPALE — à poser dans src/content/thanks.ts",

  breakouts: {
    eyebrow: "Réponses aux objections",
    title: "Tu te demandes peut-être…",
    lede: "Six vidéos courtes qui répondent aux questions les plus fréquentes avant l'appel.",
    items: [
      { title: "Comment générer des prospects qualifiés sans dépenser plus en pub ?", video: null },
      { title: "Pourquoi ton business ne tourne pas sans toi ?", video: null },
      { title: "Comment scaler sans recruter des dizaines de personnes ?", video: null },
      { title: "Est-ce que ça marche pour mon secteur ?", video: null },
      { title: "Quel retour réaliste attendre dans les premiers mois ?", video: null },
      { title: "Suis-je prêt pour cet accompagnement ?", video: null },
    ],
  },

  next: {
    eyebrow: "En attendant ton appel",
    title: "Envie d'en savoir plus sur la méthode ?",
    lede: "La page d'immersion montre en détail comment fonctionne l'accompagnement.",
    cta: "Découvrir la méthode",
  },

  /**
   * `Schedule` est un événement standard Meta : il se choisit directement
   * comme objectif de campagne, sans conversion personnalisée. Pour un nom
   * personnalisé (ex. `MQL_Scheduled`), il faut créer une conversion
   * personnalisée dessus dans Events Manager, après un premier envoi réel.
   */
  metaEventName: "Schedule",
});
