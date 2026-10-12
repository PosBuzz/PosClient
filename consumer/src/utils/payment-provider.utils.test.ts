import { describe, expect, it } from "vitest";
import { PaymentMethod } from "../types/sale.types";
import { bankOptions } from "../types/banks.types";
import { mfsProviderOptions } from "../types/mfs.types";
import {
  PAYMENT_METHODS_REQUIRING_PROVIDER,
  paymentMethodRequiresProvider,
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
} from "./payment-provider.utils";
describe("payment providers", () => {
  it("[CO-PAYP-001] only CARD/BANK_TRANSFER/MFS require providers", () => {
    expect(PAYMENT_METHODS_REQUIRING_PROVIDER).toEqual([
      PaymentMethod.CARD,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.MFS,
    ]);
    for (const method of [...Object.values(PaymentMethod), undefined]) {
      expect(paymentMethodRequiresProvider(method)).toBe(
        method !== undefined &&
          [
            PaymentMethod.CARD,
            PaymentMethod.BANK_TRANSFER,
            PaymentMethod.MFS,
          ].includes(method),
      );
    }
  });
  it("[CO-PAYP-002] bank and MFS options retain complete labels/values", () => {
    for (const method of [PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER]) {
      expect(getPaymentProviderOptions(method)).toEqual(
        bankOptions.map((option) => ({
          label: option.label,
          value: String(option.value),
        })),
      );
    }
    expect(getPaymentProviderOptions(PaymentMethod.MFS)).toEqual(
      mfsProviderOptions.map((option) => ({
        label: option.label,
        value: String(option.value),
      })),
    );
    expect(getPaymentProviderOptions(PaymentMethod.CASH)).toEqual([]);
    expect(getPaymentProviderOptions()).toEqual([]);
  });
  it("[CO-PAYP-003] provider placeholders are specific", () => {
    expect(getPaymentProviderPlaceholder(PaymentMethod.CARD)).toBe(
      "Select bank",
    );
    expect(getPaymentProviderPlaceholder(PaymentMethod.BANK_TRANSFER)).toBe(
      "Select bank",
    );
    expect(getPaymentProviderPlaceholder(PaymentMethod.MFS)).toBe("Select MFS");
    expect(getPaymentProviderPlaceholder()).toBe("Select provider");
  });
});
