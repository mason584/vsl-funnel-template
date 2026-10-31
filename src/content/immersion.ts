import { immersionSchema, type Immersion } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA PAGE D'IMMERSION — les deux vidéos à regarder avant l'appel.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Publique, hors index : le lien circule par email et depuis la page de
 * remerciement. Aucun événement de conversion n'y part — il est déjà parti
 * sur `/merci`. Une seule mise en page, deux objets vidéo : changer de marché
 * ou de promesse, c'est changer ce fichier.
 */
export const IMMERSION: Immersion = immersionSchema.parse({
  access: "ACCÈS PRIVÉ",

  headline: "Un avant-goût de ce qui se passe dans l'accompagnement",
  lede: "Deux vidéos : qui on est et comment on travaille, puis un extrait d'une session pour voir la méthode en action.",

  lockLabel: "Réservé aux membres",

  videos: [
    {
      eyebrow: "Présentation",
      title: "Qui on est, ce qu'on fait, et comment l'accompagnement fonctionne",
      duration: null,
      note: "Une conversation sans script. Notre parcours, ce qu'on met en place chez nos clients, et comment l'accompagnement est structuré.",
      video: null,
      videoCaption: "PRÉSENTATION — à poser dans src/content/immersion.ts",
      programme: [
        { text: "Qui est derrière l'accompagnement" },
        { text: "Les deux profils du marché : l'organique qui manque de volume, l'ads qui manque de rentabilité" },
        { text: "Ce qui sépare un bon vendeur d'un collecteur de paiements" },
        { text: "Comment se déroulent les douze premières semaines" },
      ],
    },
    {
      eyebrow: "Session · extrait",
      title: "La méthode en action, sur un cas réel",
      duration: null,
      note: "Extrait d'une session. Écran partagé, la méthode montrée en direct, étape par étape.",
      video: null,
      videoCaption: "SESSION — EXTRAIT",
      programme: [
        { text: "Le point de départ du client et son objectif" },
        { text: "La première décision qu'on prend ensemble" },
        { text: "Ce qu'on mesure chaque semaine" },
        { text: "Les documents et modèles complets", locked: true },
        { text: "Le Q&A de fin de session", locked: true },
      ],
    },
  ],

  meta: {
    title: "Immersion — les deux vidéos à regarder avant l'appel",
    description: "Qui on est, comment on travaille, et la méthode en action.",
  },
});
