import { LoginThrottlerGuard } from './login-throttler.guard';

const tracker = (req: Record<string, any>) =>
  (
    LoginThrottlerGuard.prototype as unknown as {
      getTracker(r: Record<string, any>): Promise<string>;
    }
  ).getTracker(req);

describe('LoginThrottlerGuard', () => {
  it('[BE-MUT-120] tracks per IP and normalised login email', async () => {
    await expect(
      tracker({ ip: '1.2.3.4', body: { email: '  Bob@Example.COM ' } }),
    ).resolves.toBe('1.2.3.4:bob@example.com');
  });
  it('[BE-MUT-121] a missing or non-string email falls back to the IP alone', async () => {
    await expect(tracker({ ip: '1.2.3.4', body: {} })).resolves.toBe(
      '1.2.3.4:',
    );
    await expect(tracker({ ip: '1.2.3.4' })).resolves.toBe('1.2.3.4:');
    await expect(
      tracker({ ip: '1.2.3.4', body: { email: ['a@b.c'] } }),
    ).resolves.toBe('1.2.3.4:');
  });
  it('[BE-MUT-122] two emails behind one proxy IP get separate counters', async () => {
    const a = await tracker({ ip: '9.9.9.9', body: { email: 'a@x.io' } });
    const b = await tracker({ ip: '9.9.9.9', body: { email: 'b@x.io' } });
    expect(a).not.toBe(b);
  });
});
