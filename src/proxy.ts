import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde de `/admin`.
 *
 * Ce fichier s'appelait `middleware.ts` : Next 16 a renommé la convention en
 * `proxy`, le nom « middleware » prêtant à confusion avec celui d'Express.
 *
 * Le middleware n'ouvre pas la porte, il évite seulement qu'un visiteur non
 * connecté rende la coquille de l'administration. La vraie autorisation vit
 * dans chaque page et chaque action serveur (`requireAdmin`), parce qu'une
 * action serveur est une route publique : la protéger au rendu ne la protège
 * pas à l'appel.
 *
 * La vérification de signature elle-même reste dans `lib/auth.ts` ; ici on ne
 * fait que constater la présence d'un cookie, le middleware tournant sur un
 * runtime sans accès à `node:crypto` selon les configurations.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && process.env.PREVIEW_MODE === "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/admin/connexion";

  if (isAdmin && !isLogin && !request.cookies.get("funnel_admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/connexion";
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
