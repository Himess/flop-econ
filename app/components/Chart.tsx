"use client";

/**
 * The one chart on the tool page: cumulative earned, withdrawable and cost over the horizon.
 *
 * Four decisions worth stating, because each replaced something that looked amateur:
 *
 * 1. THE AXIS ENDS ON A ROUND NUMBER. Ticks used to be fractions of the data maximum, which is
 *    how a chart ends up labelled $57.3K / $114.7K / $172K. A 1-2-5 nice-number step picks the
 *    tick, and the plot's top is the last tick rather than the tallest datum.
 * 2. COST IS A BENCHMARK, NOT A THIRD SERIES. It is the line the other two have to clear, so it
 *    wears muted ink and a thinner stroke and stays out of the categorical palette. That also
 *    fixed a real defect: as three series, amber and coral sat below the normal-vision
 *    separation floor — two of the three lines were hard to tell apart even with full colour
 *    vision.
 * 3. THE MONTH AXIS IS TWO-TIER. Minor ticks every quarter, labels every six months, and a year
 *    band underneath, so a reader can find month 19 instead of interpolating between "month 18"
 *    and "month 27".
 * 4. THERE IS A HOVER LAYER. A crosshair snaps to the nearest month and one tooltip reads out
 *    every series at that month; arrow keys do the same thing, and the table view underneath
 *    keeps every value reachable without pointing at anything.
 *
 * Drawn at the container's own pixel size rather than scaled from a fixed viewBox: a 900-unit
 * viewBox squeezed onto a 375px phone renders 11px labels at four physical pixels.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { TimelineMonth } from "@/model/timeline";
import { compact, int } from "../lib/format";

/** Below this the axis furniture has to thin out or it collides with itself. */
const NARROW = 620;
const FALLBACK_W = 880;
const MONTHS_PER_YEAR = 12;

type Geometry = {
  w: number;
  h: number;
  pad: { l: number; r: number; t: number; b: number };
  yTicks: number;
  labelEvery: number;
  axisFont: number;
  narrow: boolean;
};

function geometry(w: number): Geometry {
  const narrow = w < NARROW;
  return {
    w,
    // The right pad on wide layouts is the gutter the end-labels live in; the bottom pad holds
    // both axis tiers.
    pad: narrow ? { l: 52, r: 12, t: 20, b: 44 } : { l: 68, r: 104, t: 24, b: 50 },
    h: narrow ? 268 : 364,
    yTicks: narrow ? 4 : 5,
    labelEvery: narrow ? MONTHS_PER_YEAR : 6,
    axisFont: narrow ? 10.5 : 11.5,
    narrow,
  };
}

/**
 * A 1-2-5 step at the magnitude of the data. Returns ticks from zero through the first step at or
 * above `max`, so the plot's ceiling is a number a person would say out loud.
 */
function niceTicks(max: number, target: number): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const rough = max / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const count = Math.ceil(max / step);
  return Array.from({ length: Math.max(2, count + 1) }, (_, i) => step * i);
}

type SeriesKey = "earned" | "liquid" | "cost";

const SERIES: readonly {
  key: SeriesKey;
  label: string;
  note: string;
  colour: string;
  width: number;
  get: (r: TimelineMonth) => number;
}[] = [
  {
    key: "earned",
    label: "Earned",
    note: "cumulative, on paper",
    colour: "var(--s-earned)",
    width: 2,
    get: (r) => r.cumulativeEarnedUsd,
  },
  {
    key: "liquid",
    label: "Withdrawable",
    note: "cumulative, in hand",
    colour: "var(--s-liquid)",
    width: 2,
    get: (r) => r.cumulativeLiquidUsd,
  },
  {
    key: "cost",
    label: "Cost",
    note: "the line to clear",
    colour: "var(--s-cost)",
    width: 1.5,
    get: (r) => r.cumulativeCostUsd,
  },
];

