import { Logger } from '@nestjs/common';
import { SubdomainUtilService } from './subdomain-util.service';
describe('subdomain parsing', () => {
  const service = new SubdomainUtilService();
  it.each([
    ['BE-SUB-001', 'acme.localhost', 'acme'],
    ['BE-SUB-002', 'acme.localhost:3000', 'acme'],
    ['BE-SUB-003', 'ACME.example.com', 'acme'],
    ['BE-SUB-004', 'example.com', null],
    ['BE-SUB-005', 'localhost', null],
  ])('[%s] %s -> %s', (_id, host, result) =>
    expect(service.extractSubdomainFromHost(host)).toBe(result),
  );
  it('[BE-SUB-006] {SubdomainUtilService.getExcludedSubdomains} {SubdomainUtilService.extractSubdomainFromHost} {SubdomainUtilService.isExcludedSubdomain} excludes each system subdomain for production and localhost', () => {
    expect(service.getExcludedSubdomains()).toEqual([
      'www',
      'api',
      'admin',
      'app',
    ]);
    for (const name of service.getExcludedSubdomains()) {
      expect(
        service.extractSubdomainFromHost(`${name.toUpperCase()}.example.com`),
      ).toBeNull();
      expect(
        service.extractSubdomainFromHost(`${name.toUpperCase()}.localhost`),
      ).toBeNull();
      expect(service.isExcludedSubdomain(name.toUpperCase())).toBe(true);
    }
    expect(service.isExcludedSubdomain('acme')).toBe(false);
    const copy = service.getExcludedSubdomains();
    copy.push('acme');
    expect(service.isExcludedSubdomain('acme')).toBe(false);
  });
  it('[BE-SUB-007] {SubdomainUtilService.extractSubdomainFromHost} multi-level hosts take the first label (characterization: confirm intent)', () =>
    expect(service.extractSubdomainFromHost('a.b.example.com')).toBe('a'));
  it.each(['127.0.0.1', '127.0.0.1:3000', '::1', '[::1]:3000'])(
    '[BE-SUB-008] IP host %s is not a tenant',
    (host) => expect(service.extractSubdomainFromHost(host)).toBeNull(),
  );
  it('[BE-SUB-009] {SubdomainUtilService.extractSubdomainFromUrl} parses full HTTP/HTTPS URLs and bare hosts', () => {
    expect(
      service.extractSubdomainFromUrl('https://acme.example.com/path'),
    ).toBe('acme');
    expect(
      service.extractSubdomainFromUrl('http://ACME.localhost:3000/path'),
    ).toBe('acme');
    expect(service.extractSubdomainFromUrl('acme.localhost')).toBe('acme');
  });
  it('[BE-SUB-010] {SubdomainUtilService.extractSubdomainFromUrl} invalid URLs return null without throwing', () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      expect(service.extractSubdomainFromUrl('not a url')).toBeNull();
      expect(service.extractSubdomainFromUrl('https://')).toBeNull();
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
  it('[BE-SUB-011] {SubdomainUtilService.extractSubdomainFromRequest} origin wins then referer then host, skipping sources without a tenant', () => {
    const headers = {
      origin: 'https://origin.example.com',
      referer: 'https://referer.example.com',
      host: 'host.example.com',
    };
    expect(service.extractSubdomainFromRequest({ headers })).toBe('origin');
    expect(
      service.extractSubdomainFromRequest({
        headers: { ...headers, origin: 'https://example.com' },
      }),
    ).toBe('referer');
    expect(
      service.extractSubdomainFromRequest({
        headers: {
          ...headers,
          origin: undefined,
          referer: 'https://example.com',
        },
      }),
    ).toBe('host');
    expect(
      service.extractSubdomainFromRequest({
        headers: { host: 'host.localhost' },
      }),
    ).toBe('host');
    expect(service.extractSubdomainFromRequest({ headers: {} })).toBeNull();
  });
});
