import { isOriginAllowed } from './app.setup';

describe('isOriginAllowed', () => {
  const allowed = [
    'https://posbuzz.xyz',
    'https://*.posbuzz.xyz',
    'https://*.posbuzz.cloud',
    'http://localhost:3001',
  ];

  it('[BE-CORS-010] accepts an exact entry', () => {
    expect(isOriginAllowed('https://posbuzz.xyz', allowed)).toBe(true);
    expect(isOriginAllowed('http://localhost:3001', allowed)).toBe(true);
  });

  it('[BE-CORS-011] a wildcard entry matches exactly one label (tenant subdomains)', () => {
    expect(isOriginAllowed('https://shop1.posbuzz.xyz', allowed)).toBe(true);
    expect(isOriginAllowed('https://admin.posbuzz.cloud', allowed)).toBe(true);
    expect(isOriginAllowed('https://a.b.posbuzz.xyz', allowed)).toBe(false);
  });

  it('[BE-CORS-012] the pattern is anchored: scheme, port and lookalike hosts are refused', () => {
    for (const origin of [
      'http://shop1.posbuzz.xyz',
      'https://posbuzz.xyz.evil.com',
      'https://evil.com/https://shop1.posbuzz.xyz',
      'https://shop1.posbuzzXxyz',
      'http://localhost:3002',
      'https://evil.example.com',
    ]) {
      expect({ origin, ok: isOriginAllowed(origin, allowed) }).toEqual({
        origin,
        ok: false,
      });
    }
  });

  it('[BE-CORS-013] an empty allow-list allows nothing', () => {
    expect(isOriginAllowed('https://posbuzz.xyz', [])).toBe(false);
  });
});
