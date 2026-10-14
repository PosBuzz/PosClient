import { HttpException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Most services wrap their bodies as: client errors (HttpException, readable Prisma errors) pass
 * through untouched, anything else is logged with its stack and replaced by a pinned generic 500.
 * This pins all three behaviours for one method.
 */
export async function expectGenericWrapping(options: {
  /** Makes the method fail inside its try block with the supplied error and runs it. */
  run: (failure: unknown) => Promise<unknown>;
  message: string;
  /** Substring(s) the logged line must contain, e.g. ids that make the log useful. */
  logged: string[];
  /** Also assert a thrown NotFoundException is returned untouched (for methods that rethrow it). */
  notFoundPassesThrough?: boolean;
}) {
  const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  try {
    const crash = new Error('db exploded');
    const wrapped = await options.run(crash).catch((e: unknown) => e);
    expect(wrapped).toBeInstanceOf(HttpException);
    expect((wrapped as HttpException).getStatus()).toBe(500);
    expect((wrapped as HttpException).message).toBe(options.message);
    expect(log).toHaveBeenCalledTimes(1);
    const [line, stack] = log.mock.calls[0] as [string, string];
    for (const part of options.logged) expect(line).toContain(part);
    expect(stack).toBe(crash.stack);

    log.mockClear();
    const http = new HttpException('already readable', 409);
    await expect(options.run(http)).rejects.toBe(http);
    const prismaDuplicate = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['name'] },
    });
    await expect(options.run(prismaDuplicate)).rejects.toBe(prismaDuplicate);
    if (options.notFoundPassesThrough) {
      const nf = new NotFoundException('gone');
      await expect(options.run(nf)).rejects.toBe(nf);
    }
    expect(log).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
}
