"use client";

/**
 * The agent's missing axis: how long the escrow is exposed.
 *
 * The close-path chart answers "how much do I get back". This answers "and until when", which for
 * anyone reserving capital is the other half of the question — and the half the tool had no view
 * on at all.
 *
 * Every band is a §2.2 window, read from the parameter set rather than drawn to taste. The axis is
 * logarithmic because the windows span ten minutes to fourteen days: on a linear axis the ack
 * window is a third of a pixel, and the thing an agent most needs to see is that these live on
 * completely different scales.
 *
 * The reading the picture is for: a cooperative settle ends at settlement, but a force_settle can
 * be contested for seven days, and the evidence that decides it is only guaranteed for fourteen.
 */
import { useEffect, useRef, useState } from "react";
import { sessionWindows } from "@/model/agent";

const NARROW = 560;
const FALLBACK_W = 860;
const MIN_DAYS = 1 / (24 * 60); // one minute — the left edge of the axis
const HOURS_PER_DAY = 24;

/** 10 min · 1 h · 4 h · 1 d · 7 d · 14 d — the points the windows actually land on. */
const TICKS: readonly { days: number; label: string }[] = [
  { days: 10 / (24 * 60), label: "10 min" },
  { days: 1 / 24, label: "1 h" },
  { days: 4 / 24, label: "4 h" },
  { days: 1, label: "1 d" },
  { days: 7, label: "7 d" },
  { days: 14, label: "14 d" },
];

function human(days: number): string {
  if (days < 1 / 24) return `${Math.round(days * HOURS_PER_DAY * 60)} min`;
  if (days < 1) return `${Math.round(days * HOURS_PER_DAY)} h`;
  return `${Math.round(days)} d`;
}

export function SessionTimeline() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_W);
  const [hover, setHover] = useState<string | null>(null);
  const windows = sessionWindows();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width < NARROW;
  const labelW = Math.min(200, Math.max(narrow ? 104 : 150, Math.round(width * 0.24)));
  const valueW = narrow ? 46 : 60;
  const rowH = narrow ? 30 : 34;
  const barH = narrow ? 12 : 14;
  const padT = 26;
  const axisH = 26;
  const plotW = Math.max(40, width - labelW - valueW - 10);
  const height = padT + windows.length * rowH + axisH;

  const maxDays = Math.max(...windows.map((w) => w.days));
  const lo = Math.log10(MIN_DAYS);
  const hi = Math.log10(maxDays);
  const x = (days: number) => labelW + ((Math.log10(Math.max(days, MIN_DAYS)) - lo) / (hi - lo)) * plotW;

  return (
    <figure className="m-0">
      <div ref={box}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full"
          role="img"
          aria-label={`The windows an agent's escrow is exposed across, from a ${human(
            windows[0]!.days,
          )} acknowledgement window to ${human(maxDays)} of data-availability retention.`}
        >
          {TICKS.filter((t) => t.days <= maxDays).map((t) => (
            <g key={t.label}>
              <line
                x1={x(t.days)}
                x2={x(t.days)}
                y1={padT - 10}
                y2={padT + windows.length * rowH}
                stroke="var(--s-grid)"
                strokeWidth="1"
              />
              <text
                x={x(t.days)}
                y={padT + windows.length * rowH + 16}
                textAnchor="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: narrow ? "10px" : "11px",
                  fill: "var(--ink-3)",
                }}
              >
                {t.label}
              </text>
            </g>
          ))}

          <text
            x={labelW}
            y={padT - 15}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: narrow ? "10px" : "11px",
              fill: "var(--ink-3)",
            }}
          >
            channel opens
          </text>

          {windows.map((w, i) => {
            const y = padT + i * rowH;
            const on = hover === w.key;
            // Retention is the outer bound rather than a window you wait through, so it reads as
            // an edge; the rest are spans your money sits inside.
            const outer = w.key === "retention";
            return (
              <g key={w.key} onPointerEnter={() => setHover(w.key)} onPointerLeave={() => setHover(null)}>
                <rect x={0} y={y - 4} width={width} height={rowH} fill="transparent" />
                <text
                  x={labelW - 10}
                  y={y + barH}
                  textAnchor="end"
                  style={{
                    fontSize: narrow ? "11px" : "12.5px",
                    fill: on ? "var(--ink)" : "var(--ink-2)",
                  }}
                >
                  {w.label}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={Math.max(2, x(w.days) - labelW)}
                  height={barH}
                  rx="2"
                  fill={outer ? "none" : "var(--s-liquid)"}
                  stroke={outer ? "var(--s-cost)" : "none"}
                  strokeWidth={outer ? 1.5 : 0}
                  strokeDasharray={outer ? "5 4" : undefined}
                  opacity={on ? 1 : 0.85}
                />
                <text
                  x={width - 2}
                  y={y + barH}
                  textAnchor="end"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: narrow ? "11px" : "12.5px",
                    fontVariantNumeric: "tabular-nums",
                    fill: "var(--ink-2)",
                  }}
                >
                  {human(w.days)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-2.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
        {hover
          ? windows.find((w) => w.key === hover)!.effect
          : "Logarithmic — these windows are three orders of magnitude apart. Hover a band for what it does to your escrow."}
      </p>
    </figure>
  );
}
