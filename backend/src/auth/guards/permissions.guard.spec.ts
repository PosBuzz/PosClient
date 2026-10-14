import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function setup(
  handlerPerms: string[] | undefined,
  classPerms: string[] | undefined,
  userPerms: string[] | undefined | null,
  user: object | null = { permissions: userPerms },
) {
  const handler = () => undefined;
  class Ctl {}
  const reflector = {
    get: jest.fn((key: string, target: unknown) => {
      expect(key).toBe('permissions');
      return target === handler ? handlerPerms : classPerms;
    }),
  } as unknown as Reflector;
  const context = {
    getHandler: () => handler,
    getClass: () => Ctl,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new PermissionsGuard(reflector), context, reflector };
}

describe('PermissionsGuard', () => {
  it('[BE-MUT-110] a route with no permission metadata is open', () => {
    const { guard, context } = setup(undefined, undefined, []);
    expect(guard.canActivate(context)).toBe(true);
  });
  it('[BE-MUT-111] an empty permission list is open, even for a user without permissions', () => {
    const { guard, context } = setup([], undefined, undefined, null);
    expect(guard.canActivate(context)).toBe(true);
  });
  it('[BE-MUT-112] handler metadata wins; class metadata is the fallback', () => {
    const handlerOnly = setup(['a'], ['b'], ['a']);
    expect(handlerOnly.guard.canActivate(handlerOnly.context)).toBe(true);
    const classOnly = setup(undefined, ['b'], ['b']);
    expect(classOnly.guard.canActivate(classOnly.context)).toBe(true);
    const classDenied = setup(undefined, ['b'], ['a']);
    expect(classDenied.guard.canActivate(classDenied.context)).toBe(false);
    const handlerDenied = setup(['a'], ['b'], ['b']);
    expect(handlerDenied.guard.canActivate(handlerDenied.context)).toBe(false);
  });
  it('[BE-MUT-113] every required permission is needed, not just one', () => {
    const all = setup(['a', 'b'], undefined, ['b', 'a', 'c']);
    expect(all.guard.canActivate(all.context)).toBe(true);
    const some = setup(['a', 'b'], undefined, ['a']);
    expect(some.guard.canActivate(some.context)).toBe(false);
  });
  it('[BE-MUT-114] a missing user or missing permission list is denied, not an error', () => {
    const noUser = setup(['a'], undefined, undefined, null);
    expect(noUser.guard.canActivate(noUser.context)).toBe(false);
    const noList = setup(['a'], undefined, undefined, {});
    expect(noList.guard.canActivate(noList.context)).toBe(false);
  });
});
