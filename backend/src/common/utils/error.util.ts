/**
 * Safe accessors for caught values.
 *
 * `catch (error)` hands back `any`/`unknown` — anything can be thrown, not just
 * an Error — so reaching straight for `.stack` or `.message` is unsound. These
 * narrow first and fall back to something loggable.
 */

export function errorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
