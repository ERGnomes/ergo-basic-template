import { useEffect } from "react";
import { siteDescription, siteName, siteUrl } from "./siteBranding";

/**
 * Syncs `document.title` and basic meta tags from env-driven branding.
 * CRA injects static tags from `public/index.html`; we refresh description when the app mounts.
 */
export function useDocumentMeta(): void {
  useEffect(() => {
    document.title = siteName;

    const desc = siteDescription;
    let el = document.querySelector('meta[name="description"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "description");
      document.head.appendChild(el);
    }
    el.setAttribute("content", desc);

    if (siteUrl) {
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement("meta");
        ogUrl.setAttribute("property", "og:url");
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute("content", siteUrl);

      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement("meta");
        ogTitle.setAttribute("property", "og:title");
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute("content", siteName);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement("meta");
        ogDesc.setAttribute("property", "og:description");
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute("content", desc);
    }
  }, []);
}
