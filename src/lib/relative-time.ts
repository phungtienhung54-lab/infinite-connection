export function hoursSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
}

export function formatRelativeHours(hours: number): string {
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "昨天" : `${days}天前`;
}
