/**
 * Touche Meta — la preuve que le visiteur vient de Meta.
 *
 * L'événement de conversion ne part vers Meta que s'il y a eu un clic Meta,
 * premier ou dernier. Un rendez-vous pris par quelqu'un venu de YouTube, d'un
 * email ou en direct n'apprend rien à l'algorithme — et Meta se l'attribuerait
 * au passage sur une simple impression. La règle est la même au pixel
 * (`/merci`) et à la Conversions API (réservation).
 *
 * - **Dernier clic** — la visite courante : `fbclid` dans l'URL (Meta l'ajoute
 *   à tout lien sortant, pub ou organique), `utm_source` Meta, ou un referrer
 *   facebook.com / instagram.com.
 * - **Premier clic** — une visite antérieure : le cookie `_fbc`, que le pixel
 *   pose 90 jours sur une arrivée avec `fbclid`, ou notre propre marqueur,
 *   écrit à chaque arrivée Meta. Il tient quand le pixel est bloqué ou en
 *   retard, et sur une arrivée taguée par UTM seul.
 *
 * Le résultat est un motif court, lisible dans l'administration (« fbclid »,
 * « cookie _fbc », « fbclid (visite précédente) »), ou `null`.
 *
 * Sans `server-only` ni `"use client"` : les deux fonctions pures servent
 * partout, `metaTouch()` ne s'appelle que dans le navigateur.
 */

const META_SOURCE = /facebook|instagram|meta|^fb$|^ig$/i;
const META_HOSTS = ["facebook.com", "instagram.com", "fb.com", "fb.me", "messenger.com"];

const MARKER_KEY = "funnel_meta_touch";
/** Même durée que le cookie `_fbc` de Meta. */
const MARKER_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

type Marker = { via: string; at: string };

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** La visite courante vient-elle de Meta ? Le motif, ou `null`. */
export function landingTouch(url: string, referrer: string): string | null {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    params = new URLSearchParams();
  }

  if (params.get("fbclid")) return "fbclid";

  const source = params.get("utm_source");
  if (source && META_SOURCE.test(source)) return `utm_source=${source}`;

  const host = hostOf(referrer);
  if (host && META_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return `referrer ${host}`;
  }

  return null;
}

/** Une visite antérieure venait-elle de Meta ? Le motif, ou `null`. */
export function earlierTouch(cookie: string, marker: string | null, now = Date.now()): string | null {
  if (/(?:^|;\s*)_fbc=[^;]+/.test(cookie)) return "cookie _fbc";

  if (marker) {
    try {
      const parsed = JSON.parse(marker) as Partial<Marker>;
      const at = parsed.at ? Date.parse(parsed.at) : NaN;
      if (parsed.via && Number.isFinite(at) && now - at < MARKER_MAX_AGE_MS) {
        return `${parsed.via} (visite précédente)`;
      }
    } catch {
      /* marqueur illisible : comme s'il n'existait pas */
    }
  }

  return null;
}

/**
 * Le motif Meta de la session, ou `null`. À appeler dans le navigateur, à
 * chaque envoi vers le serveur : une arrivée Meta rafraîchit le marqueur, et
 * le cookie `_fbc` n'est posé par le pixel qu'après le chargement de la page.
 */
export function metaTouch(): string | null {
  if (typeof window === "undefined") return null;

  const current = landingTouch(window.location.href, document.referrer);
  if (current) {
    try {
      const marker: Marker = { via: current, at: new Date().toISOString() };
      window.localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
    } catch {
      /* stockage indisponible : le cookie _fbc prendra le relais */
    }
    return current;
  }

  let marker: string | null = null;
  try {
    marker = window.localStorage.getItem(MARKER_KEY);
  } catch {
    /* idem */
  }
  return earlierTouch(document.cookie, marker);
}
