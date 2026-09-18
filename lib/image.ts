/**
 * Approved listing images served by `/api/company-assets?public=1`. The Next.js image optimizer can
 * fetch these (see `images.localPatterns`); private assets need the viewer's session and cannot be resized.
 */
export const isPublicAsset = (src: string) => src.startsWith("/api/company-assets?public=1");

/** A resized copy for images drawn outside `next/image`, such as map pins and the globe preview. */
export const resizedImage = (src: string, width: 64 | 128 | 256 | 640) =>
  isPublicAsset(src) || src.startsWith("https://") ? `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75` : src;
