const Charts = (() => {
  const W = 300;
  const H = 90;

  const empty = (note) => `<p class="chart-empty mono">${note}</p>`;

  function scale(values, pad = 0.12) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || max || 1;
    return { lo: min - span * pad, hi: max + span * pad };
  }

  function line(points, { note = "Not enough sessions yet", fill = true } = {}) {
    if (points.length < 2) return empty(note);

    const values = points.map((p) => p.value);
    const { lo, hi } = scale(values);
    const x = (i) => (i / (points.length - 1)) * W;
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;

    const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
    const area = `${path} L${W} ${H} L0 ${H} Z`;
    const last = points[points.length - 1];

    return `<svg class="chart chart--line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Trend">
      ${fill ? `<path class="chart-area" d="${area}" />` : ""}
      <path class="chart-line" d="${path}" />
      <circle class="chart-tip" cx="${W}" cy="${y(last.value).toFixed(1)}" r="3" />
    </svg>`;
  }

  function bars(points, { note = "No volume logged yet", format = (v) => v } = {}) {
    if (!points.length) return empty(note);
    const max = Math.max(...points.map((p) => p.value)) || 1;

    return `<div class="chart chart--bars" role="img" aria-label="Weekly totals">
      ${points
        .map((p) => {
          const pct = Math.round((p.value / max) * 100);
          return `<div class="chart-bar" title="${format(p.value)}">
            <span class="chart-bar-fill" style="height:${Math.max(2, pct)}%"></span>
            <span class="chart-bar-key mono">${p.label}</span>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  // one row per slice, because a legend beside a pie is harder to read at a glance
  function split(rows, { note = "Nothing logged yet" } = {}) {
    const total = rows.reduce((t, r) => t + r.value, 0);
    if (!total) return empty(note);

    return `<ul class="chart-split">
      ${rows
        .sort((a, b) => b.value - a.value)
        .map((r) => {
          const pct = Math.round((r.value / total) * 100);
          return `<li>
            <span class="split-key mono">${r.label}</span>
            <span class="split-track"><i style="width:${pct}%"></i></span>
            <span class="split-val mono">${pct}%</span>
          </li>`;
        })
        .join("")}
    </ul>`;
  }

  function spark(values) {
    if (values.length < 2) return "";
    const { lo, hi } = scale(values, 0.2);
    const path = values
      .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * 100).toFixed(1)} ${(28 - ((v - lo) / (hi - lo)) * 28).toFixed(1)}`)
      .join(" ");
    return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" /></svg>`;
  }

  return { line, bars, split, spark };
})();
