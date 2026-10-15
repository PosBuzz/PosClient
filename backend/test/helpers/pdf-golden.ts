import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PdfCall } from './pdf-recorder';

/**
 * Compares a recorded PDF drawing log with a reviewed golden file (one JSON call per line, so a
 * layout change is a readable diff). `UPDATE_PDF_GOLDEN=1` rewrites the entry after an intended change.
 */
export function expectPdfGolden(
  file: string,
  name: string,
  document: { options?: unknown; calls: PdfCall[] },
) {
  const lines = [
    `options ${JSON.stringify(document.options ?? null)}`,
    ...document.calls.map((call) => JSON.stringify(call)),
  ];
  let golden: Record<string, string[]> = {};
  try {
    golden = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // nothing recorded yet
  }
  if (process.env.UPDATE_PDF_GOLDEN === '1') {
    golden[name] = lines;
    mkdirSync(dirname(file), { recursive: true });
    const body = Object.entries(golden)
      .map(
        ([key, value]) =>
          ` ${JSON.stringify(key)}: [\n${value.map((line) => `  ${JSON.stringify(line)}`).join(',\n')}\n ]`,
      )
      .join(',\n');
    writeFileSync(file, `{\n${body}\n}\n`);
    return;
  }
  expect(lines).toEqual(golden[name]);
}
