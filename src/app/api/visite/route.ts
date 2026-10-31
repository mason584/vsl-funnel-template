import { headers } from "next/headers";
import { db } from "@/db";
import { visits } from "@/db/schema";

/**
 * Enregistre une visite.
 *
 * Route publique et volontairement muette : elle répond 204 quoi qu'il
 * arrive. Une erreur de comptage ne doit jamais remonter au visiteur, et une
 * réponse détaillée n'apprendrait rien d'utile à qui l'appellerait à la main.
 */
export const dynamic = "force-dynamic";

/** Bornes de sécurité : rien de ce qui arrive ici n'est de confiance. */
function clip(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const sessionId = clip(body.sessionId, 128);
    const path = clip(body.path, 256);
    if (!sessionId || !path) return new Response(null, { status: 204 });

    // On ne garde que les clés d'attribution attendues, tronquées : une URL
    // d'ad Meta avec ses utm et son fbclid dépasse vite le raisonnable.
    const utm: Record<string, string> = {};
    const raw = (body.utm ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw)) {
      if (!/^(utm_[a-z]+|gclid|fbclid)$/.test(key)) continue;
      const clipped = clip(value, 200);
      if (clipped) utm[key] = clipped;
    }

    const head = await headers();

    await db.insert(visits).values({
      sessionId,
      path,
      referrer: clip(body.referrer, 500),
      landingUrl: clip(body.landingUrl, 500),
      utm,
      country: head.get("x-vercel-ip-country"),
      userAgent: head.get("user-agent")?.slice(0, 400) ?? null,
    });
  } catch (error) {
    console.error("Visite non comptée", error);
  }

  return new Response(null, { status: 204 });
}
