import Link from "next/link";
import { BRAND } from "@/brand/brand";
import { IS_PREVIEW } from "@/lib/preview";
import { AdminNav } from "./nav";
import { signOut } from "./connexion/actions";

/**
 * La coquille de l'administration.
 *
 * Ni pixel ni compteur de visite : cet espace n'est pas le tunnel, et l'y
 * pister mélangerait notre trafic interne aux données d'attribution.
 *
 * La page de connexion traverse ce layout sans lui : elle n'a ni barre
 * latérale ni navigation, puisqu'il n'y a rien à naviguer avant d'entrer.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#admin-contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--panel)] focus:px-4 focus:py-2 focus:text-sm"
      >
        Aller au contenu
      </a>

      <aside className="flex shrink-0 flex-col bg-[var(--sidebar,var(--inverse))] text-[var(--text-on-sidebar,var(--text-on-inverse))] md:w-60">
        <div className="px-6 py-6">
          <Link href="/admin" className="font-display text-[22px] no-underline">
            {BRAND.name}
          </Link>
          <p className="mt-1 text-xs opacity-60">Tunnel</p>
        </div>

        <AdminNav />

        <div className="border-t border-white/10 px-6 py-4">
          <Link href="/" className="text-xs opacity-70 hover:opacity-100">
            Voir le site public →
          </Link>
          {!IS_PREVIEW && (
            <form action={signOut}>
              <button type="submit" className="mt-3 text-xs text-[var(--accent)] hover:underline">
                Déconnexion
              </button>
            </form>
          )}
          {IS_PREVIEW && (
            <p className="mt-3 text-xs opacity-50">Mode aperçu — accès ouvert</p>
          )}
        </div>
      </aside>

      <main id="admin-contenu" className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
