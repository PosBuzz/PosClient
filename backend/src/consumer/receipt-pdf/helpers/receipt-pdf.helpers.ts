// receipt-pdf.helpers.ts

export function deepMerge(target: any, source: any): any {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      source[key] !== undefined &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = deepMerge(target[key] ?? {}, source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

export function normalizeLineBreaks(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export function humanPaymentMethod(m: string): string {
  const map: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    CHEQUE: 'Cheque',
    BANK_TRANSFER: 'Bank Transfer',
    MOBILE_MONEY: 'Mobile Money',
    MFS: 'MFS',
    CREDIT: 'Credit',
    EXCHANGE: 'Exchange',
  };
  return map[m] ?? m;
}

export function humanPaymentType(t: string): string {
  const special: Record<string, string> = {
    BKASH: 'bKash',
    NAGAD: 'Nagad',
    ROCKET: 'Rocket',
    MYCASH: 'MyCash',
    UPAY: 'Upay',
    OK_WALLET: 'OK Wallet',
    TELECASH: 'TeleCash',
    ISLAMIC_WALLET: 'Islamic Wallet',
    MEGHNA_PAY: 'Meghna Pay',
    FIRSTCASH: 'FirstCash',
    ISLAMI_BANK_MCASH: 'Islami Bank mCash',
    TRUST_AXIATA_PAY_TAP: 'Trust Axiata Pay Tap',
    RUPALI_BANK: 'Rupali Bank',
  };
  if (special[t]) return special[t];
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}