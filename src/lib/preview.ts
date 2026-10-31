/**
 * MODE APERÇU — démonstration locale uniquement.
 *
 * Permet de faire tourner l'app sur une base embarquée, sans Postgres et sans
 * mot de passe d'administration : on peut cliquer dans tout le produit avant
 * d'avoir créé le moindre compte. Comme il court-circuite l'authentification,
 * il est **désactivé en dur en production** — poser la variable sur un build
 * de production n'a aucun effet.
 */
export const IS_PREVIEW =
  process.env.NODE_ENV !== "production" && process.env.PREVIEW_MODE === "true";
