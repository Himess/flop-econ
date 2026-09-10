"use client";

/**
 * The agent's chart: what you get back, by close path, against what you put in.
 *
 * The validator tab has a time axis, so it gets a line chart. A session has no time axis — it has
 * outcomes. The question an agent actually has is "I reserved X; which of these paths leaves me
 * with what?", and the close-path table answers it in nine rows of digits that all look alike.
 *
 * As bars against a reservation line, the shape is visible at a glance: most paths return the
 * escrow in full, and the one the protocol calls cooperative — the ordinary, successful one —
 * returns nothing. That is the finding the table buries.
 */
import { useEffect, useRef, useState } from "react";
import type { CloseOutcome } from "@/model/agent";
import { isBlocked } from "@/model/types";
import { compact, int } from "../lib/format";

const NARROW = 560;
const FALLBACK_W = 860;

export function PathChart({ paths, escrow }: { paths: readonly CloseOutcome[]; escrow: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_W);
  const [hover, setHover] = useState<string | null>(null);

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
  // The longest label is "DA unrecoverable (beyond k shards)", so the gutter scales with the
  // container instead of sitting at a fixed width that clipped it at every size.
  const labelW = Math.min(300, Math.max(narrow ? 112 : 200, Math.round(width * 0.3)));
  const valueW = narrow ? 58 : 88;
  const rowH = narrow ? 30 : 34;
  const barH = narrow ? 13 : 15;
  // Room for the reservation label to sit above the plot rather than against the top edge.
  const padT = 30;
  const padB = 6;
  const plotW = Math.max(40, width - labelW - valueW - 12);
  const height = padT + paths.length * rowH + padB;

  // Escrow is the reference: every path is read against what was put in, so the axis ends there.
  const top = Math.max(escrow, ...paths.map((p) => (isBlocked(p.agentRecovers) ? 0 : p.agentRecovers.value)), 1);
  const x = (v: number) => (v / top) * plotW;
  const refX = labelW + x(escrow);

  return (
    <figure className="m-0">
      <div ref={box}>
        {paths.length === 0 ? null : (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block max-w-full"
            role="img"
            aria-label={`What an agent recovers under each of ${paths.length} close paths, against a reservation of ${int(escrow)} FLOP.`}
          >
            {/* the reservation line, and the only gridline worth drawing */}
            <line
              x1={refX}
              x2={refX}
              y1={padT - 12}
              y2={height - padB}
              stroke="var(--s-cost)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={refX}
              y={padT - 16}
              textAnchor="end"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: narrow ? "10px" : "11px",
                fill: "var(--s-cost)",
              }}
            >
              reserved {compact(escrow)}
            </text>

            {paths.map((p, i) => {
              const y = padT + i * rowH;
              const r = p.agentRecovers;
              const blocked = isBlocked(r);
              const v = isBlocked(r) ? 0 : r.value;
              const full = !blocked && v >= escrow - 1e-9;
              const on = hover === p.path;
              return (
                <g
                  key={p.path}
                  onPointerEnter={() => setHover(p.path)}
                  onPointerLeave={() => setHover(null)}
                >
                  {/* a full-width hit target, so the pointer only has to be on the row */}
                  <rect x={0} y={y} width={width} height={rowH} fill="transparent" />
                  <text
                    x={labelW - 10}
                    y={y + barH + 1}
                    textAnchor="end"
                    style={{
                      fontSize: narrow ? "11px" : "12.5px",
                      fill: on ? "var(--ink)" : "var(--ink-2)",
                    }}
                  >
                    {p.label}
                  </text>

                  {blocked ? (
                    <text
                      x={labelW + 2}
                      y={y + barH}
                      style={{ fontSize: narrow ? "10.5px" : "11.5px", fill: "var(--absent)" }}
                    >
                      not specified
                    </text>
                  ) : (
                    <rect
                      x={labelW}
                      y={y}
                      width={Math.max(v > 0 ? 2 : 0, x(v))}
                      height={barH}
                      rx="2"
                      fill={full ? "var(--s-liquid)" : "var(--absent)"}
                      opacity={on ? 1 : 0.85}
                    />
                  )}

                  <text
                    x={width - 2}
                    y={y + barH}
                    textAnchor="end"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: narrow ? "11px" : "12.5px",
                      fontVariantNumeric: "tabular-nums",
                      fill: blocked ? "var(--absent)" : full ? "var(--ink-2)" : "var(--absent)",
                    }}
                  >
                    {blocked ? "—" : int(v)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        {(
          [
            ["var(--s-liquid)", "escrow returned in full"],
            ["var(--absent)", "you lose the difference"],
          ] as const
        ).map(([colour, label]) => (
          <span key={label} className="flex items-center gap-2">
            <svg width="22" height="9" aria-hidden="true">
              <rect x="0" y="1" width="22" height="7" rx="2" fill={colour} />
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
