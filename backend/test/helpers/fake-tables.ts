/**
 * A tiny in-memory stand-in for the Prisma delegates a service touches, so multi-step import and
 * sync logic can be run end to end without a database. It understands exactly what those services
 * use: equality filters, `in`, OR, relation filters, compound-unique wrappers, `include` for a few
 * relations, and auto-increment ids.
 */
type Row = Record<string, any>;
type Where = Record<string, any>;

export class FakeTable {
  rows: Row[] = [];
  private nextId: number;
  constructor(
    private readonly name: string,
    _world: Record<string, FakeTable>,
    private readonly relations: Record<
      string,
      (row: Row) => Row | undefined
    > = {},
    private readonly includes: Record<string, (row: Row) => unknown> = {},
    firstId = 1000,
  ) {
    this.nextId = firstId;
  }

  seed(...rows: Row[]) {
    this.rows.push(...rows.map((row) => ({ ...row })));
    return this;
  }

  matches(row: Row | undefined, where: Where | undefined): boolean {
    if (!where) return true;
    if (!row) return false;
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') {
        return (value as Where[]).some((sub) => this.matches(row, sub));
      }
      if (key in this.relations) {
        return this.matches(this.relations[key](row), value);
      }
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('in' in value) return (value.in as unknown[]).includes(row[key]);
        if ('not' in value) return row[key] !== value.not;
        // compound-unique wrapper such as consumer_id_name: { consumer_id, name }
        return this.matches(row, value);
      }
      return row[key] === value;
    });
  }

  private shape(row: Row, args: { include?: Record<string, any> } = {}) {
    const out = { ...row };
    for (const key of Object.keys(args.include ?? {})) {
      if (this.includes[key]) out[key] = this.includes[key](row);
    }
    return out;
  }

  private find(where: Where | undefined) {
    return this.rows.filter((row) => this.matches(row, where));
  }

  findMany = jest.fn(async (args: any = {}) =>
    this.find(args.where)
      .sort((a, b) => (args.orderBy?.id === 'asc' ? a.id - b.id : 0))
      .map((row) => this.shape(row, args)),
  );
  findFirst = jest.fn(async (args: any = {}) => {
    const row = this.find(args.where)[0];
    return row ? this.shape(row, args) : null;
  });
  findUnique = jest.fn(async (args: any = {}) => {
    const row = this.find(args.where)[0];
    return row ? this.shape(row, args) : null;
  });
  findUniqueOrThrow = jest.fn(async (args: any = {}) => {
    const row = this.find(args.where)[0];
    if (!row) throw new Error(`${this.name} not found`);
    return this.shape(row, args);
  });
  count = jest.fn(async (args: any = {}) => this.find(args.where).length);
  create = jest.fn(async ({ data }: any) => {
    const row = { id: this.nextId++, ...data };
    this.rows.push(row);
    return { ...row };
  });
  update = jest.fn(async ({ where, data }: any) => {
    const row = this.find(where)[0];
    if (!row) throw new Error(`${this.name} to update not found`);
    Object.assign(row, data);
    return { ...row };
  });
  upsert = jest.fn(async ({ where, create, update }: any) => {
    const row = this.find(where)[0];
    if (row) {
      Object.assign(row, update);
      return { ...row };
    }
    const created = { id: this.nextId++, ...create };
    this.rows.push(created);
    return { ...created };
  });
}
