export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return 'N/A';
  }
  return `BDT ${Number(amount || 0).toFixed(2)}`;
};

export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};
