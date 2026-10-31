import { getLogo } from "@/lib/appearance-store";

/**
 * Sert le logo téléversé dans l'administration.
 *
 * L'image vit en base, sous forme de texte : ce tunnel ne dépend d'aucun
 * service de stockage, un client n'a qu'un Postgres à créer. Elle est mise en
 * cache un an par l'URL — le `?v=` change à chaque téléversement.
 *
 * Un SVG peut porter du script ; servi ici, il ne s'exécute pas dans une
 * balise `<img>`, mais il le pourrait s'il était ouvert directement dans un
 * onglet. La politique de sécurité ci-dessous l'en empêche.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const logo = await getLogo().catch(() => null);
  if (!logo) return new Response(null, { status: 404 });

  return new Response(Buffer.from(logo.data, "base64"), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