export function Chart({ rows, priceKnown }: { rows: TimelineMonth[]; priceKnown: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_W);
  const [cursor, setCursor] = useState<number | null>(null);
  const uid = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = rows.length;
  const g = geometry(width);
  const { w: W, h: H, pad: PAD } = g;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const { ticks, top } = useMemo(() => {
    const max = Math.max(
      0,
      ...rows.map((r) => Math.max(r.cumulativeEarnedUsd, r.cumulativeLiquidUsd, r.cumulativeCostUsd)),
    );
    const t = niceTicks(max, g.yTicks);
    return { ticks: t, top: t[t.length - 1] ?? 1 };
  }, [rows, g.yTicks]);

  const x = useCallback(
    (m: number) => PAD.l + ((m - 1) / Math.max(1, n - 1)) * plotW,
    [PAD.l, n, plotW],
  );
  const y = useCallback(
    (v: number) => PAD.t + plotH - (v / (top || 1)) * plotH,
    [PAD.t, plotH, top],
  );

  const path = (get: (r: TimelineMonth) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.month).toFixed(1)},${y(get(r)).toFixed(1)}`).join(" ");

  // ---------------------------------------------------------------- pointer & keyboard cursor
  const monthAt = useCallback(
    (clientX: number) => {
      const el = box.current;
      if (!el || n === 0) return null;
      const rect = el.getBoundingClientRect();
      const local = clientX - rect.left - PAD.l;
      const idx = Math.round((local / Math.max(1, plotW)) * (n - 1));
      return Math.min(n - 1, Math.max(0, idx));
    },
    [PAD.l, n, plotW],
  );

  const active = cursor === null ? null : rows[Math.min(cursor, n - 1)];

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      setCursor((c) => Math.min(n - 1, Math.max(0, (c ?? 0) + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setCursor(n - 1);
    } else if (e.key === "Escape") {
      setCursor(null);
    }
  };

  // End-of-line labels, pushed apart when two series converge at the right edge.
  const endLabels = useMemo(() => {
    const last = rows[n - 1];
    if (!last || g.narrow) return [];
    const placed = SERIES.map((s) => ({ s, v: s.get(last), yy: y(s.get(last)) })).sort(
      (a, b) => a.yy - b.yy,
    );
    const MIN_GAP = 34;
    for (let i = 1; i < placed.length; i++) {
      const prev = placed[i - 1]!;
      const cur = placed[i]!;
      if (cur.yy - prev.yy < MIN_GAP) cur.yy = prev.yy + MIN_GAP;
    }
    // The value sits 13px below its key line, and the month labels start 9px under the axis, so
    // the lowest label has to stop well short of the baseline or it lands in the axis band.
    const ceiling = PAD.t + plotH - 22;
    const overflow = (placed[placed.length - 1]?.yy ?? 0) - ceiling;
    if (overflow > 0) placed.forEach((p) => (p.yy -= overflow));
    return placed;
  }, [rows, n, y, g.narrow, PAD.t, plotH]);

  const yearLines = useMemo(() => {
    const out: number[] = [];
    for (let m = MONTHS_PER_YEAR; m < n; m += MONTHS_PER_YEAR) out.push(m + 1);
    return out;
  }, [n]);

  const monthLabels = useMemo(() => {
    const out: number[] = [];
    for (let m = g.labelEvery; m <= n; m += g.labelEvery) out.push(m);
    return out;
  }, [n, g.labelEvery]);

  const quarterTicks = useMemo(() => {
    const out: number[] = [];
    for (let m = 3; m <= n; m += 3) out.push(m);
    return out;
  }, [n]);

  const tip = active ? tipPosition(x(active.month), plotW, PAD.l, g.narrow) : null;

  return (
    <figure className="m-0">
      <div ref={box} className="relative">
        {n === 0 ? null : (
          <>
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="block max-w-full touch-pan-y"
              tabIndex={0}
              role="img"
              aria-describedby={`${uid}-readout`}
              aria-label={
                priceKnown
                  ? `Cumulative earned, withdrawable and cost in dollars over ${n} months. Use the arrow keys to read each month.`
                  : `Cumulative earned, withdrawable and cost over ${n} months. Dollar values require a price assumption, which has not been supplied.`
              }
              onKeyDown={onKey}
              onFocus={() => setCursor((c) => c ?? n - 1)}
              onBlur={() => setCursor(null)}
              onPointerMove={(e) => setCursor(monthAt(e.clientX))}
              onPointerLeave={() => setCursor(null)}
              // Mouse events as well as pointer events: some automation drivers and older engines
              // dispatch only the former, and a crosshair that works everywhere but the tool you
              // check it with is indistinguishable from one that does not work.
              onMouseMove={(e) => setCursor(monthAt(e.clientX))}
              onMouseLeave={() => setCursor(null)}
            >
              <defs>
                <clipPath id={`${uid}-plot`}>
                  <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} />
                </clipPath>
              </defs>

              {/*
                The hit target. An <svg> root with no painted background receives no pointer
                events of its own — only its children do, and every child here is either a
                fill="none" path or a hairline, so the pointer was landing on nothing. This
                transparent rect (transparent, not "none") is what the crosshair listens through,
                and it is the full plot area rather than the 2px strokes.
              */}
              <rect
                x={PAD.l}
                y={PAD.t}
                width={plotW}
                height={plotH}
                fill="transparent"
                stroke="none"
              />

              {/* gridlines: solid hairlines, one step off the surface */}
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.l}
                    x2={PAD.l + plotW}
                    y1={y(t)}
                    y2={y(t)}
                    stroke={t === 0 ? "var(--rule)" : "var(--s-grid)"}
                    strokeWidth="1"
                  />
                  <text
                    x={PAD.l - 10}
                    y={y(t) + 3.5}
                    textAnchor="end"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: `${g.axisFont}px`,
                      fill: "var(--ink-3)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${compact(t)}
                  </text>
                </g>
              ))}

              {/* year separators, then the halving markers on top of them */}
              {yearLines.map((m) => (
                <line
                  key={`yr${m}`}
                  x1={x(m)}
                  x2={x(m)}
                  y1={PAD.t}
                  y2={PAD.t + plotH}
                  stroke="var(--s-grid)"
                  strokeWidth="1"
                />
              ))}
              {rows
                .filter((r) => r.eraBoundary)
                .map((b, i) => (
                  <g key={`era${b.month}`} clipPath={`url(#${uid}-plot)`}>
                    <line
                      x1={x(b.month)}
                      x2={x(b.month)}
                      y1={PAD.t}
                      y2={PAD.t + plotH}
                      stroke="var(--ink-3)"
                      strokeWidth="1"
                    />
                    {g.narrow && i > 0 ? null : (
                      <text
                        x={x(b.month) + 6}
                        y={PAD.t + 11}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: `${g.axisFont - 1}px`,
                          fill: "var(--ink-3)",
                        }}
                      >
                        halving
                      </text>
                    )}
                  </g>
                ))}

              {/* crosshair sits under the marks so it never breaks a line */}
              {active ? (
                <line
                  x1={x(active.month)}
                  x2={x(active.month)}
                  y1={PAD.t}
                  y2={PAD.t + plotH}
                  stroke="var(--s-crosshair)"
                  strokeWidth="1"
                  opacity="0.7"
                />
              ) : null}

              {SERIES.map((s) => (
                <path
                  key={s.key}
                  d={path(s.get)}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={s.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  {...(s.key === "cost" ? { strokeDasharray: "5 4" } : {})}
                />
              ))}

              {/* focus dots carry a surface ring so they stay legible where lines overlap */}
              {active
                ? SERIES.map((s) => (
                    <circle
                      key={`d${s.key}`}
                      cx={x(active.month)}
                      cy={y(s.get(active))}
                      r="4.5"
                      fill={s.colour}
                      stroke="var(--ground)"
                      strokeWidth="2"
                    />
                  ))
                : null}

              {/* end labels: a colour key, the series name, the value */}
              {endLabels.map(({ s, v, yy }) => (
                <g key={`e${s.key}`}>
                  <line
                    x1={PAD.l + plotW + 8}
                    x2={PAD.l + plotW + 20}
                    y1={yy - 5}
                    y2={yy - 5}
                    stroke={s.colour}
                    strokeWidth={s.width}
                    {...(s.key === "cost" ? { strokeDasharray: "5 4" } : {})}
                  />
                  <text
                    x={PAD.l + plotW + 25}
                    y={yy - 1.5}
                    style={{ fontSize: "11px", fill: "var(--ink-3)" }}
                  >
                    {s.label}
                  </text>
                  <text
                    x={PAD.l + plotW + 8}
                    y={yy + 13}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12.5px",
                      fill: "var(--ink-2)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${compact(v)}
                  </text>
                </g>
              ))}

              {/* x axis, tier one: quarter ticks and six-month labels */}
              <line
                x1={PAD.l}
                x2={PAD.l + plotW}
                y1={PAD.t + plotH}
                y2={PAD.t + plotH}
                stroke="var(--rule)"
                strokeWidth="1"
              />
              {quarterTicks.map((m) => (
                <line
                  key={`q${m}`}
                  x1={x(m)}
                  x2={x(m)}
                  y1={PAD.t + plotH}
                  y2={PAD.t + plotH + 4}
                  stroke="var(--rule)"
                  strokeWidth="1"
                />
              ))}
              {monthLabels.map((m) => (
                <text
                  key={`ml${m}`}
                  x={x(m)}
                  y={PAD.t + plotH + 18}
                  textAnchor={m === n ? "end" : "middle"}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: `${g.axisFont}px`,
                    fill: "var(--ink-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m}
                </text>
              ))}
              <text
                x={PAD.l}
                y={PAD.t + plotH + 18}
                textAnchor="end"
                style={{ fontSize: `${g.axisFont - 0.5}px`, fill: "var(--ink-3)" }}
              >
                month
              </text>

              {/* x axis, tier two: the year band */}
              {Array.from({ length: Math.ceil(n / MONTHS_PER_YEAR) }, (_, i) => {
                const from = i * MONTHS_PER_YEAR + 1;
                const to = Math.min(n, (i + 1) * MONTHS_PER_YEAR);
                const mid = (x(from) + x(to)) / 2;
                if (x(to) - x(from) < 44) return null;
                return (
                  <g key={`yb${i}`}>
                    <line
                      x1={x(from)}
                      x2={x(to)}
                      y1={PAD.t + plotH + 28}
                      y2={PAD.t + plotH + 28}
                      stroke="var(--rule)"
                      strokeWidth="1"
                    />
                    <text
                      x={mid}
                      y={PAD.t + plotH + 41}
                      textAnchor="middle"
                      style={{ fontSize: `${g.axisFont - 0.5}px`, fill: "var(--ink-3)" }}
                    >
                      year {i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>

            {active && tip ? (
              <div
                className="pointer-events-none absolute z-10 rounded-[4px] px-2.5 py-2"
                style={{
                  left: tip.left,
                  transform: tip.flip ? "translateX(-100%)" : undefined,
                  top: PAD.t,
                  background: "var(--panel-2)",
                  border: "1px solid var(--rule)",
                  boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                  minWidth: "172px",
                }}
              >
                <div
                  className="pb-1.5 text-[11px]"
                  style={{
                    color: "var(--ink-3)",
                    borderBottom: "1px solid var(--rule)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  month {int(active.month)} · era {int(active.era)}
                  {active.eraBoundary ? " · halving" : ""}
                </div>
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-baseline justify-between gap-4 pt-1.5">
                    <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                      <svg width="12" height="6" aria-hidden="true">
                        <line
                          x1="0"
                          y1="3"
                          x2="12"
                          y2="3"
                          stroke={s.colour}
                          strokeWidth={s.width}
                          {...(s.key === "cost" ? { strokeDasharray: "5 4" } : {})}
                        />
                      </svg>
                      {s.label}
                    </span>
                    <span
                      className="text-[13px]"
                      style={{
                        color: "var(--ink)",
                        fontFamily: "var(--font-mono)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ${int(s.get(active))}
                    </span>
                  </div>
                ))}
                <div
                  className="mt-2 flex items-baseline justify-between gap-4 pt-1.5 text-[11.5px]"
                  style={{ borderTop: "1px solid var(--rule)", color: "var(--ink-3)" }}
                >
                  Still locked
                  <span
                    style={{
                      color: "var(--ink-2)",
                      fontFamily: "var(--font-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {int(active.outstandingLockedFlop)} FLOP
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* The readout doubles as the live region, so keyboard users hear what hover shows. */}
      <p id={`${uid}-readout`} className="sr-only" aria-live="polite">
        {active
          ? `Month ${active.month}: earned $${int(active.cumulativeEarnedUsd)}, withdrawable $${int(
              active.cumulativeLiquidUsd,
            )}, cost $${int(active.cumulativeCostUsd)}.`
          : ""}
      </p>

      <figcaption className="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="22"
                y2="4"
                stroke={s.colour}
                strokeWidth={s.width + 0.5}
                {...(s.key === "cost" ? { strokeDasharray: "5 4" } : {})}
              />
            </svg>
            <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              {s.label}
            </span>
            <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {s.note}
            </span>
          </span>
        ))}
      </figcaption>

      <details className="group mt-4">
        <summary
          className="inline-flex cursor-pointer list-none items-center gap-2 text-[12px]"
          style={{ color: "var(--ink-3)" }}
        >
          <span className="inline-block transition-transform group-open:rotate-90">▸</span>
          Table view
        </summary>
        <div className="mt-2 max-h-[300px] overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {["Month", "Earned", "Withdrawable", "Cost", "Still locked"].map((h, i) => (
                  <th
                    key={h}
                    className="sticky top-0 pb-1.5 pr-3 text-[10.5px] font-medium uppercase tracking-wide"
                    style={{
                      background: "var(--ground)",
                      color: "var(--ink-3)",
                      borderBottom: "1px solid var(--rule)",
                      textAlign: i === 0 ? "left" : "right",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="py-1 pr-3" style={{ color: "var(--ink-3)" }}>
                    {r.month}
                  </td>
                  <td className="py-1 pr-3 text-right" style={{ color: "var(--ink-2)" }}>
                    ${int(r.cumulativeEarnedUsd)}
                  </td>
                  <td className="py-1 pr-3 text-right" style={{ color: "var(--ink-2)" }}>
                    ${int(r.cumulativeLiquidUsd)}
                  </td>
                  <td className="py-1 pr-3 text-right" style={{ color: "var(--ink-2)" }}>
                    ${int(r.cumulativeCostUsd)}
                  </td>
                  <td className="py-1 text-right" style={{ color: "var(--ink-3)" }}>
                    {int(r.outstandingLockedFlop)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * Keep the tooltip inside the plot: it hangs to the right of the crosshair until that would
 * overflow, then flips. Both cases are clamped, because a flip near the left edge would otherwise
 * push the readout out over the y-axis labels.
 */
function tipPosition(cx: number, plotW: number, padL: number, narrow: boolean) {
  const gap = 14;
  const tipW = narrow ? 172 : 214;
  const right = padL + plotW;
  const flip = cx + gap + tipW > right;
  const left = flip
    ? Math.max(padL + tipW, cx - gap) // `left` is the right edge once translateX(-100%) applies
    : Math.min(right - tipW, cx + gap);
  return { left, flip };
}
