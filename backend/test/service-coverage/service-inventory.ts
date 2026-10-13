import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as ts from 'typescript';

export const ROOT = join(__dirname, '..', '..');
export interface ServiceMethod {
  service: string;
  method: string;
  file: string;
}

const LIFECYCLE = new Set([
  'onModuleInit',
  'onModuleDestroy',
  'onApplicationBootstrap',
  'onApplicationShutdown',
  'beforeApplicationShutdown',
]);

export function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') return [];
    if (statSync(path).isDirectory()) return filesUnder(path, pattern);
    return pattern.test(name) ? [path] : [];
  });
}

/** Every public method of every `*Service` class under src (TypeScript privacy is erased at runtime, so this reads the source). */
export function serviceInventory(): ServiceMethod[] {
  const found: ServiceMethod[] = [];
  for (const file of filesUnder(join(ROOT, 'src'), /\.service\.ts$/)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    source.forEachChild((node) => {
      if (
        !ts.isClassDeclaration(node) ||
        !node.name ||
        !/Service$/.test(node.name.text)
      ) {
        return;
      }
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const modifiers = ts.getModifiers(member) ?? [];
        if (
          modifiers.some(
            (modifier) =>
              modifier.kind === ts.SyntaxKind.PrivateKeyword ||
              modifier.kind === ts.SyntaxKind.ProtectedKeyword,
          )
        ) {
          continue;
        }
        const method = member.name.getText();
        if (LIFECYCLE.has(method)) continue;
        found.push({
          service: node.name.text,
          method,
          file: relative(ROOT, file),
        });
      }
    });
  }
  return found.sort((a, b) =>
    `${a.service}.${a.method}`.localeCompare(`${b.service}.${b.method}`),
  );
}

/** `{Service.method}` tags found in test titles, with the file that claims them. */
export function claimedTags(): Map<string, string[]> {
  const claims = new Map<string, string[]>();
  const files = [
    ...filesUnder(join(ROOT, 'src'), /\.spec\.ts$/),
    ...filesUnder(join(ROOT, 'prisma-client-exception'), /\.spec\.ts$/),
    ...filesUnder(join(ROOT, 'test'), /\.(int|e2e)-spec\.ts$/),
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(
      /\b(?:it|test)(?:\.each\([^)]*\))?\(\s*['"`][^'"`\n]*?\{([A-Za-z]+\.[A-Za-z0-9_]+)\}/g,
    )) {
      const list = claims.get(match[1]) ?? [];
      list.push(relative(ROOT, file));
      claims.set(match[1], list);
    }
    // Several tags can share one title; collect them all.
    for (const title of text.matchAll(
      /\b(?:it|test)\(\s*(['"`])((?:(?!\1)[^\n])*)\1/g,
    )) {
      for (const tag of title[2].matchAll(/\{([A-Za-z]+\.[A-Za-z0-9_]+)\}/g)) {
        const list = claims.get(tag[1]) ?? [];
        if (!list.includes(relative(ROOT, file))) {
          list.push(relative(ROOT, file));
        }
        claims.set(tag[1], list);
      }
    }
  }
  return claims;
}
