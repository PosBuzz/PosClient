import {
  desiredOrderEntries,
  desiredPartnerPaymentCents,
  diffEntries,
  fromCents,
  isLiveOnlineOrder,
  LedgerType,
  ORDER_TYPES,
  orderEntryNote,
  OrderLedgerInput,
  paymentStatusFor,
  toCents,
} from './ledger-rules';

const order = (over: Partial<OrderLedgerInput> = {}): OrderLedgerInput => ({
  delivery_partner_id: 4,
  online_order_status: 'DELIVERED',
  is_online_order: true,
  sale_type: 'sale',
  deleted_at: null,
  cod_amount: '500.00',
  delivery_charge: '60',
  cod_fee: 5,
  ...over,
});

describe('delivery partner ledger rules (unit)', () => {
  it('[BE-DP-001] money is handled in whole cents both ways', () => {
    expect(toCents('12.345')).toBe(1235);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(fromCents(1235)).toBe(12.35);
  });

  it('[BE-DP-002] only a live online sale with a partner takes part in the ledger', () => {
    expect(isLiveOnlineOrder(order())).toBe(true);
    expect(isLiveOnlineOrder(order({ delivery_partner_id: null }))).toBe(false);
    expect(isLiveOnlineOrder(order({ is_online_order: false }))).toBe(false);
    expect(isLiveOnlineOrder(order({ sale_type: 'quotation' }))).toBe(false);
    expect(isLiveOnlineOrder(order({ deleted_at: new Date() }))).toBe(false);
  });

  it('[BE-DP-003] a delivered order: the partner owes the cash, the shop owes the delivery charge and COD fee', () => {
    expect(desiredOrderEntries(order())).toEqual([
      { partner_id: 4, type: LedgerType.COD_COLLECTED, cents: 50000 },
      { partner_id: 4, type: LedgerType.DELIVERY_CHARGE, cents: -6000 },
      { partner_id: 4, type: LedgerType.COD_FEE, cents: -500 },
    ]);
  });

  it('[BE-DP-004] a returned order owes only the return charge; zero rows are left out', () => {
    expect(
      desiredOrderEntries(order({ online_order_status: 'RETURNED' })),
    ).toEqual([
      { partner_id: 4, type: LedgerType.RETURN_CHARGE, cents: -6000 },
    ]);
    expect(desiredOrderEntries(order({ cod_amount: 0, cod_fee: 0 }))).toEqual([
      { partner_id: 4, type: LedgerType.DELIVERY_CHARGE, cents: -6000 },
    ]);
    expect(
      desiredOrderEntries(
        order({ online_order_status: 'RETURNED', delivery_charge: 0 }),
      ),
    ).toEqual([]);
  });

  it.each([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY',
    'OUT_FOR_DELIVERY',
    'CANCELLED',
    null,
  ])('[BE-DP-005] an order that is %s owes nothing yet', (status) => {
    expect(desiredOrderEntries(order({ online_order_status: status }))).toEqual(
      [],
    );
    expect(
      desiredPartnerPaymentCents(order({ online_order_status: status })),
    ).toBe(0);
  });

  it('[BE-DP-006] the customer counts as paid by the partner only once the order is delivered', () => {
    expect(desiredPartnerPaymentCents(order())).toBe(50000);
    expect(
      desiredPartnerPaymentCents(order({ online_order_status: 'RETURNED' })),
    ).toBe(0);
    expect(desiredPartnerPaymentCents(order({ deleted_at: new Date() }))).toBe(
      0,
    );
    expect(
      desiredPartnerPaymentCents(order({ delivery_partner_id: null })),
    ).toBe(0);
  });

  it('[BE-DP-007] the diff posts only what changed, per partner and type, in a stable order', () => {
    const desired = desiredOrderEntries(order());
    expect(diffEntries([], desired)).toEqual([
      { partner_id: 4, type: 'COD_COLLECTED', cents: 50000 },
      { partner_id: 4, type: 'COD_FEE', cents: -500 },
      { partner_id: 4, type: 'DELIVERY_CHARGE', cents: -6000 },
    ]);
    expect(diffEntries(desired, desired)).toEqual([]);
    // Delivered -> pending reverses every row
    expect(diffEntries(desired, [])).toEqual([
      { partner_id: 4, type: 'COD_COLLECTED', cents: -50000 },
      { partner_id: 4, type: 'COD_FEE', cents: 500 },
      { partner_id: 4, type: 'DELIVERY_CHARGE', cents: 6000 },
    ]);
    // A corrected charge posts the difference only
    expect(
      diffEntries(desired, desiredOrderEntries(order({ delivery_charge: 80 }))),
    ).toEqual([{ partner_id: 4, type: 'DELIVERY_CHARGE', cents: -2000 }]);
  });

  it('[BE-DP-008] moving an order to another partner reverses it on the old one and posts it on the new one', () => {
    const before = desiredOrderEntries(order({ cod_fee: 0 }));
    const after = desiredOrderEntries(
      order({ cod_fee: 0, delivery_partner_id: 2 }),
    );
    expect(diffEntries(before, after)).toEqual([
      { partner_id: 2, type: 'COD_COLLECTED', cents: 50000 },
      { partner_id: 2, type: 'DELIVERY_CHARGE', cents: -6000 },
      { partner_id: 4, type: 'COD_COLLECTED', cents: -50000 },
      { partner_id: 4, type: 'DELIVERY_CHARGE', cents: 6000 },
    ]);
  });

  it('[BE-DP-009] existing rows of one key are summed before comparing', () => {
    expect(
      diffEntries(
        [
          { partner_id: 4, type: 'COD_COLLECTED', cents: 30000 },
          { partner_id: 4, type: 'COD_COLLECTED', cents: 20000 },
        ],
        [{ partner_id: 4, type: 'COD_COLLECTED', cents: 50000 }],
      ),
    ).toEqual([]);
  });

  it('[BE-DP-010] payment status follows the amounts like everywhere else', () => {
    expect(paymentStatusFor(0, 1000)).toBe('due');
    expect(paymentStatusFor(1, 1000)).toBe('partial');
    expect(paymentStatusFor(999, 1000)).toBe('partial');
    expect(paymentStatusFor(1000, 1000)).toBe('paid');
    expect(paymentStatusFor(1200, 1000)).toBe('paid');
    expect(paymentStatusFor(0, 0)).toBe('due');
  });

  it('[BE-DP-011] ledger notes name the order and say why a row corrects an earlier one', () => {
    const row = { partner_id: 4, type: 'COD_COLLECTED', cents: 100 };
    expect(orderEntryNote(row, 'S-1', order(), true)).toBe(
      'Cash collected for order #S-1',
    );
    expect(
      orderEntryNote(
        { ...row, type: 'RETURN_CHARGE' },
        'S-1',
        order({ online_order_status: 'PENDING' }),
        false,
      ),
    ).toBe('Return charge for order #S-1: corrected, order is pending');
    expect(
      orderEntryNote(row, 'S-1', order({ online_order_status: null }), false),
    ).toBe('Cash collected for order #S-1: corrected, order is pending');
    expect(
      orderEntryNote(
        { ...row, type: 'DELIVERY_CHARGE' },
        'S-1',
        order({ deleted_at: new Date() }),
        false,
      ),
    ).toBe('Delivery charge for order #S-1: reversed, order deleted');
    expect(
      orderEntryNote(
        { ...row, type: 'COD_FEE' },
        'S-1',
        order({ online_order_status: 'OUT_FOR_DELIVERY' }),
        false,
      ),
    ).toBe('COD fee for order #S-1: corrected, order is out for delivery');
    expect(
      orderEntryNote(
        { ...row, type: 'ODD' },
        'S-1',
        order({ online_order_status: 'WEIRD' }),
        false,
      ),
    ).toBe('ODD for order #S-1: corrected, order is WEIRD');
  });

  it('[BE-DP-012] a deleted, partner-less or offline order owes nothing even when delivered', () => {
    expect(desiredOrderEntries(order({ deleted_at: new Date() }))).toEqual([]);
    expect(desiredOrderEntries(order({ delivery_partner_id: null }))).toEqual(
      [],
    );
    expect(desiredOrderEntries(order({ is_online_order: false }))).toEqual([]);
    expect(desiredOrderEntries(order({ sale_type: 'quotation' }))).toEqual([]);
  });

  it('[BE-DP-013] the order rows are exactly the four per-order types; payouts and adjustments are not', () => {
    expect([...ORDER_TYPES].sort()).toEqual([
      'COD_COLLECTED',
      'COD_FEE',
      'DELIVERY_CHARGE',
      'RETURN_CHARGE',
    ]);
  });

  it.each([
    ['PENDING', 'pending'],
    ['CONFIRMED', 'confirmed'],
    ['PROCESSING', 'processing'],
    ['READY', 'ready'],
    ['OUT_FOR_DELIVERY', 'out for delivery'],
    ['DELIVERED', 'delivered'],
    ['CANCELLED', 'cancelled'],
    ['RETURNED', 'returned'],
  ])(
    '[BE-DP-014] a correction note names the status %s in words',
    (status, words) => {
      expect(
        orderEntryNote(
          { partner_id: 4, type: 'COD_FEE', cents: 1 },
          'S-2',
          order({ online_order_status: status }),
          false,
        ),
      ).toBe(`COD fee for order #S-2: corrected, order is ${words}`);
    },
  );
});
