"use client";

/**
 * The one chart on the tool page: cumulative earned, withdrawable and cost over the horizon.
 *
 * Drawn at the container's own pixel size rather than scaled from a fixed viewBox. A 900-unit
 * viewBox squeezed into a 327px phone renders 11px labels at four physical pixels, which is a
 * decorative chart pretending to be a readable one — so the geometry is measured and the type is
 * always true size. Lines are distinguished by dash pattern as well as colour so the reading
 * survives greyscale, and the y-axis is labelled because an unlabelled cumulative chart is
 * decoration too.
 */
import { useEffect, useRef, useState } from "react";
import type { TimelineMonth } from "@/model/timeline";
import { compact } from "../lib/format";

/** Below this the axis furniture has to thin out or it collides with itself. */
const NARROW = 560;
const FALLBACK_W = 880;

type Geometry = {
  w: number;
  h: number;
  pad: { l: number; r: number; t: number; b: number };
  yTicks: number;
  axisFont: number;
  narrow: boolean;
};

function geometry(w: number): Geometry {
  const narrow = w < NARROW;
  return {
    w,
    h: narrow ? 250 : 340,
    pad: narrow ? { l: 54, r: 10, t: 16, b: 28 } : { l: 66, r: 16, t: 18, b: 34 },
    yTicks: narrow ? 3 : 5,
    axisFont: narrow ? 10.5 : 11.5,
    narrow,
  };
}

export function Chart({ rows, priceKnown }: { rows: TimelineMonth[]; priceKnown: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_W);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = rows.length;
  const g = geometry(width);
  const { w: W, h: H, pad: PAD } = g;

  const maxY = Math.max(
    1,
    ...rows.map((r) => Math.max(r.cumulativeEarnedUsd, r.cumulativeLiquidUsd, r.cumulativeCostUsd)),
  );
  const x = (m: number) => PAD.l + ((m - 1) / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
  const line = (get: (r: TimelineMonth) => number) =>
    rows
      .map((r, i) => `${i === 0 ? "M" : "L"}${x(r.month).toFixed(1)},${y(get(r)).toFixed(1)}`)
      .join(" ");

  const ticks = Array.from({ length: g.yTicks }, (_, i) => (i / (g.yTicks - 1)) * maxY);
  const monthTicks = (
    g.narrow
      ? [1, Math.round(n / 2), n]
      : [1, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n]
  ).filter((m, i, a) => m >= 1 && m <= n && a.indexOf(m) === i);
  const boundaries = rows.filter((r) => r.eraBoundary);

  return (
    <figure className="m-0">
      <div ref={box}>
        {n === 0 ? null : (
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block max-w-full"
            role="img"
            aria-label={`Cumulative earned, withdrawable and cost over ${n} months. ${
              priceKnown ? "" : "Dollar values require a price assumption, which has not been supplied."
            }`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--rule)"
                  strokeWidth="1"
                  opacity={t === 0 ? 1 : 0.45}
                />
                <text
                  x={PAD.l - 8}
                  y={y(t) + 3.5}
                  textAnchor="end"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: `${g.axisFont}px`,
                    fill: "var(--ink-3)",
                  }}
                >
                  ${compact(t)}
                </text>
              </g>
            ))}

            {boundaries.map((b, i) => (
              <g key={b.month}>
                <line
                  x1={x(b.month)}
                  x2={x(b.month)}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="var(--ink-3)"
                  strokeWidth="1"
                  strokeDasharray="1 4"
                />
                {/* On a phone one label is orientation; two is clutter. */}
                {g.narrow && i > 0 ? null : (
                  <text
                    x={x(b.month) + 5}
                    y={PAD.t + 10}
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

            <path
              d={line((r) => r.cumulativeCostUsd)}
              fill="none"
              stroke="var(--absent)"
              strokeWidth="2"
              strokeDasharray="2 4"
            />
            <path
              d={line((r) => r.cumulativeEarnedUsd)}
              fill="none"
              stroke="var(--planned)"
              strokeWidth="2"
              strokeDasharray="8 4"
            />
            <path
              d={line((r) => r.cumulativeLiquidUsd)}
              fill="none"
              stroke="var(--defined)"
              strokeWidth="2.5"
            />

            {monthTicks.map((m) => (
              <text
                key={m}
                x={x(m)}
                y={H - 9}
                textAnchor={m === 1 ? "start" : m === n ? "end" : "middle"}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: `${g.axisFont}px`,
                  fill: "var(--ink-3)",
                }}
              >
                {g.narrow ? `m${m}` : `month ${m}`}
              </text>
            ))}
          </svg>
        )}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5">
        {(
          [
            ["", "var(--defined)", "withdrawable"],
            ["8 4", "var(--planned)", "earned"],
            ["2 4", "var(--absent)", "cost"],
          ] as const
        ).map(([dash, colour, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <svg width="26" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="26" y2="4" stroke={colour} strokeWidth="2.5" strokeDasharray={dash} />
            </svg>
            <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              {label}
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
