import { BadRequestException, ValidationError } from '@nestjs/common';

// Request validation errors as one readable sentence for toasts, plus per-field
// details for forms. class-validator alone yields an array of strings such as
// "items.0.quantity must not be less than 1", which the UI can't show as-is.

const MAX_SHOWN = 3;

// Array properties whose entries read as "Item 2", "Payment 1", …
const ENTRY_LABELS: Record<string, string> = {
  items: 'Item',
  payments: 'Payment',
  exchanges: 'Exchange item',
  variants: 'Variant',
};

const words = (property: string) =>
  property
    .replace(/_id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export interface FieldError {
  field: string; // dotted path, e.g. "items.0.quantity"
  message: string; // readable, e.g. "Item 1: quantity must not be less than 1"
}

function collect(
  errors: ValidationError[],
  path: string[] = [],
  out: FieldError[] = [],
): FieldError[] {
  for (const error of errors) {
    const fieldPath = [...path, error.property];
    const constraint = primaryConstraint(error.constraints);
    if (constraint) {
      out.push({
        field: fieldPath.join('.'),
        message: describe(fieldPath, error.property, constraint),
      });
    }
    if (error.children?.length) collect(error.children, fieldPath, out);
  }
  return out;
}

// One message per field: "is missing / wrong type" explains more than "must not
// be less than 1" when both fail (e.g. the field was not sent at all).
const CONSTRAINT_PRIORITY = [
  'isDefined',
  'isNotEmpty',
  'isInt',
  'isNumber',
  'isString',
  'isBoolean',
  'isEnum',
  'isArray',
  'isDateString',
];

function primaryConstraint(constraints?: Record<string, string>) {
  if (!constraints) return undefined;
  const key =
    CONSTRAINT_PRIORITY.find((name) => name in constraints) ??
    Object.keys(constraints)[0];
  return key ? constraints[key] : undefined;
}

function describe(path: string[], property: string, constraint: string) {
  // Location prefix for nested entries: ["items","0","quantity"] → "Item 1: "
  const prefix: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const index = Number(path[i + 1]);
    if (ENTRY_LABELS[path[i]] && Number.isInteger(index)) {
      prefix.push(`${ENTRY_LABELS[path[i]]} ${index + 1}`);
      i++;
    }
  }
  // class-validator messages start with the raw property name; swap in words
  const sentence = constraint.startsWith(property)
    ? words(property) + constraint.slice(property.length)
    : constraint;
  return prefix.length
    ? `${prefix.join(', ')}: ${sentence}`
    : capitalize(sentence);
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const fieldErrors = collect(errors);
  const shown = fieldErrors.slice(0, MAX_SHOWN).map((e) => e.message);
  const more = fieldErrors.length - shown.length;
  const message =
    shown.join('; ') +
    (more > 0 ? ` (and ${more} more problem${more > 1 ? 's' : ''})` : '') +
    '.';

  return new BadRequestException({
    statusCode: 400,
    message: message === '.' ? 'The submitted data is invalid.' : message,
    error: 'Bad Request',
    errors: fieldErrors,
  });
}
