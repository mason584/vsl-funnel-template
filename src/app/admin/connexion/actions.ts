"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, issueToken, passwordMatches } from "@/lib/auth";

/**
 * Connexion et déconnexion.
 *
 * Aucune tentative n'est distinguée d'une autre dans la réponse : mot de passe
 * vide, faux ou absent renvoient le même message. Distinguer les cas
 * n'aiderait qu'à deviner.
 */
export async function signIn(_prev: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("suite") ?? "/admin");

  // Une pause fixe sur l'échec : elle décourage l'essai en boucle sans
  // dépendre d'un compteur à stocker quelque part.
  if (!passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 700));
    return { error: "Mot de passe incorrect." };
  }

  const token = issueToken();
  const store = await cookies();
  store.set(AUTH_COOKIE, token.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token.maxAge,
  });

  // Une destination ne peut être qu'un chemin interne : sans ce garde,
  // `?suite=https://…` ferait de la page de connexion un tremplin.
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/admin/connexion");
}
