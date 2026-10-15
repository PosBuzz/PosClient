import { errorsFor } from './validate-dto';
export type DtoCase = readonly [
  path: string,
  value: unknown,
  constraint: string,
];
export function dtoCases<T extends object>(
  cls: new () => T,
  baseline: object,
  prefix: number,
  cases: readonly DtoCase[],
) {
  for (const [index, [path, value, constraint]] of cases.entries()) {
    it(`[BE-DTO-${prefix + index}] rejects ${path}=${String(value)} (${constraint})`, async () => {
      const plain = structuredClone(baseline) as Record<string, unknown>;
      const parts = path.split('.');
      let target = plain;
      for (const part of parts.slice(0, -1)) {
        target = target[part] as Record<string, unknown>;
      }
      target[parts.at(-1)!] = value;
      expect(await errorsFor(cls, plain)).toContain(`${path}.${constraint}`);
    });
  }
}
