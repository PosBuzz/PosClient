import { ReceiptPdfService } from './receipt-pdf.service';

const ORIGINAL =
  'https://res.cloudinary.com/demo/image/upload/v1712/posbuzz/logo.webp';
const PDF_VARIANT =
  'https://res.cloudinary.com/demo/image/upload/e_trim/c_limit,w_600,h_600/f_png/v1712/posbuzz/logo.webp';

const respond = (body: string | null) =>
  body === null
    ? ({ ok: false } as Response)
    : ({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      } as Response);

describe('ReceiptPdfService logo loading', () => {
  const loadLogo = (url: string) =>
    (new ReceiptPdfService() as any).loadLogo(url) as Promise<Buffer | null>;
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('[BE-LOGO-003] PDFs fetch the trimmed PNG variant of a Cloudinary logo', async () => {
    fetchMock.mockResolvedValue(respond('png'));
    await expect(loadLogo(ORIGINAL)).resolves.toEqual(Buffer.from('png'));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([PDF_VARIANT]);
  });

  it('[BE-LOGO-004] falls back to the original logo when the variant cannot be fetched', async () => {
    fetchMock.mockImplementation(async (url) =>
      respond(url === PDF_VARIANT ? null : 'original'),
    );
    await expect(loadLogo(ORIGINAL)).resolves.toEqual(Buffer.from('original'));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      PDF_VARIANT,
      ORIGINAL,
    ]);
  });

  it('[BE-LOGO-005] a logo outside Cloudinary is fetched once, as is', async () => {
    fetchMock.mockResolvedValue(respond('jpg'));
    const other = 'https://cdn.example.com/logo.jpg';
    await expect(loadLogo(other)).resolves.toEqual(Buffer.from('jpg'));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([other]);
    await expect(loadLogo('')).resolves.toBeNull();
  });
});
