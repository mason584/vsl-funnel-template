"use client";

/**
 * L'identifiant de session du visiteur.
 *
 * C'est lui qui relie « a vu la landing » à « a pris rendez-vous », et qui
 * sert de clé d'idempotence côté serveur. Conservé dans `sessionStorage` —
 * donc stable d'une page à l'autre dans le même onglet, et remis à zéro dans
 * un nouvel onglet, ce qui est le comportement voulu : deux onglets, deux
 * parcours.
 *
 * Ce n'est pas un cookie, il n'est jamais envoyé automatiquement, et il ne
 * sort de l'onglet que dans nos propres requêtes.
 */

const KEY = "funnel_session";

let cached: string | null = null;

function generate(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSessionId(): string {
  if (cached) return cached;

  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    /* navigation privée ou stockage bloqué : la session vivra en mémoire */
  }

  cached = generate();
  try {
    window.sessionStorage.setItem(KEY, cached);
  } catch {
    /* tant pis : la session reste valable le temps de la page */
  }
  return cached;
}

/** Les paramètres d'attribution relevés à l'arrivée. */
export function readAttribution(): { landingUrl: string; utm: Record<string, string> } {
  if (typeof window === "undefined") return { landingUrl: "", utm: {} };

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith("utm_") || key === "gclid" || key === "fbclid") utm[key] = value;
  }
  return { landingUrl: window.location.href, utm };
}

/** Un cookie du navigateur, ou null. Sert à relever `_fbc` et `_fbp`. */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
