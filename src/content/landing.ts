import { landingSchema, type Landing } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA LANDING — la page que l'ad pointe.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une VSL, un titre, une réserve légale, et un bouton qui ne s'ouvre qu'au
 * bout du décompte (réglé dans l'administration, sans redéploiement). Tout le
 * texte vit ici ; la mise en page est dans `src/app/(public)/page.tsx`.
 *
 * Le contenu de démonstration est volontairement générique : c'est le
 * squelette qu'on remplit en cours, pas une copy à réutiliser.
 */
export const LANDING: Landing = landingSchema.parse({
  eyebrow: "Vidéo gratuite",

  headline: "Le système exact qu'on utilise pour faire passer un business d'expertise à",
  figure: "100 K€ par mois",

  disclaimer:
    "Les résultats évoqués sur cette page ne constituent ni une promesse ni un résultat type. Ils dépendent de ton marché, de ton offre, de ton exécution et de facteurs indépendants de nous. Si tu corresponds aux critères, on peut probablement t'aider à avancer plus vite et à éviter des erreurs coûteuses.",

  // Pour brancher la VSL :
  // video: {
  //   provider: "vidalytics",
  //   embedId: "XXXXXXXXXXXX",
  //   baseUrl: "https://fast.vidalytics.com/embeds/VOTRE_COMPTE/XXXXXXXXXXXX/",
  // },
  // ou : { provider: "youtube", id: "dQw4w9WgXcQ" }
  // ou : { provider: "vimeo", id: "123456789" }
  // ou : { provider: "file", src: "/videos/vsl.mp4", poster: "/videos/vsl.jpg" }
  video: null,
  videoCaption: "VSL — à poser dans src/content/landing.ts",

  cta: "Candidater pour un appel",
  ctaNote: "7 questions, deux minutes. Si ta situation entre dans ce qu'on sait faire, tu choisis ton créneau dans la foulée.",

  lock: {
    title: "La suite s'ouvre dans",
    hint: "Regarde la vidéo — le bouton de candidature apparaît ici tout seul.",
  },

  meta: {
    title: "Vidéo gratuite — le système pour passer à 100 K€ par mois",
    description: "Regarde la vidéo, puis candidate pour un appel si ta situation correspond.",
  },
});
