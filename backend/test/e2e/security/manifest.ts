import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import {
  DiscoveryService,
  MetadataScanner,
  ModulesContainer,
  Reflector,
} from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

export type RouteEntry = {
  method:
    | 'GET'
    | 'POST'
    | 'PATCH'
    | 'PUT'
    | 'DELETE'
    | 'OPTIONS'
    | 'HEAD'
    | 'ALL';
  path: string;
  controller: string;
  handler: string;
  guards: string[];
  permissions: string[];
};

const guardName = (guard: unknown): string =>
  typeof guard === 'function'
    ? guard.name
    : ((guard as object)?.constructor?.name ?? String(guard));

const joinPath = (...parts: unknown[]) => {
  const segments = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part): part is string => typeof part === 'string')
    .flatMap((part) => part.split('/'))
    .filter(Boolean);
  return '/api/v1' + (segments.length ? '/' + segments.join('/') : '');
};

/** Reads every controller handler and the metadata that decides who may call it (no HTTP). */
export function buildManifest(app: NestExpressApplication): RouteEntry[] {
  const discovery = new DiscoveryService(app.get(ModulesContainer));
  const scanner = new MetadataScanner();
  const reflector = new Reflector();
  const entries: RouteEntry[] = [];

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const prototype = Object.getPrototypeOf(instance);
    const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype);
    const classGuards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, metatype) ?? [];
    for (const handlerName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[handlerName];
      const methodValue = Reflect.getMetadata(METHOD_METADATA, handler);
      if (methodValue === undefined) continue;
      const methodGuards: unknown[] =
        Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
      const guards = [
        ...new Set([...classGuards, ...methodGuards].map(guardName)),
      ];
      // PermissionsGuard: the handler's list wins over the class's
      const permissions =
        reflector.get<string[]>('permissions', handler) ??
        reflector.get<string[]>('permissions', metatype) ??
        [];
      const methodPaths = Reflect.getMetadata(PATH_METADATA, handler);
      for (const methodPath of Array.isArray(methodPaths)
        ? methodPaths
        : [methodPaths]) {
        entries.push({
          method: RequestMethod[methodValue] as RouteEntry['method'],
          path: joinPath(controllerPath, methodPath),
          controller: metatype.name,
          handler: handlerName,
          guards,
          permissions: [...permissions].sort(),
        });
      }
    }
  }
  return entries.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.method.localeCompare(b.method) ||
      a.handler.localeCompare(b.handler),
  );
}

export const routeKey = (entry: Pick<RouteEntry, 'method' | 'path'>) =>
  `${entry.method} ${entry.path}`;

/** Routes the sweeps must never execute: they run a real database dump or restore. */
export const NEVER_EXECUTE = (entry: Pick<RouteEntry, 'path'>) =>
  /^\/api\/v1\/admin\/(backup|restore)$/.test(entry.path);
