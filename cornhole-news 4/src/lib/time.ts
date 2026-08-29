export function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let value = seconds;
  for (const [amount, unit] of units) {
    if (value < amount) {
      const rounded = Math.floor(value);
      return `${rounded} ${unit}${rounded === 1 ? "" : "s"} ago`;
    }
    value = value / amount;
  }
  return "just now";
}
