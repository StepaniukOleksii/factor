export function formatRecordCount(count: number): string {
  if (count === 0) return 'No records';
  if (count === 1) return '1 record';
  return `${count} records`;
}
