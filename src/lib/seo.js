export const SITE_NAME = "TrustHome";
export const DEFAULT_DESCRIPTION = "Find verified rentals and homes across the Philippines. Compare properties with TrustHome.";
export const DEFAULT_TITLE = "TrustHome | Verified Rentals in the Philippines";

export function updatePageMetadata({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = "/og-image.png",
  type = "website",
  robots = "index, follow",
  structuredData = null,
}) {
  const pageUrl = new URL(path, window.location.origin).href;
  document.title = title;

  setMetaTag("name", "description", description);
  setMetaTag("name", "robots", robots);
  setMetaTag("property", "og:type", type);
  setMetaTag("property", "og:site_name", SITE_NAME);
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:url", pageUrl);
  setMetaTag("property", "og:image", new URL(image, window.location.origin).href);
  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);
  setMetaTag("name", "twitter:image", new URL(image, window.location.origin).href);

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = pageUrl;

  document.head.querySelector('[data-seo-jsonld="true"]')?.remove();
  if (structuredData) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seoJsonld = "true";
    script.textContent = JSON.stringify(structuredData);
    document.head.append(script);
  }
}

function setMetaTag(attribute, name, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.append(tag);
  }
  tag.content = content;
}
