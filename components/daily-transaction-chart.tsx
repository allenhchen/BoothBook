import type { Sale } from '@/lib/model';

const minute = 60_000;

export function DailyTransactionChart({ sales }: { sales: Sale[] }) {
  const counts = new Map<number, number>();
  for (const sale of sales) {
    const time = Date.parse(sale.date);
    if (Number.isFinite(time)) counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  const points: { time: number; total: number }[] = [];
  let total = 0;
  for (const [time, count] of [...counts].sort(([a], [b]) => a - b)) {
    total += count;
    points.push({ time, total });
  }
  const first = points[0]?.time;
  const last = points.at(-1)?.time;
  if (first === undefined || last === undefined) {
    return (
      <p className="inset muted">
        {sales.length ? 'No recorded transaction times.' : 'No transactions recorded for this day.'}
      </p>
    );
  }

  const start = first - 15 * minute;
  const end = last + 15 * minute;
  const x = (time: number) => 60 + (700 * (time - start)) / (end - start);
  const y = (count: number) => 188 - (166 * count) / total;
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(new Date(start).toDateString() !== new Date(end).toDateString()
      ? { month: 'short', day: 'numeric' }
      : {}),
  });
  const tickCount = Math.min(4, total);
  const countTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((total * i) / tickCount),
  );

  return (
    <>
      <div className="overflow-x-auto px-4 py-3">
        <svg
          className="block w-full min-w-[36rem] text-sm text-muted-foreground"
          viewBox="0 0 820 225"
          role="img"
          aria-label={`Cumulative transactions in local time. ${points
            .map((point) => `${timeFormat.format(point.time)}, ${point.total}`)
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
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const time = start + fraction * (end - start);
            return (
              <text key={fraction} x={x(time)} y={212} textAnchor="middle" fill="currentColor">
                {timeFormat.format(time)}
              </text>
            );
          })}
          <path
            d={`M 60 ${y(0)} ${points.map((point) => `H ${x(point.time)} V ${y(point.total)}`).join(' ')} H 760`}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth={3}
          />
          {points.map((point) => (
            <circle key={point.time} cx={x(point.time)} cy={y(point.total)} r={4} fill="var(--chart-2)">
              <title>{`${timeFormat.format(point.time)} · ${point.total} cumulative transactions`}</title>
            </circle>
          ))}
        </svg>
      </div>
      {total < sales.length && (
        <p className="muted px-6 pb-4">Transactions without a recorded time are omitted.</p>
      )}
    </>
  );
}
