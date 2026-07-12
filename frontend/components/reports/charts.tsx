"use client";

/** Pure-SVG chart primitives for Reports v2 (no chart library). */

const PALETTE = [
  "#0075de",
  "#2a9d99",
  "#dd5b00",
  "#7c3aed",
  "#ff64c8",
  "#1aae39",
  "#62aef0",
  "#d44c47",
];

export function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Slice = { label: string; value: number; color: string };

function toSlices(data: Record<string, number> | { label: string; value: number }[]): Slice[] {
  if (Array.isArray(data)) {
    return data.map((d, i) => ({
      label: d.label,
      value: d.value,
      color: PALETTE[i % PALETTE.length]!,
    }));
  }
  return Object.entries(data).map(([label, value], i) => ({
    label: humanize(label),
    value,
    color: PALETTE[i % PALETTE.length]!,
  }));
}

/** Donut / pie chart for status breakdowns. */
export function DonutChart({
  data,
  size = 180,
}: {
  data: Record<string, number> | { label: string; value: number }[];
  size?: number;
}) {
  const slices = toSlices(data).filter((s) => s.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0 || slices.length === 0) {
    return <p className="text-ink-muted text-sm">No data yet.</p>;
  }

  const r = size / 2;
  const inner = r * 0.58;
  const cx = r;
  const cy = r;

  const cumValues = slices.map((_, i) =>
    slices.slice(0, i).reduce((sum, s) => sum + s.value, 0),
  );
  const arcs = slices.map((s, i) => {
    const start = -Math.PI / 2 + (cumValues[i]! / total) * Math.PI * 2;
    const sweep = (s.value / total) * Math.PI * 2;
    const end = start + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const ix1 = cx + inner * Math.cos(end);
    const iy1 = cy + inner * Math.sin(end);
    const ix2 = cx + inner * Math.cos(start);
    const iy2 = cy + inner * Math.sin(start);
    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");
    return { ...s, d };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {arcs.map((a) => (
          <path key={a.label} d={a.d} fill={a.color} className="transition-opacity hover:opacity-80">
            <title>
              {a.label}: {a.value}
            </title>
          </path>
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-ink text-lg font-bold"
          style={{ fontSize: 18 }}
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className="fill-ink-muted"
          style={{ fontSize: 11 }}
        >
          total
        </text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {arcs.map((a) => (
          <li key={a.label} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
            <span className="text-ink min-w-0 flex-1 truncate">{a.label}</span>
            <span className="text-ink-muted tabular-nums">{a.value}</span>
            <span className="text-ink-faint w-10 text-right text-xs tabular-nums">
              {Math.round((a.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical bar chart for category / department counts. */
export function VerticalBarChart({
  data,
  height = 160,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="text-ink-muted text-sm">No data yet.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {data.map((d, i) => {
          const pct = Math.max(4, Math.round((d.value / max) * 100));
          return (
            <div
              key={d.label}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${d.label}: ${d.value}`}
            >
              <span className="text-ink-muted text-[10px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                {d.value}
              </span>
              <div
                className="w-full max-w-10 rounded-t-md transition-all"
                style={{
                  height: `${pct}%`,
                  background: PALETTE[i % PALETTE.length],
                  minHeight: 4,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 sm:gap-2">
        {data.map((d) => (
          <span
            key={d.label}
            className="text-ink-faint min-w-0 flex-1 truncate text-center text-[10px]"
            title={d.label}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Area chart for hourly booking heatmap. */
export function AreaChart({
  data,
  height = 140,
}: {
  data: { hour: number; count: number }[];
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="text-ink-muted text-sm">No booking data yet.</p>;
  }

  const width = 600;
  const padX = 8;
  const padY = 12;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(1, n - 1)) * (width - padX * 2);
    const y = padY + (1 - d.count / max) * (height - padY * 2);
    return { x, y, ...d };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1]!.x} ${height - padY} L ${points[0]!.x} ${height - padY} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        style={{ height }}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0075de" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0075de" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#0075de" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <circle key={p.hour} cx={p.x} cy={p.y} r={2.5} fill="#0075de">
            <title>
              {p.hour}:00 — {p.count} bookings
            </title>
          </circle>
        ))}
      </svg>
      <div className="text-ink-faint mt-1 flex justify-between text-[10px] tabular-nums">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
