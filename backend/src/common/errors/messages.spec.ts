import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as ts from 'typescript';

const SRC = join(__dirname, '..', '..');
const CLIENT =
  /^(BadRequest|NotFound|Forbidden|Conflict|Unauthorized)Exception$/;

interface ThrownMessage {
  site: string;
  kind: string;
  /** Static text with each ${...} replaced by {value}; null when the argument is dynamic. */
  text: string | null;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

function staticText(node: ts.Expression | undefined): string | null | '' {
  if (!node) return '';
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return (
      node.head.text +
      node.templateSpans.map((span) => `{value}${span.literal.text}`).join('')
    );
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.getText() === '+') {
    const left = staticText(node.left);
    const right = staticText(node.right);
    return left === null || right === null ? null : `${left}${right}`;
  }
  if (ts.isParenthesizedExpression(node)) return staticText(node.expression);
  return null;
}

function collect(): ThrownMessage[] {
  const found: ThrownMessage[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        CLIENT.test(node.expression.text)
      ) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        found.push({
          site: `${relative(SRC, file)}:${line}`,
          kind: node.expression.text,
          text: staticText(node.arguments?.[0]),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

const thrown = collect();
// DevelopmentOnlyGuard deliberately hides routes with a bare 404.
const HIDDEN_ROUTE = /development-only\.guard\.ts/;
const literal = thrown.filter(
  (item): item is ThrownMessage & { text: string } => item.text !== null,
);

describe('thrown client error messages', () => {
  it('[X-ERR-010] every thrown 4xx has a message', () => {
    const missing = thrown
      .filter((item) => item.text === '' && !HIDDEN_ROUTE.test(item.site))
      .map((item) => `${item.site} ${item.kind}`);
    expect(missing).toEqual([]);
    expect(thrown.length).toBeGreaterThan(100);
  });

  it('[X-ERR-011] no message exposes field paths, enum names, Prisma codes or placeholders', () => {
    const forbidden =
      /\b\w+\.\d+\.\w+\b|Enum\b|\bP20\d\d\b|\bundefined\b|\bnull\b|\[object Object\]/;
    const offenders = literal
      .filter((item) => forbidden.test(item.text))
      .map((item) => `${item.site}: ${item.text}`);
    expect(offenders).toEqual([]);
  });

  it('[X-ERR-011] every static message starts with a capital letter or a quoted label and stays within 200 characters', () => {
    const offenders = literal
      .filter((item) => item.text !== '')
      .filter(
        (item) => !/^[A-Z0-9{"'(]/.test(item.text) || item.text.length > 200,
      )
      .map((item) => `${item.site}: ${item.text}`);
    expect(offenders).toEqual([]);
  });

  it('[X-ERR-012] the full message list is reviewed in a snapshot', () => {
    const messages = [...new Set(literal.map((item) => item.text))]
      .filter((text) => text !== '')
      .sort();
    expect(messages).toMatchSnapshot();
  });
});
