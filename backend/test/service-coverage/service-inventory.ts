import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as ts from 'typescript';

export const ROOT = join(__dirname, '..', '..');
export interface ServiceMethod {
  service: string;
  method: string;
  file: string;
  line: number;
  throws: number;
  consumerId: boolean;
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
          // These two classes share a runtime name, but must never share a coverage claim.
          service:
            node.name.text === 'UsersService'
              ? relative(ROOT, file).startsWith('src/admin/')
                ? 'AdminUsersService'
                : 'ConsumerUsersService'
              : node.name.text,
          method,
          file: relative(ROOT, file),
          line:
            source.getLineAndCharacterOfPosition(member.getStart(source)).line +
            1,
          throws: [
            ...(member.body?.getText(source) ?? '').matchAll(
              /throw\s+new\s+\w*Exception\b/g,
            ),
          ].length,
          consumerId: member.parameters.some((parameter) =>
            /^(consumerId|consumer_id)$/.test(parameter.name.getText(source)),
          ),
        });
      }
    });
  }
  return found.sort((a, b) =>
    `${a.service}.${a.method}`.localeCompare(`${b.service}.${b.method}`),
  );
}

export interface TestClaim {
  title: string;
  file: string;
  tags: string[];
}

/** Parse actual test calls, including multiline it.each(...)(title, callback). */
export function claimsInSource(text: string, file: string): TestClaim[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const claims: TestClaim[] = [];
  const testCall = (node: ts.Expression): boolean => {
    if (ts.isIdentifier(node)) {
      return node.text === 'it' || node.text === 'test';
    }
    if (ts.isCallExpression(node)) return testCall(node.expression);
    if (ts.isPropertyAccessExpression(node)) {
      if (['skip', 'todo', 'failing', 'fails'].includes(node.name.text)) {
        return false;
      }
      return testCall(node.expression);
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && testCall(node.expression)) {
      const titleNode = node.arguments[0];
      if (
        titleNode &&
        (ts.isStringLiteralLike(titleNode) ||
          ts.isTemplateExpression(titleNode))
      ) {
        const title = ts.isStringLiteralLike(titleNode)
          ? titleNode.text
          : titleNode.getText(source);
        const tags = [...title.matchAll(/\{([A-Za-z]+\.[A-Za-z0-9_]+)\}/g)].map(
          (match) => match[1],
        );
        if (tags.length) claims.push({ title, file, tags });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return claims;
}

export function testClaims(): TestClaim[] {
  const files = [
    ...filesUnder(join(ROOT, 'src'), /\.spec\.ts$/),
    ...filesUnder(join(ROOT, 'prisma-client-exception'), /\.spec\.ts$/),
    ...filesUnder(join(ROOT, 'test'), /\.(int|e2e)-spec\.ts$/),
  ];
  return files.flatMap((file) =>
    claimsInSource(readFileSync(file, 'utf8'), relative(ROOT, file)),
  );
}

/** `{Service.method}` tags found in test titles, with the file that claims them. */
export function claimedTags(): Map<string, string[]> {
  const claims = new Map<string, string[]>();
  for (const test of testClaims()) {
    for (const tag of test.tags) {
      const list = claims.get(tag) ?? [];
      if (!list.includes(test.file)) list.push(test.file);
      claims.set(tag, list);
    }
  }
  return claims;
}
