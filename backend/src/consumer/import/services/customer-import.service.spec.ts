import { CustomerImportService } from './customer-import.service';

const row = (rowNumber: number, values: Record<string, string>) => ({
  rowNumber,
  values,
});

function setup() {
  const customer = { findMany: jest.fn(), createMany: jest.fn() };
  customer.findMany.mockResolvedValue([]);
  return { customer, service: new CustomerImportService({ customer } as any) };
}

const good = (n: number, phone = `+88017000000${n}`) =>
  row(n, { name: `Customer ${n}`, phone });

describe('CustomerImportService (unit)', () => {
  afterEach(() => jest.useRealTimers());

  it('[BE-MUT-310] the sheet layout is pinned: name, required flags, hints and examples', () => {
    const { service } = setup();
    expect(service.sheetName).toBe('Customers');
    expect(service.columns).toEqual([
      {
        header: 'Name',
        required: true,
        hint: 'Customer name.',
        example: 'Rahim Uddin',
      },
      {
        header: 'Phone',
        required: true,
        hint: 'Unique within your shop. A customer who already exists with this phone is reported as an error, not overwritten.',
        example: '+8801700000000',
      },
      {
        header: 'Email',
        required: false,
        hint: 'Optional. Must look like name@example.com.',
        example: 'rahim@example.com',
      },
      {
        header: 'Address',
        required: false,
        hint: 'Optional. Shown on delivery slips and chalans.',
        example: 'House 12, Road 4, Banani, Dhaka',
      },
      {
        header: 'Birthday',
        required: false,
        hint: 'Optional date of birth, format 2026-12-31. Any time part is ignored.',
        example: '1994-03-18',
      },
      {
        header: 'Customer Type',
        required: false,
        hint: 'One of: individual, business. Defaults to individual.',
        example: 'individual',
      },
    ]);
  });

  it('[BE-MUT-311] a complete row is prepared with every field, the birthday as a Date and the type kept', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      row(2, {
        name: 'Rahim',
        phone: '+8801',
        email: 'r@x.io',
        address: 'Road 4',
        birthday: '1994-03-18',
        'customer type': 'Business',
      }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.prepared).toEqual([
      {
        name: 'Rahim',
        phone: '+8801',
        email: 'r@x.io',
        address: 'Road 4',
        birthday: new Date('1994-03-18'),
        customer_type: 'business',
      },
    ]);
  });

  it('[BE-MUT-312] only name and phone are required; the type defaults to individual', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [good(2)]);
    expect(result.errors).toEqual([]);
    expect(result.prepared[0]).toMatchObject({ customer_type: 'individual' });
    const missing = await service.prepare(4, [row(2, {})]);
    expect(missing.prepared).toEqual([]);
    expect(missing.errors).toEqual([
      { row: 2, column: 'Name', message: 'Name is required' },
      { row: 2, column: 'Phone', message: 'Phone is required' },
    ]);
  });

  it('[BE-MUT-313] field length limits are 191 for the name, 32 for the phone and 500 for the address', async () => {
    const { service } = setup();
    const ok = await service.prepare(4, [
      row(2, {
        name: 'n'.repeat(191),
        phone: 'p'.repeat(32),
        address: 'a'.repeat(500),
      }),
    ]);
    expect(ok.errors).toEqual([]);
    const tooLong = await service.prepare(4, [
      row(2, {
        name: 'n'.repeat(192),
        phone: 'p'.repeat(33),
        address: 'a'.repeat(501),
      }),
    ]);
    expect(tooLong.errors).toEqual([
      {
        row: 2,
        column: 'Name',
        message: 'Name must be 191 characters or fewer',
      },
      {
        row: 2,
        column: 'Phone',
        message: 'Phone must be 32 characters or fewer',
      },
      {
        row: 2,
        column: 'Address',
        message: 'Address must be 500 characters or fewer',
      },
    ]);
  });

  it('[BE-MUT-314] a malformed email, unknown type or unparseable birthday is reported on its column', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      row(3, {
        name: 'A',
        phone: '1',
        email: 'nope',
        birthday: 'yesterday-ish',
        'customer type': 'vip',
      }),
    ]);
    expect(result.prepared).toEqual([]);
    expect(result.errors.map((e) => [e.row, e.column])).toEqual([
      [3, 'Email'],
      [3, 'Birthday'],
      [3, 'Customer Type'],
    ]);
  });

  it('[BE-MUT-315] a birthday today passes, one in the future is rejected', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-10T12:00:00Z'));
    const { service } = setup();
    const earlier = await service.prepare(4, [
      row(2, { name: 'A', phone: '1', birthday: '2026-06-10' }),
    ]);
    expect(earlier.errors).toEqual([]);
    const exact = await service.prepare(4, [
      row(2, { name: 'A', phone: '1', birthday: '2026-06-10T12:00:00Z' }),
    ]);
    expect(exact.errors).toEqual([]);
    const future = await service.prepare(4, [
      row(2, { name: 'A', phone: '1', birthday: '2026-06-10T12:00:01Z' }),
    ]);
    expect(future.errors).toEqual([
      {
        row: 2,
        column: 'Birthday',
        message: 'Birthday cannot be in the future',
      },
    ]);
    const none = await service.prepare(4, [good(2)]);
    expect(none.errors).toEqual([]);
  });

  it('[BE-MUT-316] existing phones are looked up for this shop only and reported, without overwriting', async () => {
    const { customer, service } = setup();
    customer.findMany.mockResolvedValue([{ phone: '+8802' }]);
    const result = await service.prepare(4, [
      good(2, '+8801'),
      good(3, '+8802'),
      row(4, { name: 'No phone' }),
    ]);
    expect(customer.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 4, phone: { in: ['+8801', '+8802'] } },
      select: { phone: true },
    });
    expect(result.prepared.map((p) => p.phone)).toEqual(['+8801']);
    expect(result.errors).toEqual([
      {
        row: 3,
        column: 'Phone',
        message: 'A customer with phone +8802 already exists',
      },
      { row: 4, column: 'Phone', message: 'Phone is required' },
    ]);
  });

  it('[BE-MUT-317] no phones in the file means no database lookup', async () => {
    const { customer, service } = setup();
    await service.prepare(4, [row(2, { name: 'x' })]);
    expect(customer.findMany).not.toHaveBeenCalled();
  });

  it('[BE-MUT-318] a phone repeated inside the file is reported on the later row, pointing at the first', async () => {
    const { service } = setup();
    const result = await service.prepare(4, [
      good(2, '+8801'),
      good(5, '+8801'),
      good(9, '+8801'),
    ]);
    expect(result.prepared).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        row: 5,
        column: 'Phone',
        message: 'Phone +8801 is used again on row 2 of this file',
      },
      {
        row: 9,
        column: 'Phone',
        message: 'Phone +8801 is used again on row 2 of this file',
      },
    ]);
  });

  it('[BE-MUT-319] a phone that exists in the database and repeats in the file reports both problems', async () => {
    const { customer, service } = setup();
    customer.findMany.mockResolvedValue([{ phone: '+8801' }]);
    const result = await service.prepare(4, [
      good(2, '+8801'),
      good(3, '+8801'),
    ]);
    expect(result.errors.map((e) => [e.row, e.message])).toEqual([
      [2, 'A customer with phone +8801 already exists'],
      [3, 'A customer with phone +8801 already exists'],
      [3, 'Phone +8801 is used again on row 2 of this file'],
    ]);
  });

  it('[BE-MUT-320] write inserts every prepared customer for the consumer and reports the count', async () => {
    const { customer, service } = setup();
    customer.createMany.mockResolvedValue({ count: 2 });
    const prepared = [
      { name: 'A', phone: '1', customer_type: 'individual' },
      { name: 'B', phone: '2', customer_type: 'business' },
    ];
    await expect(service.write(4, prepared)).resolves.toEqual({ customers: 2 });
    expect(customer.createMany).toHaveBeenCalledWith({
      data: prepared.map((c) => ({ ...c, consumer_id: 4 })),
    });
    customer.createMany.mockClear();
    await expect(service.write(4, [])).resolves.toEqual({ customers: 0 });
    expect(customer.createMany).not.toHaveBeenCalled();
  });
});
