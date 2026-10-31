"use client";

import { useActionState } from "react";
import { use } from "react";
import { BRAND } from "@/brand/brand";
import { signIn } from "./actions";

/**
 * L'entrée de l'administration. Un mot de passe, rien d'autre : ce tunnel est
 * un modèle que des clients déploient chez eux, et leur imposer un
 * fournisseur d'identité avant leur première candidature les en dissuaderait.
 */
export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = use(searchParams);
  const [state, action, pending] = useActionState(signIn, null as { error: string } | null);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form action={action} className="w-full max-w-sm">
        <h1 className="font-display text-[30px]">{BRAND.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Administration du tunnel</p>

        <input type="hidden" name="suite" value={suite ?? "/admin"} />

        <label className="mt-8 flex flex-col gap-2">
          <span className="text-sm text-[var(--text-secondary)]">Mot de passe</span>
          <input
            type="password"
            name="password"
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-md border border-[var(--border-input)] bg-[var(--panel)] px-4 py-3 text-base"
          />
        </label>

        {state?.error && (
          <p className="mt-3 text-sm text-[var(--accent-deep)]" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--inverse)] px-6 text-[15px] font-medium text-[var(--text-on-inverse)] disabled:opacity-60"
        >
          {pending ? "Vérification…" : "Entrer"}
        </button>
      </form>
    </main>
  );
}
