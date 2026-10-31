import Link from "next/link";
import { BRAND } from "@/brand/brand";
import type { ResolvedWordmark } from "@/lib/appearance";

/**
 * Les quelques briques partagées entre le tunnel public et l'administration.
 *
 * Aucune n'écrit de couleur : tout passe par les variables de `tokens.css`,
 * pour qu'un changement de marque n'oblige à toucher aucun composant.
 */

/**
 * Le wordmark de l'en-tête.
 *
 * Reçoit le wordmark résolu (administration, sinon `brand.ts`) plutôt que de
 * le lire lui-même : il est aussi rendu par le questionnaire, un composant
 * client qui ne peut pas interroger la base.
 */
export function Wordmark({
  mark,
  className = "",
}: {
  mark?: ResolvedWordmark;
  className?: string;
}) {
  const resolved: ResolvedWordmark =
    mark ??
    (BRAND.wordmark.kind === "image"
      ? { kind: "image", src: BRAND.wordmark.src, alt: BRAND.wordmark.alt, height: BRAND.wordmark.height }
      : { kind: "text", text: BRAND.wordmark.text });

  if (resolved.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved.src}
        alt={resolved.alt}
        height={resolved.height}
        style={{ height: resolved.height, width: "auto" }}
        className={className}
      />
    );
  }
  return (
    <span
      className={`font-display text-[22px] uppercase leading-none tracking-[0.09em] ${className}`}
    >
      {resolved.text}
    </span>
  );
}

export function Button({
  variant = "accent",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "accent" | "inverse" | "ghost";
}) {
  return (
    <button className={`${buttonClass(variant)} ${className}`} {...props} />
  );
}

export function ButtonLink({
  href,
  variant = "accent",
  className = "",
  children,
}: {
  href: string;
  variant?: "accent" | "inverse" | "ghost";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant)} no-underline ${className}`}>
      {children}
    </Link>
  );
}

/** `min-h-11` vaut 44 px — la plus petite cible tactile confortable. */
export function buttonClass(variant: "accent" | "inverse" | "ghost"): string {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-6 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    accent:
      "bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-deep)]",
    inverse:
      "bg-[var(--inverse)] text-[var(--text-on-inverse)] hover:bg-[var(--inverse-soft)]",
    ghost:
      "border border-[var(--border-input)] bg-transparent text-[var(--text)] hover:bg-[var(--panel-accent)]",
  };
  return `${base} ${variants[variant]}`;
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-6 ${className}`}
    >
      {children}
    </div>
  );
}
