import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { IS_PREVIEW } from "@/lib/preview";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * L'ACCÈS À L'ADMINISTRATION — un mot de passe, un cookie signé.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Volontairement minimal : ce tunnel est un modèle que des clients déploient
 * chez eux. Leur imposer un fournisseur d'identité à configurer avant de voir
 * leur première candidature serait le meilleur moyen qu'ils ne le déploient
 * jamais. Changer le mot de passe, c'est changer une variable d'environnement.
 *
 * Le cookie ne contient aucun secret : une date d'expiration et sa signature
 * HMAC. Sans état côté serveur, donc rien à invalider — sauf en changeant
 * `AUTH_SECRET`, qui révoque toutes les sessions d'un coup.
 */

const COOKIE = "funnel_admin";
const MAX_AGE_SECONDS = 30 * 24 * 3600;

function sign(payload: string): string {
  return createHmac("sha256", serverEnv().AUTH_SECRET).update(payload).digest("base64url");
}

/** Comparaison à temps constant : une comparaison naïve fuit la signature. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function issueToken(): { value: string; maxAge: number } {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return { value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_SECONDS };
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/** Le mot de passe fourni est-il le bon ? Comparaison à temps constant. */
export function passwordMatches(candidate: string): boolean {
  const expected = serverEnv().ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

/** Session valide ? En mode aperçu, l'administration est ouverte. */
export async function isSignedIn(): Promise<boolean> {
  if (IS_PREVIEW) return true;
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

export const AUTH_COOKIE = COOKIE;
