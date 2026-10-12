const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
export const FIXED_INSTANT = '2026-03-14T12:00:00.000Z';
// Arrays whose order the API does not guarantee with an orderBy: sort them by id before comparing
const UNORDERED = new Set([
  'items',
  'payments',
  'batches',
  'inventory_items',
  'variants',
  'return_items',
  'exchanges',
  'products',
  'branches',
]);

/**
 * Makes a response comparable between runs while keeping every key and every value type, because
 * the consumer renders these files as real API data. Ids stay real numbers. Prisma sets
 * created_at/updated_at itself, so full ISO datetimes collapse to one fixed instant. Decimals stay strings.
 */
export function normalize(value: unknown, key = ''): unknown {
  if (typeof value === 'string' && ISO.test(value)) return FIXED_INSTANT;
  if (Array.isArray(value)) {
    const rows = value.map((item) => normalize(item));
    const allHaveIds = rows.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof (row as { id?: unknown }).id === 'number',
    );
    return UNORDERED.has(key) && allHaveIds
      ? [...rows].sort(
          (a, b) => (a as { id: number }).id - (b as { id: number }).id,
        )
      : rows;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v, k)]),
    );
  }
  return value;
}
