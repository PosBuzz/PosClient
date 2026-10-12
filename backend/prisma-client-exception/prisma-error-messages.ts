import { HttpStatus } from '@nestjs/common';

// Turns Prisma error metadata into sentences a shop owner can act on. The raw
// Prisma message (model/field names, query fragments) is logged server-side only.

const words = (identifier: string) =>
  identifier
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();

const article = (noun: string) =>
  /^(user|unit)\b/.test(noun) ? 'a' : /^[aeiou]/.test(noun) ? 'an' : 'a';

// Internal model names that read badly to a shop owner
const MODEL_LABELS: Record<string, string> = {
  Consumer: 'business',
  InventoryBatch: 'stock batch',
  SuperAdmin: 'admin user',
};

/** `ProductVariant` → `product variant`; falls back to `record`. */
export const recordName = (modelName?: unknown) =>
  typeof modelName === 'string' && modelName
    ? (MODEL_LABELS[modelName] ?? words(modelName))
    : 'record';

const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  subdomain: 'subdomain',
  email: 'email address',
  phone: 'phone number',
};

/**
 * Fields a unique constraint covers, minus the tenant/foreign keys that only scope
 * it (`consumer_id`, `*_id`). Prisma reports them as a field list; anything else
 * (e.g. a raw constraint name) yields no fields and a generic sentence.
 */
export function uniqueFields(target: unknown): string[] {
  if (!Array.isArray(target)) return [];
  const fields = target.map(String);
  const meaningful = fields.filter(
    (field) => field !== 'consumer_id' && field !== 'id' && !/_id$/.test(field),
  );
  return meaningful.length ? meaningful : fields;
}

const fieldLabel = (field: string) =>
  FIELD_LABELS[field] ?? words(field.replace(/_id$/, ''));

export function describePrismaError(
  code: string,
  meta: Record<string, unknown> | undefined,
): { status: number; message: string } | null {
  const model = recordName(meta?.modelName);

  switch (code) {
    case 'P2002': {
      const fields = uniqueFields(meta?.target).map(fieldLabel);
      const what = fields.length
        ? `this ${fields.join(' and ')}`
        : 'these details';
      return {
        status: HttpStatus.CONFLICT,
        message: `${article(model) === 'an' ? 'An' : 'A'} ${model} with ${what} already exists.`,
      };
    }
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        message: `This ${model} is still used by other records, so it can't be changed or deleted. Remove or reassign those first.`,
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        message: `The ${model} you're looking for doesn't exist or has been removed.`,
      };
    case 'P2018':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Some of the items linked to this ${model} don't exist anymore. Refresh and try again.`,
      };
    default:
      return null;
  }
}
