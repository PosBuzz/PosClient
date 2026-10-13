import { inflateSync } from 'node:zlib';

/** Read PDFKit's standard-font text runs for semantic assertions; currency fonts are checked at the real renderer boundary. */
export function pdfText(buffer: Buffer): string {
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  const source = buffer.toString('latin1');
  expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
  expect(source).toContain('/Type /Page');
  const text: string[] = [];
  for (const object of source.matchAll(/\d+ 0 obj\n([\s\S]*?)\nendobj/g)) {
    const body = object[1];
    const start = body.indexOf('stream\n');
    const length = body.match(/\/Length (\d+)/);
    if (start < 0 || !length) continue;
    const bytes = Buffer.from(
      body.slice(start + 7, start + 7 + Number(length[1])),
      'latin1',
    );
    const stream = body.includes('/FlateDecode')
      ? inflateSync(bytes).toString('latin1')
      : bytes.toString('latin1');
    if (!stream.includes('BT')) continue;
    for (const line of stream.split('\n')) {
      if (!line.includes('TJ') && !line.includes('Tj')) continue;
      text.push(
        [...line.matchAll(/<([a-f0-9]+)>/gi)]
          .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
          .join(''),
      );
    }
  }
  return text.join('\n');
}
