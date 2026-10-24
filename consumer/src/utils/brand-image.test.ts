import { expect, it } from "vitest";
import {
  appIconUrl,
  cloudinaryVariant,
  iconAdvice,
  logoAdvice,
  pdfLogoUrl,
} from "./brand-image";

const LOGO =
  "https://res.cloudinary.com/demo/image/upload/v1712/posbuzz/logo.png";

it("[CO-LOGO-001] asks Cloudinary for a trimmed, sized variant and leaves other URLs alone", () => {
  expect(appIconUrl(LOGO, 36)).toBe(
    "https://res.cloudinary.com/demo/image/upload/e_trim/c_fit,w_72,h_72/f_auto,q_auto/v1712/posbuzz/logo.png",
  );
  // same variant the backend prints in PDFs (cloudinary-image.util.ts)
  expect(pdfLogoUrl(LOGO)).toBe(
    "https://res.cloudinary.com/demo/image/upload/e_trim/c_limit,w_600,h_600/f_png/v1712/posbuzz/logo.png",
  );
  for (const url of [
    "",
    "https://cdn.example.com/image/upload/logo.png",
    "https://res.cloudinary.com/demo/raw/upload/v1/logo.png",
    "blob:http://localhost/123",
  ]) {
    expect(cloudinaryVariant(url, "f_png")).toBe(url);
  }
});

it("[CO-LOGO-002] warns about small logos and small or non-square icons only", () => {
  expect(logoAdvice(299)).toMatch(/only 299 px wide/);
  expect(logoAdvice(300)).toBeNull();
  expect(iconAdvice(600, 200)).toMatch(/not square/);
  expect(iconAdvice(250, 200)).toBeNull(); // within 1.25
  expect(iconAdvice(100, 100)).toMatch(/may look blurry/);
  expect(iconAdvice(128, 128)).toBeNull();
});
