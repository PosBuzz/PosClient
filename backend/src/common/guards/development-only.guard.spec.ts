import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { DevelopmentOnlyGuard } from './development-only.guard';

const guardFor = (nodeEnv: string) =>
  new DevelopmentOnlyGuard({ nodeEnv } as unknown as ConfigService);

describe('DevelopmentOnlyGuard', () => {
  it('[BE-MUT-100] allows the route only when NODE_ENV is exactly development', () => {
    expect(guardFor('development').canActivate()).toBe(true);
  });
  it.each(['production', 'test', 'staging', 'Development', ''])(
    '[BE-MUT-101] hides the route with a plain 404 when NODE_ENV is %p',
    (env) => {
      const guard = guardFor(env);
      expect(() => guard.canActivate()).toThrow(NotFoundException);
      expect(() => guard.canActivate()).toThrow('Not Found');
    },
  );
});
