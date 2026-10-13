import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import rawAllowlist from "./error-handlers.allowlist.json";

const allowlist: Array<{ file: string; reason: string }> = rawAllowlist;

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "test" || name === "__tests__" || name === "__contracts__"
        ? []
        : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

function inErrorContext(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isCatchClause(parent)) return true;
    if (
      ts.isPropertyAssignment(parent) &&
      parent.name.getText() === "onError"
    ) {
      return true;
    }
  }
  return false;
}

/** Toasts inside catch/onError that do not go through getErrorMessage. */
function hiddenMessages(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        /(?:messageApi\??\.|message\.|notification\.)error$/.test(
          node.expression.getText(),
        )
      ) {
        const argument = node.arguments[0]?.getText() ?? "";
        if (inErrorContext(node) && !argument.includes("getErrorMessage")) {
          const line =
            source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          found.push(`${relative(SRC, file)}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

describe("error handlers", () => {
  it("[CO-ERR-010] every catch/onError toast uses getErrorMessage (or is allowlisted)", () => {
    const allowed = new Set(allowlist.map((entry) => entry.file));
    const unexpected = hiddenMessages().filter(
      (location) => !allowed.has(location.split(":")[0]),
    );
    expect(unexpected).toEqual([]);
  });

  it("[CO-ERR-011] every allowlist entry has a reason and still needs its exception", () => {
    const offenders = new Set(
      hiddenMessages().map((location) => location.split(":")[0]),
    );
    for (const entry of allowlist) {
      expect(entry.reason.length).toBeGreaterThan(10);
      expect(
        offenders.has(entry.file),
        `${entry.file} no longer needs its allowlist entry`,
      ).toBe(true);
    }
  });
});
