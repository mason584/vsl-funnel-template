"use client";

import { useEffect } from "react";
import type { Video } from "@/content/types";

/**
 * Le lecteur vidéo, quel que soit l'hébergeur.
 *
 * Vidalytics a droit à un traitement à part : son snippet officiel est une
 * balise `<script>` que React n'exécute jamais. On rejoue donc sa séquence à
 * la main — `loader.min.js`, puis `player.min.js` par son loader, puis
 * `Embed().run(divId)`.
 *
 * YouTube est chargé depuis `youtube-nocookie` : poser un cookie publicitaire
 * de plus ne rapporte rien. Wistia passe par son iframe officielle, la seule
 * forme qui ne demande aucun script dans la page.
 */

type VidalyticsWindow = Window & {
  Vidalytics?: { Embed?: new () => { run: (id: string) => void; loadCss?: () => void } };
  VidalyticsL?: { Loader?: new () => { loadScript: (url: string, cb: () => void) => void } };
  _vidalytics?: Record<string, unknown>;
};

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-vidalytics="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(src)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.vidalytics = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Vidalytics : ${src}`)));
    document.head.appendChild(script);
  });
}

function Vidalytics({ embedId, baseUrl }: { embedId: string; baseUrl: string }) {
  useEffect(() => {
    const win = window as VidalyticsWindow;
    win.Vidalytics ??= {};
    win.VidalyticsL ??= {};
    win._vidalytics ??= {};

    let cancelled = false;

    loadScriptOnce(`${baseUrl}loader.min.js`)
      .then(() => {
        if (cancelled) return;
        const Loader = win.VidalyticsL?.Loader;
        if (!Loader) throw new Error("Vidalytics : Loader absent");
        return new Promise<void>((resolve) => {
          new Loader().loadScript(`${baseUrl}player.min.js`, () => resolve());
        });
      })
      .then(() => {
        if (cancelled) return;
        const container = document.getElementById(`vidalytics_embed_${embedId}`);
        // Conteneur déjà peuplé : `run` a déjà tourné (double effet du mode
        // strict de React en développement).
        if (!container || container.childElementCount > 0) return;
        const Embed = win.Vidalytics?.Embed;
        if (!Embed) throw new Error("Vidalytics : Embed absent");
        new Embed().run(`vidalytics_embed_${embedId}`);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [embedId, baseUrl]);

  return (
    <div
      id={`vidalytics_embed_${embedId}`}
      style={{ width: "100%", position: "relative", paddingTop: "56.25%" }}
    />
  );
}

export function VideoPlayer({ source }: { source: Video }) {
  /*
   * Le cadre reste sans `overflow: hidden` : les embeds Vidalytics réglés en
   * plein écran « virtuel » posent un calque en position absolue censé couvrir
   * tout le viewport, qu'un conteneur rogné enfermerait dans une boîte
   * verticale.
   */
  const frame =
    "overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--bg-deep)] shadow-[var(--shadow-strong)]";

  if (source.provider === "vidalytics") {
    return (
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-deep)] shadow-[var(--shadow-strong)]">
        <Vidalytics embedId={source.embedId} baseUrl={source.baseUrl} />
      </div>
    );
  }

  if (source.provider === "youtube") {
    return (
      <div className={`${frame} aspect-video`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${source.id}?rel=0`}
          title="Vidéo de présentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  if (source.provider === "wistia") {
    return (
      <div className={`${frame} aspect-video`}>
        <iframe
          src={`https://fast.wistia.net/embed/iframe/${source.id}?videoFoam=true&seo=false`}
          title="Vidéo"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  if (source.provider === "vimeo") {
    return (
      <div className={`${frame} aspect-video`}>
        <iframe
          src={`https://player.vimeo.com/video/${source.id}`}
          title="Vidéo de présentation"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      <video controls preload="metadata" poster={source.poster} className="w-full">
        <source src={source.src} />
      </video>
    </div>
  );
}
