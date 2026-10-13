export const formatCurrency = (
  amount: number | string | null | undefined,
): string => {
  if (amount === null || amount === undefined) {
    return "N/A";
  }
  return `BDT ${Number(amount || 0).toFixed(2)}`;
};

/**
 * " (10%)" — a discount stated as a share of the price it was taken off.
 * Empty when there is no base to compare against, so callers can append it
 * unconditionally. Mirrors the discount rate printed on receipt PDFs.
 */
export const discountPercentSuffix = (
  amount: number | null | undefined,
  base: number | null | undefined,
): string => {
  const value = Number(amount) || 0;
  const gross = Number(base) || 0;
  if (value <= 0 || gross <= 0) return "";

  const pct = (value / gross) * 100;
  if (pct < 0.01) return "";

  return ` (${Math.round(pct * 100) / 100}%)`;
};

export const formatDate = (dateString: string | Date): string => {
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};
