import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportColumn, ImportRowError, ParsedRow } from '../import.types';
import { RowValidator } from './row-validator';

const CUSTOMER_TYPES = ['individual', 'business'] as const;

interface PreparedCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birthday?: Date;
  customer_type: string;
}

@Injectable()
export class CustomerImportService {
  constructor(private readonly prisma: PrismaService) {}

  readonly sheetName = 'Customers';

  readonly columns: ImportColumn[] = [
    {
      header: 'Name',
      required: true,
      hint: 'Customer name.',
      example: 'Rahim Uddin',
    },
    {
      header: 'Phone',
      required: true,
      hint: 'Unique across the whole system. A customer who already exists with this phone is reported as an error, not overwritten.',
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
      hint: `One of: ${CUSTOMER_TYPES.join(', ')}. Defaults to individual.`,
      example: 'individual',
    },
  ];

  /**
   * Validates every row against the sheet and the database. Returns the rows
   * ready to insert plus every problem found; the caller decides whether to
   * write.
   */
  async prepare(
    consumerId: number,
    rows: ParsedRow[],
  ): Promise<{ prepared: PreparedCustomer[]; errors: ImportRowError[] }> {
    const errors: ImportRowError[] = [];
    const prepared: PreparedCustomer[] = [];

    const phones = rows
      .map((row) => row.values['phone'])
      .filter((phone): phone is string => !!phone);

    const existing = phones.length
      ? await this.prisma.customer.findMany({
          where: { phone: { in: phones } },
          select: { phone: true },
        })
      : [];
    const takenPhones = new Set(existing.map((customer) => customer.phone));

    // Phone is globally unique, so duplicates inside the file fail just as hard
    // as duplicates against the database — catch them before the insert does.
    const seenInFile = new Map<string, number>();

    for (const row of rows) {
      const validator = new RowValidator(row);

      const name = validator.text('Name', { required: true, max: 191 });
      const phone = validator.text('Phone', { required: true, max: 32 });
      const email = validator.email('Email');
      const address = validator.text('Address', { max: 500 });
      const birthday = validator.date('Birthday');

      if (birthday && birthday.getTime() > Date.now()) {
        validator.add('Birthday', 'Birthday cannot be in the future');
      }
      const customerType =
        validator.choice('Customer Type', CUSTOMER_TYPES, {
          fallback: 'individual',
        }) ?? 'individual';

      if (phone) {
        if (takenPhones.has(phone)) {
          validator.add(
            'Phone',
            `A customer with phone ${phone} already exists`,
          );
        }

        const firstSeenOn = seenInFile.get(phone);
        if (firstSeenOn) {
          validator.add(
            'Phone',
            `Phone ${phone} is used again on row ${firstSeenOn} of this file`,
          );
        } else {
          seenInFile.set(phone, row.rowNumber);
        }
      }

      if (!validator.ok) {
        errors.push(...validator.problems);
        continue;
      }

      prepared.push({
        name: name!,
        phone: phone!,
        email,
        address,
        birthday,
        customer_type: customerType,
      });
    }

    return { prepared, errors };
  }

  async write(
    consumerId: number,
    prepared: PreparedCustomer[],
  ): Promise<Record<string, number>> {
    if (!prepared.length) return { customers: 0 };

    const created = await this.prisma.customer.createMany({
      data: prepared.map((customer) => ({
        ...customer,
        consumer_id: consumerId,
      })),
    });

    return { customers: created.count };
  }
}
