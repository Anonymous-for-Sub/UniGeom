const svgNS = "http://www.w3.org/2000/svg";
const P = "#a29cff",
  D = "#f1eaff",
  T = "#68c5b4";
const arrow =
  '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="#aca6c4" stroke-width="1.2"/></marker></defs>';
const path = (d, active = false, extra = "") =>
  `<path d="${d}" class="wire ${active ? "flow-wire" : ""}" marker-end="url(#arrow)" ${extra}/>`;
const text = (x, y, t, cls = "node-small", anchor = "middle") =>
  `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${t}</text>`;
function node(x, y, w, h, label, sub, active = false, color = P) {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${active ? color + "15" : "#191922"}" stroke="${active ? color : "#3a3848"}" stroke-width="${active ? 1.8 : 1}"/>${text(x + w / 2, y + h / 2 - 3, label, "node-title")}${text(x + w / 2, y + h / 2 + 17, sub)}</g>`;
}
export function initConnection() {
  let step = 0,
    timer = null;
  const svg = document.querySelector("#connection-diagram");
  const details = [
    "The same observation is encoded independently by A and B. These feature pairs supply calibration targets without manual matching.",
    "Only the interface learns. Receiver-coordinate targets teach it how to translate the source representation.",
    "The mapped history and candidate actions enter the frozen receiver. Its own dynamics predict future features.",
    "The receiver’s controller selects actions using its existing goal cost. New observations are encoded by A and mapped again.",
  ];
  function render() {
    document.querySelectorAll("#connection-steps button").forEach((b, i) => {
      b.classList.toggle("selected", i === step);
      b.setAttribute("aria-pressed", i === step);
    });
    document.querySelector("#connection-detail").textContent = details[step];
    svg.innerHTML =
      arrow +
      node(24, 170, 106, 82, "Observation", "RGB history", step === 0) +
      node(174, 90, 132, 82, "Encoder A", "Frozen", step === 0) +
      node(
        174,
        285,
        132,
        82,
        "Encoder B",
        "Frozen · calibration",
        step < 2,
        T,
      ) +
      node(362, 90, 130, 82, "Interface T", "Trainable", step === 1) +
      node(550, 90, 178, 82, "Dynamics B", "Frozen", step === 2, T) +
      node(
        550,
        285,
        178,
        82,
        "Controller B",
        "Existing goal cost",
        step === 3,
        T,
      ) +
      path("M130 198 H148 V131 H174", step === 0) +
      path("M130 222 H148 V326 H174", step === 0, 'stroke-dasharray="5 5"') +
      path("M306 131 H362", step <= 1) +
      path("M492 131 H550", step === 2) +
      path("M639 172 V285", step >= 2) +
      path(
        "M550 326 H427 V172",
        step === 1,
        'stroke-dasharray="5 5" opacity="0"',
      ) +
      path(
        "M306 326 H383 V200 H425 V173",
        step === 1,
        'stroke-dasharray="5 5"',
      ) +
      path("M550 342 H520 V388 H80 V253", step === 3) +
      path("M639 43 V90", step === 2) +
      text(639, 28, "Candidate actions", "diagram-label") +
      text(683, 228, "Predicted", "node-small") +
      text(683, 245, "futures", "node-small") +
      text(
        347,
        420,
        "Execute actions · receive next observation",
        "diagram-label",
      ) +
      text(354, 278, "Paired target", "node-small") +
      text(332, 68, "Source features", "node-small") +
      `<g opacity="${step === 1 ? 1 : 0.35}"><circle cx="383" cy="231" r="19" fill="#2b263f" stroke="#a29cff"/>${text(383, 236, "ℒ", "node-title")}</g>` +
      text(424, 38, "T(Eₐ(o)) ≈ Eᵦ(o)", "diagram-label") +
      text(
        426,
        449,
        "Goal observations pass through the same calibrated interface.",
      ) +
      path("M508 132 V307 H550", step >= 2) +
      text(487, 250, "Goal", "node-small");
    const compact = matchMedia("(max-width: 800px)").matches;
    svg.setAttribute("viewBox", compact ? "0 0 360 465" : "0 0 760 460");
    if (compact) {
      svg.innerHTML =
        arrow +
        text(180, 24, "T(Eₐ(o)) ≈ Eᵦ(o)", "diagram-label") +
        node(18, 50, 110, 58, "Observation", "RGB history", step === 0) +
        node(195, 50, 145, 58, "Encoder A", "Frozen", step === 0) +
        node(18, 153, 110, 58, "Encoder B", "Calibration target", step < 2, T) +
        node(195, 153, 145, 58, "Interface T", "Trainable", step === 1) +
        node(195, 260, 145, 58, "Dynamics B", "Frozen", step === 2, T) +
        node(
          195,
          367,
          145,
          58,
          "Controller B",
          "Existing goal cost",
          step === 3,
          T,
        ) +
        path("M128 79 H195", step === 0) +
        path("M73 108 V153", step === 0, 'stroke-dasharray="4 4"') +
        path("M267 108 V153", step <= 1) +
        path("M128 182 H195", step === 1, 'stroke-dasharray="4 4"') +
        text(160, 167, "Target", "node-small") +
        path("M267 211 V260", step === 2) +
        path("M267 318 V367", step >= 2) +
        text(306, 345, "Future", "node-small") +
        path("M128 289 H195", step === 2) +
        text(75, 283, "Candidate", "node-small") +
        text(75, 301, "actions", "node-small") +
        path("M195 195 H172 V396 H195", step >= 2) +
        text(151, 350, "Goal", "node-small") +
        path("M267 425 V449 H7 V79 H18", step === 3) +
        text(155, 462, "Execute · observe again", "node-small");
    }
    if (!compact && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const routes = [
        ["M130 198 H148 V131 H174", "M130 222 H148 V326 H174"],
        ["M306 131 H362", "M306 326 H383 V231"],
        ["M492 131 H550", "M639 172 V285"],
        ["M550 342 H520 V388 H80 V253"],
      ][step];
      for (const route of routes)
        svg.insertAdjacentHTML(
          "beforeend",
          `<circle r="4.5" fill="${P}"><animateMotion dur="1.8s" repeatCount="1" path="${route}" fill="freeze"/></circle>`,
        );
    }
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    document.querySelector("#play-connection").textContent =
      "Replay these steps";
  }
  document.querySelectorAll("#connection-steps button").forEach(
    (b) =>
      (b.onclick = () => {
        stop();
        step = +b.dataset.step;
        render();
        svg.unpauseAnimations?.();
      }),
  );
  document.querySelector("#play-connection").onclick = () => {
    if (timer) {
      stop();
      return;
    }
    step = 0;
    render();
    svg.unpauseAnimations?.();
    document.querySelector("#play-connection").textContent = "Pause sequence";
    timer = setInterval(() => {
      step++;
      if (step > 3) {
        stop();
        return;
      }
      render();
    }, 2200);
  };
  document.addEventListener("chapterchange", (e) => {
    if (e.detail !== "connection") stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  matchMedia("(max-width: 800px)").addEventListener("change", render);
  render();
  return {
    setStep(i) {
      if (step !== i) {
        stop();
        step = i;
        render();
      }
    },
    stop,
  };
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sourceValue = (x, y) =>
  0.48 +
  0.22 * Math.sin(x * 0.65) +
  0.2 * Math.cos(y * 0.55) +
  0.08 * Math.sin((x + y) * 0.8);
function bilinear(x, y) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    dx = x - x0,
    dy = y - y0;
  return (
    sourceValue(x0, y0) * (1 - dx) * (1 - dy) +
    sourceValue(Math.min(x0 + 1, 15), y0) * dx * (1 - dy) +
    sourceValue(x0, Math.min(y0 + 1, 15)) * (1 - dx) * dy +
    sourceValue(Math.min(x0 + 1, 15), Math.min(y0 + 1, 15)) * dx * dy
  );
}
function color(v, teal = false) {
  v = clamp(v);
  const start = [32, 30, 46],
    end = teal ? [104, 197, 180] : [162, 156, 255];
  return `rgb(${start.map((a, i) => Math.round(a + (end[i] - a) * v)).join(",")})`;
}
export function initInterface() {
  // Deterministic teaching values, not exported model activations or weights.
  const svg = document.querySelector("#interface-diagram");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 800px)");
  let stage = 0,
    head = 0,
    selected = 81,
    progress = 1,
    raf = 0,
    geometry,
    phase = -1;
  const ease = (v) => {
    const x = clamp(v);
    return x * x * (3 - 2 * x);
  };
  const range = (p, a, b) => ease((p - a) / (b - a));
  const mix = (a, b, t) => a + (b - a) * t;
  const el = (tag, attrs = {}, parent = svg) => {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.append(n);
    return n;
  };
  const label = (cls, parent = svg) =>
    el("text", { class: cls, "text-anchor": "middle" }, parent);
  const place = (n, x, y, s) => {
    n.setAttribute("x", x);
    n.setAttribute("y", y);
    if (s !== undefined && n.textContent !== s) n.textContent = s;
  };
  const details = [
    "A fixed bilinear interpolation converts 256 source tokens into 196 target-grid positions. Follow four neighboring source values into the selected target. The channel dimension stays 192.",
    "Queries come from Q₀ plus target positions. Keys and values come from the original source tokens. The selected head gathers a weighted mixture across all 256 source tokens.",
    "Two attention heads of width 32 feed an output projection. Its correction is added to Q₀. The projection starts at zero during training, preserving the bilinear base at initialization.",
    "A 192 → 256 → 384 channel MLP and inverse calibration transform restore the receiver’s native visual features. The 14 × 14 spatial grid stays fixed.",
  ];
  const equations = [
    "Q₀ = Bilinear(X)   ·   16 × 16 → 14 × 14",
    "Q = (Q₀ + Pᵦ)Wq   ·   K = (X + Pₐ)Wk   ·   V = XWv",
    "Y = Q₀ + Concat(A₁, A₂)Wₒ",
    "T(X) = Sᵦ⁻¹( MLP(Y) )",
  ];
  const phases = [
    [
      "Locate four neighbors",
      "Compute bilinear weights",
      "Gather weighted values",
      "Populate the target grid",
    ],
    [
      "Build the target query",
      "Normalize source weights",
      "Gather source values",
      "Read the weighted mixture",
    ],
    [
      "Retain the bilinear base",
      "Combine both attention heads",
      "Project the correction",
      "Add the residual to Q₀",
    ],
    [
      "Keep 196 spatial positions",
      "Project 192 → 256 channels",
      "Project 256 → 384 channels",
      "Restore receiver scale",
    ],
  ];
  function compute(id) {
    const tx = id % 14,
      ty = Math.floor(id / 14),
      sx = clamp(((tx + 0.5) * 16) / 14 - 0.5, 0, 15),
      sy = clamp(((ty + 0.5) * 16) / 14 - 0.5, 0, 15);
    const x0 = Math.floor(sx),
      y0 = Math.floor(sy),
      dx = sx - x0,
      dy = sy - y0;
    const neighbors = [
      [x0, y0, (1 - dx) * (1 - dy)],
      [Math.min(15, x0 + 1), y0, dx * (1 - dy)],
      [x0, Math.min(15, y0 + 1), (1 - dx) * dy],
      [Math.min(15, x0 + 1), Math.min(15, y0 + 1), dx * dy],
    ].map(([x, y, w]) => ({
      i: y * 16 + x,
      x,
      y,
      w,
      value: sourceValue(x, y),
    }));
    const heads = [0, 1].map((h) => {
      const weights = Array.from({ length: 256 }, (_, i) => {
        const dx = (i % 16) - sx + (h ? 0.8 : 0),
          dy = Math.floor(i / 16) - sy + (h ? -0.6 : 0);
        return Math.exp(-(dx * dx + dy * dy) / (h ? 12 : 4));
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      weights.forEach((w, i) => (weights[i] = w / sum));
      return {
        weights,
        value: weights.reduce(
          (a, w, i) => a + w * sourceValue(i % 16, Math.floor(i / 16)),
          0,
        ),
      };
    });
    const base = bilinear(sx, sy),
      delta = 0.18 * heads[0].value - 0.12 * heads[1].value;
    return { tx, ty, sx, sy, neighbors, heads, base, delta };
  }
  const values = Array.from({ length: 196 }, (_, i) => compute(i));
  svg.replaceChildren();
  svg.setAttribute("role", "group");
  svg.setAttribute("tabindex", "0");
  svg.setAttribute(
    "aria-label",
    "Interface teaching computation. Click a target token or use arrow keys to select one.",
  );
  const sourceTitle = label("node-title"),
    sourceSub = label("node-small"),
    targetTitle = label("node-title"),
    targetSub = label("node-small");
  const sourceLayer = el("g", { "aria-hidden": "true" }),
    targetLayer = el("g");
  const sourceCells = Array.from({ length: 256 }, (_, i) =>
    el("rect", { rx: 2, "data-source": i }, sourceLayer),
  );
  const targetCells = Array.from({ length: 196 }, (_, i) => {
    const n = el(
      "rect",
      { rx: 2, class: "token", "data-token": i },
      targetLayer,
    );
    el("title", {}, n).textContent =
      `Target (${i % 14}, ${Math.floor(i / 14)})`;
    return n;
  });
  const routesLayer = el("g", {
    class: "interface-routes",
    "aria-hidden": "true",
  });
  const routes = Array.from({ length: 8 }, () => ({
    line: el("path", { fill: "none", stroke: P }, routesLayer),
    packet: el("circle", { r: 3.3, fill: D }, routesLayer),
  }));
  const selection = el("rect", {
    rx: 4,
    fill: "none",
    stroke: D,
    "stroke-width": 2,
    class: "interface-selection",
  });
  const processLayer = el("g", { "aria-hidden": "true" });
  const headGlyphs = [0, 1].map(() => ({
    box: el(
      "rect",
      { width: 54, height: 30, rx: 5, fill: "#29243e", stroke: P },
      processLayer,
    ),
    label: label("interface-metric", processLayer),
    line: el(
      "path",
      { fill: "none", stroke: P, "stroke-width": 1.5 },
      processLayer,
    ),
    packet: el("circle", { r: 4, fill: D }, processLayer),
  }));
  const channelGlyphs = [0, 1, 2].map(() => ({
    bars: Array.from({ length: 12 }, () =>
      el("rect", { width: 28, height: 3, rx: 1, fill: T }, processLayer),
    ),
    label: label("interface-tiny", processLayer),
  }));
  const sourceCaption = label("node-small"),
    targetCaption = label("diagram-label"),
    operation = label("interface-operation"),
    operationSub = label("interface-tiny");
  const opLine = el("path", {
    fill: "none",
    stroke: P,
    "stroke-width": 1.5,
    opacity: 0.5,
  });
  const inspector = el("g", { class: "interface-inspector" }),
    panel = el("rect", { rx: 12, class: "interface-panel" }, inspector);
  const phaseLabel = label("interface-phase", inspector),
    readout = label("interface-readout", inspector),
    note = label("interface-note", inspector);
  const bars = Array.from({ length: 4 }, () => ({
    bg: el("rect", { rx: 3, fill: "#272434" }, inspector),
    fill: el("rect", { rx: 3, fill: P }, inspector),
    top: label("interface-metric", inspector),
    bottom: label("interface-tiny", inspector),
  }));
  const progressTrack = el(
      "rect",
      { height: 2, rx: 1, fill: "#363141" },
      inspector,
    ),
    progressLine = el("rect", { height: 2, rx: 1, fill: P }, inspector);
  function layout() {
    const compact = mobile.matches;
    geometry = compact
      ? {
          ax: 76,
          ay: 53,
          ac: 13,
          bx: 89,
          by: 348,
          bc: 13,
          w: 360,
          h: 740,
          panelY: 565,
          panelH: 169,
        }
      : {
          ax: 44,
          ay: 70,
          ac: 15,
          bx: 482,
          by: 85,
          bc: 15,
          w: 760,
          h: 480,
          panelY: 340,
          panelH: 132,
        };
    const g = geometry;
    svg.setAttribute("viewBox", `0 0 ${g.w} ${g.h}`);
    place(
      sourceTitle,
      compact ? 180 : 163,
      compact ? 20 : 24,
      "Source tokens X",
    );
    place(
      sourceSub,
      compact ? 180 : 163,
      compact ? 39 : 45,
      "16 × 16 · 192 channels",
    );
    place(targetTitle, compact ? 180 : 586, compact ? 315 : 24);
    place(targetSub, compact ? 180 : 586, compact ? 335 : 45);
    for (const [cells, x, y, c, n] of [
      [sourceCells, g.ax, g.ay, g.ac, 16],
      [targetCells, g.bx, g.by, g.bc, 14],
    ])
      cells.forEach((el, i) => {
        el.setAttribute("x", x + (i % n) * c);
        el.setAttribute("y", y + Math.floor(i / n) * c);
        el.setAttribute("width", c - 2);
        el.setAttribute("height", c - 2);
      });
    place(sourceCaption, compact ? 180 : 163, compact ? 279 : 326);
    place(targetCaption, compact ? 180 : 586, compact ? 550 : 326);
    place(operation, compact ? 180 : 384, compact ? 296 : 251);
    place(operationSub, compact ? 180 : 384, compact ? 0 : 273);
    operationSub.style.display = compact ? "none" : "";
    opLine.setAttribute(
      "d",
      compact ? "M180 301 V307" : "M306 290 H458 M450 286 L458 290 L450 294",
    );
    for (const [k, v] of Object.entries({
      x: compact ? 6 : 18,
      y: g.panelY,
      width: g.w - (compact ? 12 : 36),
      height: g.panelH,
    }))
      panel.setAttribute(k, v);
    place(phaseLabel, g.w / 2, g.panelY + 23);
    place(readout, g.w / 2, g.panelY + (compact ? 120 : 95));
    place(note, g.w / 2, g.panelY + (compact ? 145 : 115));
    for (const n of [progressTrack, progressLine]) {
      n.setAttribute("x", compact ? 19 : 34);
      n.setAttribute("y", g.panelY + g.panelH - 7);
    }
    progressTrack.setAttribute("width", g.w - (compact ? 38 : 68));
    render();
  }
  function render() {
    if (!geometry) return;
    const g = geometry,
      compact = mobile.matches,
      p = reduced.matches ? 1 : progress,
      trace = values[selected],
      currentPhase = Math.min(3, Math.floor(p * 4));
    svg.dataset.stage = stage;
    svg.dataset.progress = progress.toFixed(4);
    svg.dataset.selected = selected;
    if (phase !== currentPhase) {
      phase = currentPhase;
      phaseLabel.textContent = `0${stage + 1} / ${phases[stage][phase]}`;
    }
    const attention = trace.heads[head],
      maxWeight = Math.max(...attention.weights),
      gather = range(p, 0.28, 0.78),
      residual = range(p, 0.45, 0.85),
      restore = range(p, 0.38, 0.88);
    const selectedSources = new Map(trace.neighbors.map((n) => [n.i, n.w]));
    sourceCells.forEach((n, i) => {
      const weight = attention.weights[i] / maxWeight;
      n.setAttribute(
        "fill",
        color(
          stage === 1
            ? mix(
                sourceValue(i % 16, Math.floor(i / 16)),
                weight,
                range(p, 0.08, 0.34),
              )
            : sourceValue(i % 16, Math.floor(i / 16)),
        ),
      );
      n.setAttribute(
        "opacity",
        stage === 0
          ? selectedSources.has(i)
            ? 1
            : 0.35
          : stage === 2 || stage === 3
            ? 0.52
            : 1,
      );
      n.setAttribute(
        "stroke",
        stage === 0 && selectedSources.has(i) ? D : "none",
      );
      n.setAttribute("stroke-width", 1.3);
    });
    targetCells.forEach((n, i) => {
      const v = values[i],
        amount = stage === 2 ? residual : stage === 3 ? 1 : 0,
        wave =
          stage === 0
            ? range(
                p,
                0.3 + (((i % 14) + Math.floor(i / 14)) / 26) * 0.42,
                0.55 + (((i % 14) + Math.floor(i / 14)) / 26) * 0.42,
              )
            : 1;
      const teal =
          stage === 3
            ? range(
                p,
                0.35 + ((i % 14) / 14) * 0.25,
                0.65 + ((i % 14) / 14) * 0.25,
              )
            : 0,
        scalar = clamp(v.base + v.delta * amount);
      const from = [32 + 130 * scalar, 30 + 126 * scalar, 46 + 209 * scalar],
        to = [32 + 72 * scalar, 30 + 167 * scalar, 46 + 134 * scalar];
      n.setAttribute(
        "fill",
        `rgb(${from.map((a, j) => Math.round(mix(a, to[j], teal))).join(",")})`,
      );
      n.setAttribute(
        "opacity",
        i === selected ? Math.max(0.35, gather) : 0.18 + 0.82 * wave,
      );
    });
    const px = g.bx + trace.tx * g.bc + (g.bc - 2) / 2,
      py = g.by + trace.ty * g.bc + (g.bc - 2) / 2;
    selection.setAttribute("x", px - g.bc / 2 - 1);
    selection.setAttribute("y", py - g.bc / 2 - 1);
    selection.setAttribute("width", g.bc + 2);
    selection.setAttribute("height", g.bc + 2);
    const largest = attention.weights
        .map((w, i) => ({ i, w }))
        .sort((a, b) => b.w - a.w)
        .slice(0, 8),
      contributions =
        stage === 0 ? trace.neighbors : stage === 1 ? largest : [];
    routes.forEach((r, j) => {
      const item = contributions[j];
      r.line.style.display = r.packet.style.display = item ? "" : "none";
      if (!item) return;
      const a = [
          g.ax + (item.i % 16) * g.ac + (g.ac - 2) / 2,
          g.ay + Math.floor(item.i / 16) * g.ac + (g.ac - 2) / 2,
        ],
        b = [px, py],
        c = compact ? [25 + j * 5, (a[1] + py) / 2] : [375, 100 + j * 14];
      r.line.setAttribute("d", `M${a} Q${c} ${b}`);
      r.line.setAttribute(
        "stroke-opacity",
        (stage === 0
          ? 0.2 + 0.65 * item.w
          : 0.12 + (0.4 * item.w) / maxWeight) * range(p, 0.08, 0.27),
      );
      r.line.setAttribute(
        "stroke-width",
        stage === 0 ? 1 + item.w * 2 : 0.8 + item.w / maxWeight,
      );
      const travel = clamp((p - 0.28 - j * 0.025) / 0.36),
        t = ease(travel),
        pt = [
          mix(mix(a[0], c[0], t), mix(c[0], b[0], t), t),
          mix(mix(a[1], c[1], t), mix(c[1], b[1], t), t),
        ];
      r.packet.setAttribute("cx", pt[0]);
      r.packet.setAttribute("cy", pt[1]);
      r.packet.setAttribute(
        "r",
        stage === 0 ? 2.5 + item.w * 3 : 2 + (item.w / maxWeight) * 2,
      );
      r.packet.setAttribute(
        "opacity",
        !reduced.matches && travel > 0 && travel < 1 ? 1 : 0,
      );
    });
    // Residual messages and channel expansion keep the selected token fixed.
    processLayer.style.display = compact ? "none" : "";
    headGlyphs.forEach((h, j) => {
      const show = stage === 2,
        x = 350,
        y = 118 + j * 61;
      for (const n of Object.values(h)) n.style.display = show ? "" : "none";
      if (!show) return;
      h.box.setAttribute("x", x);
      h.box.setAttribute("y", y);
      place(h.label, x + 27, y + 20, `A${j ? "₂" : "₁"}`);
      h.box.setAttribute(
        "opacity",
        0.25 + 0.75 * range(p, 0.1 + j * 0.1, 0.3 + j * 0.1),
      );
      h.line.setAttribute(
        "d",
        `M${x + 54} ${y + 15} Q450 ${y + 15} ${px} ${py}`,
      );
      h.line.setAttribute("opacity", range(p, 0.25, 0.5) * 0.6);
      const t = range(p, 0.38 + j * 0.08, 0.75 + j * 0.08),
        a = [x + 54, y + 15],
        c = [450, y + 15];
      h.packet.setAttribute("cx", mix(mix(a[0], c[0], t), mix(c[0], px, t), t));
      h.packet.setAttribute("cy", mix(mix(a[1], c[1], t), mix(c[1], py, t), t));
      h.packet.setAttribute(
        "opacity",
        !reduced.matches && t > 0 && t < 1 ? 1 : 0,
      );
    });
    channelGlyphs.forEach((stack, j) => {
      const show = stage === 3,
        x = 326 + j * 45,
        count = [6, 8, 12][j],
        reveal = range(p, j * 0.19, 0.25 + j * 0.19);
      stack.label.style.display = show ? "" : "none";
      place(stack.label, x + 14, 224, ["192", "256", "384"][j]);
      stack.bars.forEach((n, k) => {
        n.style.display = show && k < count ? "" : "none";
        n.setAttribute("x", x);
        n.setAttribute("y", 205 - k * 5);
        n.setAttribute("opacity", k / count < reveal ? 1 : 0.1);
      });
    });
    targetTitle.textContent = [
      "Target grid Q₀",
      "Target query · Q₀",
      "Residual target Y",
      "Receiver visual tokens",
    ][stage];
    targetSub.textContent =
      stage === 3
        ? `14 × 14 · ${p < 0.63 ? "192 → 384" : "384"} channels`
        : "14 × 14 · 192 channels";
    sourceCaption.textContent =
      stage === 1
        ? `Head ${head + 1} · weights sum to 1`
        : stage === 0
          ? "Four neighbors → one target"
          : "Original source tokens";
    targetCaption.textContent = `Selected token (${trace.tx}, ${trace.ty})`;
    operation.textContent = [
      "Bilinear",
      "Cross-attention",
      "+ residual",
      "Channel MLP",
    ][stage];
    operationSub.textContent = [
      "fixed weights",
      "2 heads · 32 each",
      "zero-initialized Wₒ",
      "192 → 256 → 384",
    ][stage];
    let metrics, valueText, noteText;
    if (stage === 0) {
      metrics = trace.neighbors.map((n) => ({
        top: `${n.w.toFixed(3)} × ${n.value.toFixed(3)}`,
        bottom: `Source (${n.x}, ${n.y})`,
        v: n.w,
      }));
      valueText = `Σ weight × value = ${trace.base.toFixed(3)}`;
      noteText = compact
        ? "Computed bilinear scalar · 192 channels kept"
        : "Computed bilinear scalar · four weights sum to 1 · 192 channels kept";
    } else if (stage === 1) {
      metrics = largest
        .slice(0, 4)
        .map((n) => ({
          top: `${(n.w * 100).toFixed(1)}%`,
          bottom: `Source (${n.i % 16}, ${Math.floor(n.i / 16)})`,
          v: n.w / maxWeight,
        }));
      valueText = `Σᵢ αᵢvᵢ = ${attention.value.toFixed(3)} · 256 sources`;
      noteText = compact
        ? "Illustrative head · 8 strongest links shown"
        : "Deterministic illustrative head · 8 strongest links shown; sum uses all 256";
    } else if (stage === 2) {
      metrics = [
        {
          top: trace.heads[0].value.toFixed(3),
          bottom: "Head 1 · A₁",
          v: trace.heads[0].value,
        },
        {
          top: trace.heads[1].value.toFixed(3),
          bottom: "Head 2 · A₂",
          v: trace.heads[1].value,
        },
        {
          top: `${trace.delta >= 0 ? "+" : ""}${trace.delta.toFixed(3)}`,
          bottom: "Projected Δ",
          v: residual,
        },
        {
          top: (trace.base + trace.delta).toFixed(3),
          bottom: "Q₀ + Δ",
          v: trace.base + trace.delta * residual,
        },
      ];
      valueText = `${trace.base.toFixed(3)} ${trace.delta < 0 ? "−" : "+"} ${Math.abs(trace.delta).toFixed(3)} = ${(trace.base + trace.delta).toFixed(3)}`;
      noteText = compact
        ? "Toy Δ = .18A₁ − .12A₂"
        : "Illustrative scalar projection: Δ = .18A₁ − .12A₂";
    } else {
      metrics = [
        { top: "192", bottom: "Input channels", v: 0.5 },
        {
          top: "256",
          bottom: "Hidden channels",
          v: (2 / 3) * range(p, 0.12, 0.43),
        },
        { top: "384", bottom: "Output channels", v: range(p, 0.4, 0.7) },
        { top: "Sᵦ⁻¹", bottom: "Receiver scale", v: restore },
      ];
      valueText = `196 tokens × 384 channels${p > 0.88 ? " · ready for Dynamics B" : ""}`;
      noteText = compact
        ? "Channel dimensions · color transition schematic"
        : "Actual channel dimensions · color transition schematic; learned values not shown";
    }
    const barW = compact ? 70 : 151,
      gap = compact ? 12 : 24,
      start = (g.w - (4 * barW + 3 * gap)) / 2;
    bars.forEach((b, j) => {
      const x = start + j * (barW + gap),
        y = g.panelY + (compact ? 66 : 55);
      for (const n of [b.bg, b.fill]) {
        n.setAttribute("x", x);
        n.setAttribute("y", y);
        n.setAttribute("height", 4);
      }
      b.bg.setAttribute("width", barW);
      b.fill.setAttribute("width", barW * clamp(metrics[j].v));
      b.fill.setAttribute("fill", stage === 3 ? T : P);
      b.top.setAttribute(
        "opacity",
        0.35 + 0.65 * range(p, 0.08 + j * 0.055, 0.25 + j * 0.055),
      );
      place(b.top, x + barW / 2, y - 7, metrics[j].top);
      place(b.bottom, x + barW / 2, y + 19, metrics[j].bottom);
    });
    readout.textContent = valueText;
    readout.setAttribute(
      "opacity",
      0.3 + 0.7 * (stage === 2 ? residual : stage === 3 ? restore : gather),
    );
    note.textContent = noteText;
    progressLine.setAttribute("width", (g.w - (compact ? 38 : 68)) * p);
    progressLine.setAttribute("fill", stage === 3 ? T : P);
  }
  function metadata() {
    document.querySelectorAll("#interface-steps button").forEach((b, i) => {
      b.classList.toggle("selected", i === stage);
      b.setAttribute("aria-pressed", i === stage);
    });
    document.querySelector("#interface-detail").textContent = details[stage];
    document.querySelector("#interface-equation").textContent =
      equations[stage];
    document.querySelector("#head-control").hidden = stage !== 1;
    phase = -1;
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function resume() {
    stop();
    if (reduced.matches) {
      progress = 1;
      render();
      return;
    }
    if (document.hidden || document.querySelector("#slide-interface").hidden)
      return;
    if (progress >= 1) progress = 0;
    const start = performance.now() - progress * 6000;
    function frame(now) {
      if (
        document.hidden ||
        document.querySelector("#slide-interface").hidden
      ) {
        stop();
        return;
      }
      progress = clamp((now - start) / 6000);
      render();
      if (progress < 1) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  function setStage(i) {
    stop();
    stage = Math.round(clamp(i, 0, 3));
    progress = 0;
    metadata();
    render();
    resume();
  }
  function setProgress(seconds) {
    stop();
    const t = clamp(seconds, 0, 24),
      next = Math.min(3, Math.floor(t / 6));
    if (stage !== next) {
      stage = next;
      metadata();
    }
    progress = t === 24 ? 1 : (t - stage * 6) / 6;
    render();
  }
  document
    .querySelectorAll("#interface-steps button")
    .forEach((b) => (b.onclick = () => setStage(+b.dataset.stage)));
  document.querySelector("#attention-head").onchange = (e) => {
    head = +e.target.value;
    progress = 0;
    render();
    resume();
  };
  svg.addEventListener("click", (e) => {
    const token = e.target.closest("[data-token]");
    if (!token) return;
    selected = +token.dataset.token;
    progress = 0;
    render();
    resume();
  });
  svg.addEventListener("keydown", (e) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -14, ArrowDown: 14 }[
      e.key
    ];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    selected = (selected + delta + 196) % 196;
    progress = 0;
    render();
    resume();
  });
  mobile.addEventListener("change", layout);
  reduced.addEventListener("change", () => {
    stop();
    render();
  });
  document.addEventListener("chapterchange", (e) => {
    if (e.detail !== "interface") stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  metadata();
  layout();
  return {
    setStage,
    setProgress,
    stop,
    resume,
    get state() {
      const trace = values[selected];
      return {
        stage,
        progress,
        phase,
        selected,
        head,
        animating: !!raf,
        base: trace.base,
        delta: trace.delta,
        bilinearWeightSum: trace.neighbors.reduce((a, n) => a + n.w, 0),
        attentionWeightSum: trace.heads[head].weights.reduce(
          (a, w) => a + w,
          0,
        ),
        weighted: trace.heads[head].value,
      };
    },
  };
}
