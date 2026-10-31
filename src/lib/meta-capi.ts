import "server-only";
import { createHash } from "node:crypto";
import { getMetaSettings } from "@/lib/settings";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONVERSIONS API META — l'événement de réservation, côté serveur.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le pixel du navigateur envoie le `PageView` et, sur `/merci`, l'événement de
 * réservation. Celui-ci part aussi d'ici, avec le même `event_id` : Meta
 * dédoublonne les deux sur cette clé et compte une conversion, pas deux.
 *
 * Il part **uniquement pour une session qui a réservé**, et uniquement si le
 * trafic vient de Meta (`lib/meta-touch.ts`) : un rendez-vous venu de YouTube
 * ou d'un email n'apprend rien à l'algorithme.
 *
 * Version de l'API : v26.0, publiée le 29 juillet 2026. À relire quand Meta
 * annoncera son remplacement — chaque version vit environ deux ans.
 */

const API_VERSION = "v26.0";

/** Meta n'accepte que des identifiants hachés — jamais une adresse en clair. */
function hash(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Le téléphone se normalise en chiffres seuls avant hachage. */
function hashPhone(value: string): string {
  return createHash("sha256").update(value.replace(/\D/g, "")).digest("hex");
}

export type ConversionEvent = {
  /** Même valeur que l'`eventID` du pixel : Meta dédoublonne sur cette clé. */
  eventId: string;
  /** `Schedule` (standard) ou un nom personnalisé de 50 caractères au plus. */
  eventName: string;

  email?: string | null;
  phoneNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;

  eventSourceUrl?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  /** `fbc` et `fbp`, relevés dans les cookies du navigateur s'ils existent. */
  fbc?: string | null;
  fbp?: string | null;

  /**
   * Code de l'onglet « Événements de test ». Avec lui, l'événement s'affiche
   * en quelques secondes mais ne compte nulle part ; sans lui, il entre dans
   * le vrai pipeline.
   */
  testEventCode?: string | null;
};

export type CapiResult = { ok: boolean; detail: string };


/**
 * Envoie l'événement.
 *
 * `ok` n'est vrai que si Meta l'a accepté — l'appelant n'horodate
 * `metaEventSentAt` que dans ce cas, pour pouvoir rejouer plus tard avec le
 * même `event_id` (donc sans risque de doublon). `detail` porte la trace Meta
 * ou le motif d'échec, affiché dans la fiche de l'administration.
 *
 * Ne lève jamais : la réservation du visiteur ne doit pas échouer parce que
 * Meta est indisponible.
 */
export async function sendConversionEvent(event: ConversionEvent): Promise<CapiResult> {
  const { pixelId, capiToken, testEventCode } = await getMetaSettings();

  if (!pixelId) return { ok: false, detail: "Aucun identifiant de pixel configuré." };
  if (!capiToken) return { ok: false, detail: "Aucun token Conversions API configuré." };

  const userData: Record<string, string> = {};
  if (event.email) userData.em = hash(event.email);
  if (event.phoneNumber) userData.ph = hashPhone(event.phoneNumber);
  if (event.firstName) userData.fn = hash(event.firstName);
  if (event.lastName) userData.ln = hash(event.lastName);
  if (event.clientIpAddress) userData.client_ip_address = event.clientIpAddress;
  if (event.clientUserAgent) userData.client_user_agent = event.clientUserAgent;
  if (event.fbc) userData.fbc = event.fbc;
  if (event.fbp) userData.fbp = event.fbp;

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.eventSourceUrl ?? undefined,
        user_data: userData,
        // Jamais une réponse du formulaire ni un chiffre d'affaires : Meta
        // interdit l'envoi de données sensibles par ses outils.
        custom_data: { content_name: "appel", content_category: "booking" },
      },
    ],
    test_event_code: event.testEventCode || testEventCode || undefined,
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(capiToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Meta a refusé l'événement", res.status, body.slice(0, 300));
      return { ok: false, detail: `Meta a refusé (${res.status}) : ${body.slice(0, 200)}` };
    }

    const receipt = (await res.json().catch(() => ({}))) as {
      events_received?: number;
      fbtrace_id?: string;
    };
    return {
      ok: true,
      detail: `events_received=${receipt.events_received ?? "?"} · fbtrace ${receipt.fbtrace_id ?? "?"}`,
    };
  } catch (error) {
    console.error("Meta injoignable", error);
    return { ok: false, detail: `Meta injoignable : ${String(error).slice(0, 200)}` };
  }
}
