import { PortfolioRevalidationService } from './portfolio-revalidation.service';

describe('portfolio publish hook', () => {
  const config = {
    portfolioRevalidateUrl: 'https://portfolio.example.test/revalidate',
    portfolioRevalidateSecret: 'test-hook-not-for-prod',
  };
  afterEach(() => jest.restoreAllMocks());

  it('[BE-CMS-110] {PortfolioRevalidationService.trigger} posts the publishing payload and configured credential only to the hook', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    expect(
      await new PortfolioRevalidationService(config as never).trigger(),
    ).toEqual({ revalidated: true });
    expect(fetch).toHaveBeenCalledWith(
      config.portfolioRevalidateUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ source: 'admin-portfolio' }),
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': config.portfolioRevalidateSecret,
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('[BE-CMS-111] {PortfolioRevalidationService.trigger} missing configuration makes no request and hook failures preserve the save', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    expect(
      await new PortfolioRevalidationService({} as never).trigger(),
    ).toEqual({ revalidated: false, reason: 'not_configured' });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    const service = new PortfolioRevalidationService(config as never);
    expect(await service.trigger()).toEqual({
      revalidated: false,
      reason: 'status_503',
    });
    fetch.mockRejectedValueOnce(new Error('Hook unavailable'));
    expect(await service.trigger()).toEqual({
      revalidated: false,
      reason: 'request_failed',
    });
  });
});
