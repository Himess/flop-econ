"use client";

/**
 * The one place the interface spends visual boldness.
 *
 * It reads net income against the specification's own implied validator cost — the figure §2.2
 * discloses when it calls the committee cap "cost-derived". That anchor is a spec assumption,
 * not an observed cost, and the caption says so.
 */
import { isBlocked, type Computed } from "@/model/types";
import { dp2, int } from "../lib/format";

const R = 82;
const CIRC = 2 * Math.PI * R;
/** Full sweep at this multiple of the anchor. Chosen for legibility only, not from the spec. */
const FULL_SWEEP_AT = 12;

export function Dial({ net, anchor }: { net: Computed; anchor: number }) {
  const blocked = isBlocked(net);
  const ratio = blocked ? 0 : net.value / anchor;
  const frac = Math.max(0, Math.min(1, ratio / FULL_SWEEP_AT));
  const negative = !blocked && net.value < 0;

  return (
    <svg viewBox="0 0 200 200" className="block h-auto w-full" role="img" aria-labelledby="dial-t">
      <title id="dial-t">
        {blocked
          ? "Net income cannot be computed until the undefined cost inputs are supplied"
          : `Net income is ${dp2(ratio)} times the specification's implied validator cost of ${int(anchor)} FLOP per year`}
      </title>
      <circle cx="100" cy="100" r={R} fill="none" stroke="#1c3a58" strokeWidth="14" />
      <circle
        className="arc"
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke={negative ? "var(--absent)" : "var(--defined)"}
        strokeWidth="14"
        strokeDasharray={`${frac * CIRC} ${CIRC}`}
        transform="rotate(-90 100 100)"
      />
      <text
        x="100"
        y="98"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-mono)", fontSize: "38px", fontWeight: 500, fill: "var(--ink)" }}
      >
        {blocked ? "—" : `${Math.abs(ratio) >= 10 ? int(ratio) : dp2(ratio)}×`}
      </text>
      <text
        x="100"
        y="120"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-sans)", fontSize: "11px", fill: "var(--ink-3)" }}
      >
        of the {int(anchor)} cost anchor
      </text>
    </svg>
  );
}
