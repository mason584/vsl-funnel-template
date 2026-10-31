"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/apparence", label: "Apparence" },
  { href: "/admin/reglages", label: "Réglages" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation de l'administration" className="flex flex-1 flex-col gap-1 px-3">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-md px-3 text-sm no-underline transition-colors ${
              active
                ? "bg-white/10 font-medium text-[var(--text-on-sidebar,var(--text-on-inverse))]"
                : "text-[var(--text-on-sidebar,var(--text-on-inverse))]/75 hover:bg-white/5"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
