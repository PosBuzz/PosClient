import { Prisma } from '@prisma/client';

/**
 * Serializes "read the latest number, insert the next one" per tenant and
 * document kind for the rest of the current transaction. Without it, concurrent
 * requests read the same latest number and one of them fails the
 * (number, consumer_id) unique constraint. Released automatically on commit or
 * rollback.
 */
export async function lockDocumentNumbering(
  tx: Prisma.TransactionClient,
  kind: 'sale' | 'return',
  consumerId: number,
): Promise<void> {
  const key = `${kind}-number:${consumerId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
