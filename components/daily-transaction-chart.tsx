import type { Sale } from '@/lib/model';

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const formatHour = (hour: number) => hourFormat.format(new Date(2024, 0, 1, hour));

export function DailyTransactionChart({ sales }: { sales: Sale[] }) {
  const counts = hours.map(() => 0);
  let total = 0;
  for (const sale of sales) {
    const hour = new Date(sale.date).getHours();
    if (Number.isNaN(hour)) continue;
    counts[hour]++;
    total++;
  }
  if (!total) {
    return (
      <p className="inset muted">
        {sales.length ? 'No recorded transaction times.' : 'No transactions recorded for this day.'}
      </p>
    );
  }

  const peak = Math.max(...counts);
  const hourWidth = 700 / hours.length;
  const x = (hour: number) => 60 + hour * hourWidth;
  const y = (count: number) => 188 - (166 * count) / peak;
  const tickCount = Math.min(4, peak);
  const countTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((peak * i) / tickCount),
  );

  return (
    <>
      <div className="overflow-x-auto px-4 py-3">
        <svg
          className="block w-full min-w-[36rem] text-sm text-muted-foreground"
          viewBox="0 0 820 225"
          role="img"
          aria-label={`Transactions per hour in local time. ${hours
            .map((hour) => `${formatHour(hour)}, ${counts[hour]}`)
            .join('; ')}.`}
        >
          {countTicks.map((count) => (
            <g key={count}>
              <line x1={60} x2={760} y1={y(count)} y2={y(count)} stroke="var(--border)" />
              <text x={50} y={y(count)} dy="0.35em" textAnchor="end" fill="currentColor">
                {count}
              </text>
            </g>
          ))}
          {hours.filter((hour) => hour % 3 === 0).map((hour) => (
            <text key={hour} x={x(hour + 0.5)} y={212} textAnchor="middle" fill="currentColor">
              {formatHour(hour)}
            </text>
          ))}
          {hours.map((hour) => (
            <g key={hour}>
              <title>{`${formatHour(hour)}–${formatHour(hour + 1)} · ${counts[hour]} ${counts[hour] === 1 ? 'sale' : 'sales'}`}</title>
              <rect x={x(hour)} y={y(peak)} width={hourWidth} height={y(0) - y(peak)} fill="transparent" />
              <rect x={x(hour) + 3} y={y(counts[hour])} width={hourWidth - 6} height={y(0) - y(counts[hour])} fill="var(--chart-2)" />
            </g>
          ))}
        </svg>
      </div>
      {total < sales.length && (
        <p className="muted px-6 pb-4">Transactions without a recorded time are omitted.</p>
      )}
    </>
  );
}
