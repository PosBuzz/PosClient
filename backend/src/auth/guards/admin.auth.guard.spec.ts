import { ExecutionContext } from '@nestjs/common';
import { AdminAuthGuard } from './admin.auth.guard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const passport = require('passport');

describe('AdminAuthGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('[BE-MUT-130] authenticates with the jwt-admin passport strategy only and attaches the user', async () => {
    const authenticate = jest
      .spyOn(passport, 'authenticate')
      .mockImplementation(
        ((
            _strategy: unknown,
            _options: unknown,
            callback: (err: unknown, user: object) => void,
          ) =>
          () =>
            callback(null, { id: 7 })) as never,
      );
    const request: Record<string, unknown> = {};
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;

    await expect(new AdminAuthGuard().canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(authenticate.mock.calls[0][0]).toBe('jwt-admin');
    expect(request.user).toEqual({ id: 7 });
  });
});
