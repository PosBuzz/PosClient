/**
 * Brand images are uploaded to Cloudinary once. Each place that shows one asks Cloudinary
 * for a variant (size, trim, format) by inserting a transformation into the delivery URL,
 * so a single upload fits a square sidebar slot and a wide receipt header alike.
 * A URL that is not a Cloudinary upload is returned unchanged.
 * Mirrors backend/src/common/utils/cloudinary-image.util.ts.
 */
const UPLOAD_SEGMENT = "/image/upload/";

export function cloudinaryVariant(url: string, transformation: string): string {
  if (!url || !/^https?:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const at = url.indexOf(UPLOAD_SEGMENT);
  if (at < 0) return url;
  const insertAt = at + UPLOAD_SEGMENT.length;
  return `${url.slice(0, insertAt)}${transformation}/${url.slice(insertAt)}`;
}

/** Small square spots (sidebar, POS header): margins trimmed, fitted at 2x for sharp screens. */
export const appIconUrl = (url: string, size: number) =>
  cloudinaryVariant(
    url,
    `e_trim/c_fit,w_${size * 2},h_${size * 2}/f_auto,q_auto`,
  );

/** What receipts and PDFs print; the backend fetches this same variant. */
export const pdfLogoUrl = (url: string) =>
  cloudinaryVariant(url, "e_trim/c_limit,w_600,h_600/f_png");

/** Upload advice shown before an image is used; null when the image suits the spot. */
export function logoAdvice(width: number): string | null {
  if (width < 300) {
    return `This logo is only ${width} px wide, so it may print blurry. Use one at least 600 px wide.`;
  }
  return null;
}

export function iconAdvice(width: number, height: number): string | null {
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 1.25) {
    return `This icon is ${width}×${height} px, not square, so it will look small in square spots. Use a square image.`;
  }
  if (Math.min(width, height) < 128) {
    return `This icon is only ${width}×${height} px and may look blurry. Use at least 256×256 px.`;
  }
  return null;
}
