/**
 * Brand images are uploaded to Cloudinary as one original. Each place that shows one asks
 * Cloudinary for a variant (size, trim, format) by inserting a transformation into the
 * delivery URL; a URL that is not a Cloudinary upload is returned unchanged.
 */
const UPLOAD_SEGMENT = '/image/upload/';

export function cloudinaryVariant(url: string, transformation: string): string {
  if (!url || !/^https?:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const at = url.indexOf(UPLOAD_SEGMENT);
  if (at < 0) return url;
  const insertAt = at + UPLOAD_SEGMENT.length;
  return `${url.slice(0, insertAt)}${transformation}/${url.slice(insertAt)}`;
}

/** Logo for PDFs: empty margins trimmed, at most 600px, PNG (pdfkit reads PNG and JPEG only). */
export const PDF_LOGO_TRANSFORMATION = 'e_trim/c_limit,w_600,h_600/f_png';
