import { bankOptions } from "../types/banks.types";
import { mfsProviderOptions } from "../types/mfs.types";
import { PaymentMethod } from "../types/sale.types";

type PaymentProviderOption = {
  label: string;
  value: string;
};

// Payment methods that require an additional provider (e.g., specific bank or MFS) to be selected.
export const PAYMENT_METHODS_REQUIRING_PROVIDER: PaymentMethod[] = [
  PaymentMethod.CARD,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.MFS,
];

// Checks whether the given payment method requires a provider selection.
export const paymentMethodRequiresProvider = (
  paymentMethod?: PaymentMethod,
) => {
  if (!paymentMethod) {
    return false;
  }

  return PAYMENT_METHODS_REQUIRING_PROVIDER.includes(paymentMethod);
};

// Returns the appropriate dropdown options (banks or MFS providers) based on the payment method.
export const getPaymentProviderOptions = (paymentMethod?: PaymentMethod) => {
  if (
    paymentMethod === PaymentMethod.CARD ||
    paymentMethod === PaymentMethod.BANK_TRANSFER
  ) {
    return bankOptions.map((option) => ({
      label: option.label,
      value: String(option.value),
    })) as PaymentProviderOption[];
  }

  if (paymentMethod === PaymentMethod.MFS) {
    return mfsProviderOptions.map((option) => ({
      label: option.label,
      value: String(option.value),
    })) as PaymentProviderOption[];
  }

  return [] as PaymentProviderOption[];
};

// Returns the appropriate placeholder text for the provider dropdown based on the payment method.
export const getPaymentProviderPlaceholder = (
  paymentMethod?: PaymentMethod,
) => {
  if (
    paymentMethod === PaymentMethod.CARD ||
    paymentMethod === PaymentMethod.BANK_TRANSFER
  ) {
    return "Select bank";
  }

  if (paymentMethod === PaymentMethod.MFS) {
    return "Select MFS";
  }

  return "Select provider";
};
