import type { Video } from "@/content/types";
import { VideoPlayer } from "@/components/video";

/**
 * Une vidéo du tunnel, ou sa vignette d'attente.
 *
 * Tant qu'aucune vidéo n'est posée dans le contenu, la page montre un cadre
 * 16:9 avec un bouton de lecture et la légende — assez pour voir la mise en
 * page, assez explicite pour qu'on sache quoi remplir. Rien n'est cassé, rien
 * n'est vide : c'est l'état normal d'un tunnel qu'on vient de cloner.
 */
export function VideoSlot({ video, caption }: { video: Video | null; caption: string }) {
  if (video) return <VideoPlayer source={video} />;

  return (
    <div
      className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--bg-deep)] shadow-[var(--shadow-strong)]"
      aria-label={caption}
    >
      <span
        aria-hidden
        className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-strong)]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 4.5 19 12 7 19.5Z" />
        </svg>
      </span>
      <span className="eyebrow absolute bottom-4 left-5">{caption}</span>
    </div>
  );
}
