// amount-in-words.ts

const ONES = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', rest ? below100(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** Whole number in the South Asian system (thousand, lakh, crore). */
function wholeInWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  let rest = n;
  const crore = Math.floor(rest / 10000000);
  rest %= 10000000;
  const lakh = Math.floor(rest / 100000);
  rest %= 100000;
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (crore) parts.push(wholeInWords(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** "One Thousand Two Hundred Taka and Fifty Paisa Only" (lakh/crore grouping). */
export function amountInWords(
  amount: number,
  major = 'Taka',
  minor = 'Paisa',
): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  const sign = amount < 0 && cents > 0 ? 'Minus ' : '';
  let text = `${sign}${wholeInWords(whole)} ${major}`;
  if (fraction) text += ` and ${below100(fraction)} ${minor}`;
  return `${text} Only`;
}
