import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

export interface Point {
  key: string;
  /** Axis label (short). */
  label: string;
  /** undefined = no data (gap in a line, no bar). */
  value?: number;
  /** Tooltip content. */
  tip: ReactNode;
}

const HEIGHT = 170;
const M = { top: 16, right: 8, bottom: 26, left: 34 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round up to 1, 2 or 5 × 10^k so gridlines fall on friendly numbers. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Show at most one axis label every ~44px, always keeping the last one. */
const labelStep = (count: number, plotWidth: number) => Math.max(1, Math.ceil(count / Math.max(1, plotWidth / 44)));

function Frame({
  title,
  unit,
  data,
  width,
  max,
  active,
  children,
}: {
  title: string;
  unit: string;
  data: Point[];
  width: number;
  max: number;
  active?: number;
  children: (x: (i: number) => number, y: (v: number) => number, band: number) => ReactNode;
}) {
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const band = plotW / Math.max(1, data.length);
  const x = (i: number) => M.left + band * (i + 0.5);
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const step = labelStep(data.length, plotW);
  // Everything we chart is a count: no "0.5 book" gridline.
  const ticks = [0, max / 2, max].filter(Number.isInteger);
  return (
    <svg width={width} height={HEIGHT} role="img" aria-label={`${title} (${unit})`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
          <text className="tick" x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      {active !== undefined && (
        <rect className="hover-band" x={M.left + band * active} y={M.top} width={band} height={plotH} rx={4} />
      )}
      {children(x, y, band)}
      {data.map((d, i) =>
        (data.length - 1 - i) % step === 0 ? (
          <text key={d.key} className="tick" x={x(i)} y={HEIGHT - 8} textAnchor="middle">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Hover (mouse) or tap (touch; tap again to close) a column to see its tooltip. */
function useActive() {
  const [active, setActive] = useState<number>();
  const handlers = (i: number) => ({
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && setActive(i),
    onPointerUp: (e: PointerEvent) => e.pointerType !== 'mouse' && setActive((a) => (a === i ? undefined : i)),
  });
  return { active, setActive, handlers };
}

function Hits({
  data,
  width,
  handlers,
}: {
  data: Point[];
  width: number;
  handlers: (i: number) => object;
}) {
  const band = Math.max(0, width - M.left - M.right) / Math.max(1, data.length);
  return (
    <>
      {data.map((d, i) => (
        <rect key={d.key} className="hit" x={M.left + band * i} y={0} width={band} height={HEIGHT} {...handlers(i)} />
      ))}
    </>
  );
}

function Tooltip({ data, active, width }: { data: Point[]; active?: number; width: number }) {
  if (active === undefined) return null;
  const band = Math.max(0, width - M.left - M.right) / Math.max(1, data.length);
  // Keep the tooltip (max 220px wide) inside the chart.
  const left = Math.min(Math.max(M.left + band * (active + 0.5), 110), width - 110);
  return (
    <div className="chart-tip" style={{ left }} role="status">
      {data[active].tip}
    </div>
  );
}

function DataTable({ title, unit, data }: { title: string; unit: string; data: Point[] }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <tbody>
        {data.map((d) => (
          <tr key={d.key}>
            <th scope="row">{d.label}</th>
            <td>{d.value === undefined ? '—' : `${d.value} ${unit}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BarChart({ title, unit, data }: { title: string; unit: string; data: Point[] }) {
  const [ref, width] = useWidth();
  const { active, setActive, handlers } = useActive();
  const max = niceMax(Math.max(0, ...data.map((d) => d.value ?? 0)));
  return (
    <div className="chart" ref={ref} onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(undefined)}>
      {width > 0 && (
        <Frame title={title} unit={unit} data={data} width={width} max={max} active={active}>
          {(x, y, band) => {
            const w = Math.min(28, Math.max(4, band * 0.6));
            return data.map((d, i) => {
              if (!d.value) return null;
              const top = y(d.value);
              const bottom = y(0);
              const r = Math.min(4, w / 2, bottom - top);
              const left = x(i) - w / 2;
              // Rounded at the data end only; flat on the baseline.
              const path = `M${left},${bottom} V${top + r} Q${left},${top} ${left + r},${top} H${left + w - r} Q${left + w},${top} ${left + w},${top + r} V${bottom} Z`;
              return <path key={d.key} className="bar" d={path} />;
            });
          }}
        </Frame>
      )}
      {width > 0 && (
        <svg className="hits" width={width} height={HEIGHT} aria-hidden="true">
          <Hits data={data} width={width} handlers={handlers} />
        </svg>
      )}
      <Tooltip data={data} active={active} width={width} />
      <DataTable title={title} unit={unit} data={data} />
    </div>
  );
}

export function LineChart({ title, unit, data }: { title: string; unit: string; data: Point[] }) {
  const [ref, width] = useWidth();
  const { active, setActive, handlers } = useActive();
  const max = niceMax(Math.max(0, ...data.map((d) => d.value ?? 0)) * 1.1);
  return (
    <div className="chart" ref={ref} onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(undefined)}>
      {width > 0 && (
        <Frame title={title} unit={unit} data={data} width={width} max={max} active={active}>
          {(x, y) => {
            // Break the line where a week has no data.
            const segments: string[] = [];
            let current = '';
            data.forEach((d, i) => {
              if (d.value === undefined) {
                if (current) segments.push(current);
                current = '';
              } else current += `${current ? 'L' : 'M'}${x(i)},${y(d.value)} `;
            });
            if (current) segments.push(current);
            return (
              <>
                {segments.map((seg) => (
                  <path key={seg} className="line" d={seg} />
                ))}
                {data.map((d, i) =>
                  d.value === undefined ? null : (
                    <circle key={d.key} className={`dot${i === active ? ' active' : ''}`} cx={x(i)} cy={y(d.value)} r={4} />
                  ),
                )}
              </>
            );
          }}
        </Frame>
      )}
      {width > 0 && (
        <svg className="hits" width={width} height={HEIGHT} aria-hidden="true">
          <Hits data={data} width={width} handlers={handlers} />
        </svg>
      )}
      <Tooltip data={data} active={active} width={width} />
      <DataTable title={title} unit={unit} data={data} />
    </div>
  );
}
