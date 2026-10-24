import {
  PDF_LOGO_TRANSFORMATION,
  cloudinaryVariant,
} from './cloudinary-image.util';

describe('cloudinaryVariant', () => {
  it('[BE-LOGO-001] inserts the transformation right after /image/upload/ of a Cloudinary URL', () => {
    expect(
      cloudinaryVariant(
        'https://res.cloudinary.com/demo/image/upload/v1712/posbuzz/logo.jpg',
        PDF_LOGO_TRANSFORMATION,
      ),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/e_trim/c_limit,w_600,h_600/f_png/v1712/posbuzz/logo.jpg',
    );
    // an eager transformation already in the URL is kept and runs first
    expect(
      cloudinaryVariant(
        'http://res.cloudinary.com/demo/image/upload/c_scale,w_800/v1/logo.png',
        'f_png',
      ),
    ).toBe(
      'http://res.cloudinary.com/demo/image/upload/f_png/c_scale,w_800/v1/logo.png',
    );
  });

  it('[BE-LOGO-002] leaves empty, local, other-host and non-upload URLs unchanged', () => {
    for (const url of [
      '',
      '/opt/posbuzz/uploads/logo.png',
      'https://cdn.example.com/image/upload/logo.png',
      'https://res.cloudinary.com/demo/raw/upload/v1/logo.png',
    ]) {
      expect(cloudinaryVariant(url, PDF_LOGO_TRANSFORMATION)).toBe(url);
    }
  });
});
