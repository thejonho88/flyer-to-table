/**
 * Formats a plan's `weekOf` (ISO Monday, e.g. "2026-07-20") as a human range
 * like "Week of Jul 20 – 26, 2026".
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatWeekOf(weekOfIso: string): string {
  const start = new Date(`${weekOfIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 'This week';
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startMonth = MONTHS[start.getMonth()];
  const endMonth = MONTHS[end.getMonth()];
  const year = end.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `Week of ${startMonth} ${start.getDate()} – ${end.getDate()}, ${year}`;
  }
  return `Week of ${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}
