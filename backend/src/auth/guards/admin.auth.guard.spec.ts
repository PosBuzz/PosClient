import { ExecutionContext } from '@nestjs/common';
import * as passport from 'passport';
import { AdminAuthGuard } from './admin.auth.guard';

describe('AdminAuthGuard', () => {
  afterEach(() => passport.unuse('jwt-admin'));

  it('[BE-MUT-130] authenticates with the jwt-admin passport strategy and attaches the user', async () => {
    passport.use('jwt-admin', {
      name: 'jwt-admin',
      authenticate(this: { success(user: object): void }) {
        this.success({ id: 7 });
      },
    } as unknown as passport.Strategy);
    const request: Record<string, unknown> = {};
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;

    await expect(new AdminAuthGuard().canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 7 });
  });
});
