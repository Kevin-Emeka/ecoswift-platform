export function formatMoney(amount: string | number, currencyCode: string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode}`;
  }
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));
}
