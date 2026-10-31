"use client";

import { useEffect } from "react";
import { STANDARD_EVENTS } from "@/lib/meta-events";

type FbqWindow = Window & { fbq?: (...args: unknown[]) => void };

/**
 * Tire l'événement de conversion au pixel, sur la page de remerciement.
 *
 * Ce composant n'est monté que si le **serveur** a vérifié que la session a
 * réservé un créneau ET que le trafic vient de Meta : visiter l'URL à la main
 * ne déclenche rien. L'`eventID` est le même identifiant que celui de l'envoi
 * Conversions API : Meta dédoublonne les deux sur cette clé, et compte une
 * conversion, pas deux. Le garde en `sessionStorage` évite un second envoi
 * au rechargement.
 */
export function ConversionPing({ eventName, eventId }: { eventName: string; eventId: string }) {
  useEffect(() => {
    const guard = `funnel_fired_${eventId}`;
    try {
      if (window.sessionStorage.getItem(guard) === "1") return;
    } catch {
      /* stockage indisponible : Meta dédoublonnera sur event_id de toute façon */
    }

    // Le pixel se charge en différé — quelques tentatives avant d'abandonner.
    let tries = 0;
    let timer: number | undefined;

    const attempt = () => {
      const fbq = (window as FbqWindow).fbq;
      if (typeof fbq === "function") {
        // Un événement standard part en `track`, un nom personnalisé en
        // `trackCustom` : Meta refuse l'inverse.
        const method = STANDARD_EVENTS.has(eventName) ? "track" : "trackCustom";
        fbq(method, eventName, { content_name: "appel" }, { eventID: eventId });
        try {
          window.sessionStorage.setItem(guard, "1");
        } catch {
          /* tant pis pour le garde local */
        }
        return;
      }
      tries += 1;
      if (tries < 25) timer = window.setTimeout(attempt, 200);
    };
    attempt();

    return () => window.clearTimeout(timer);
  }, [eventName, eventId]);

  return null;
}
