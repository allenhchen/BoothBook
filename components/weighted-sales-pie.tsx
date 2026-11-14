type Entry = { name: string; weighted: number; percentage: number };

export function WeightedSalesPie({ values, label }: { values: Entry[]; label: string }) {
  const entries = values.filter((entry) => entry.weighted > 0);
  if (!entries.length) return <p className="weighted-pie-empty">No weighted sales for this period.</p>;

  const total = entries.reduce((sum, entry) => sum + entry.weighted, 0);
  const slices = entries.map((entry, index) => {
    const start = -Math.PI / 2 + entries.slice(0, index).reduce((sum, value) => sum + value.weighted, 0) / total * Math.PI * 2;
    const end = start + (entry.weighted / total) * Math.PI * 2;
    const middle = (start + end) / 2;
    return { ...entry, start, end, middle, color: `hsl(${(index * 137.508 + 20) % 360} 65% 48%)` };
  });
  const left = slices.filter((slice) => Math.cos(slice.middle) < 0).sort((a, b) => Math.sin(a.middle) - Math.sin(b.middle));
  const right = slices.filter((slice) => Math.cos(slice.middle) >= 0).sort((a, b) => Math.sin(a.middle) - Math.sin(b.middle));
  const height = Math.max(360, Math.max(left.length, right.length) * 56 + 40);
  const cy = height / 2;
  const radius = 125;
  const point = (a: number, r = radius) => [320 + Math.cos(a) * r, cy + Math.sin(a) * r];

  return (
    <div className="weighted-pie-scroll">
      <svg className="weighted-pie" viewBox={`0 0 640 ${height}`} role="img" aria-label={`Weighted sales by ${label.toLowerCase()}: ${entries.map((entry) => `${entry.name} ${entry.percentage.toFixed(1)}%`).join(', ')}`}>
        {slices.map((slice) => (
          <g key={slice.name}>
            {slices.length === 1 ? (
              <circle cx={320} cy={cy} r={radius} fill={slice.color} />
            ) : (
              <path d={`M 320 ${cy} L ${point(slice.start).join(' ')} A ${radius} ${radius} 0 ${slice.end - slice.start > Math.PI ? 1 : 0} 1 ${point(slice.end).join(' ')} Z`} fill={slice.color} stroke="var(--background)" strokeWidth={2} />
            )}
            <title>{slice.name}: {slice.percentage.toFixed(1)}% ({slice.weighted.toLocaleString(undefined, { maximumFractionDigits: 3 })} weighted sales)</title>
          </g>
        ))}
        {[left, right].map((side, sideIndex) => side.map((slice, index) => {
          const y = cy + (index - (side.length - 1) / 2) * 56;
          const isLeft = sideIndex === 0;
          return (
            <g key={slice.name}>
              <polyline points={`${point(slice.middle, radius - 2).join(',')} ${isLeft ? 180 : 460},${y} ${isLeft ? 166 : 474},${y}`} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.5} />
              <foreignObject x={isLeft ? 4 : 482} y={y - 25} width={154} height={50}>
                <div className={`weighted-pie-label${isLeft ? ' weighted-pie-label-left' : ''}`} title={slice.name}>
                  <span>{slice.name}</span>
                  <strong>{slice.percentage.toFixed(1)}%</strong>
                </div>
              </foreignObject>
            </g>
          );
        }))}
      </svg>
    </div>
  );
}
