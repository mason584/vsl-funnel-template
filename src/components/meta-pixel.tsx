import Script from "next/script";

/**
 * Le pixel Meta des pages publiques.
 *
 * Monté par le layout du groupe public, jamais par le layout racine :
 * `/admin` ne doit ni être pisté ni polluer l'attribution des campagnes avec
 * notre propre trafic.
 *
 * L'identifiant vient des réglages (base de données), pas d'une constante :
 * un client colle le sien dans l'administration et il s'applique partout, sans
 * redéploiement. Sans identifiant, rien n'est injecté du tout.
 */
export function MetaPixel({ pixelId }: { pixelId: string }) {
  if (!pixelId) return null;

  const snippet = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');`;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {snippet}
      </Script>
      <noscript>
        {/* Repli sans JavaScript : `next/image` en ferait une requête
            optimisée et l'événement ne partirait jamais. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
