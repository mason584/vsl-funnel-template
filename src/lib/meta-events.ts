/**
 * Les noms d'événements standard de Meta.
 *
 * Partagé entre le pixel (navigateur) et la Conversions API (serveur) : un
 * événement standard part en `fbq('track', …)`, un nom personnalisé en
 * `fbq('trackCustom', …)`. Sans `server-only`, puisqu'il sert des deux côtés.
 */
export const STANDARD_EVENTS = new Set([
  "Schedule",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "SubmitApplication",
  "ViewContent",
  "Purchase",
]);
