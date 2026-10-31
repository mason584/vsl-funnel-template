import "server-only";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";

/**
 * Le garde de l'administration.
 *
 * À appeler dans CHAQUE page et CHAQUE action serveur de `/admin` — pas
 * seulement dans le layout. Une action serveur est une route publique : la
 * protéger au rendu ne la protège pas à l'appel, et le middleware ne fait que
 * constater la présence d'un cookie, sans en vérifier la signature.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isSignedIn())) redirect("/admin/connexion");
}
