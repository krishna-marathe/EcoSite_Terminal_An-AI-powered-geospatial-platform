export function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Not reported';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
