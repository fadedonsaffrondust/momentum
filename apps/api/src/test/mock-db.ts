import { vi } from 'vitest';

export function createMockDb() {
  const results: unknown[] = [];

  function createChain(): any {
    const chain: any = new Proxy(() => {}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            const result = results.shift();
            if (result instanceof Error) reject(result);
            else resolve(result);
          };
        }
        return (..._args: unknown[]) => chain;
      },
      apply() {
        return chain;
      },
    });
    return chain;
  }

  const db: any = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    // Mocked transaction: invokes the callback with the same mockDb so
    // existing tests work unchanged. Real Postgres rollback semantics are
    // a property of the driver, not our route code — they're verified
    // out-of-band against a real DB. This mock only proves that the route
    // *enters* a transaction and surfaces errors thrown inside.
    transaction: vi.fn(async (cb: (tx: typeof db) => unknown) => cb(db)),
    _results: results,
    _pushResult(value: unknown) {
      results.push(value);
    },
    _pushResults(...values: unknown[]) {
      results.push(...values);
    },
  };

  return db;
}

export type MockDb = ReturnType<typeof createMockDb>;
