import type { Metadata } from "next";
import { BRAND } from "@/brand/brand";
import { LANDING } from "@/content/landing";
import { DefaultFonts } from "@/components/default-fonts";
import "./globals.css";

/**
 * Le layout racine ne pose que les polices et les tokens de marque par défaut.
 * Les surcharges d'apparence saisies dans l'administration sont injectées par
 * les layouts publics uniquement : l'administration reste toujours lisible,
 * quelle que soit la charte choisie.
 *
 * Ni pixel, ni compteur de visite : ils sont montés par les layouts publics.
 * Les poser ici reviendrait à pister l'administration, et à noyer
 * l'attribution des campagnes sous notre propre trafic interne.
 */
export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: `${LANDING.meta.title} — ${BRAND.name}`, template: `%s — ${BRAND.name}` },
  description: LANDING.meta.description,
  icons: { icon: BRAND.favicon },
  openGraph: { siteName: BRAND.name, type: "website", images: [BRAND.ogImage] },
  // Les pages du tunnel ne s'indexent pas : le lien circule par les ads et par email.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <DefaultFonts />
        {children}
      </body>
    </html>
  );
}
