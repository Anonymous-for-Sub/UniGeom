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
  let stage = 0,
    head = 0,
    selected = 90;
  const svg = document.querySelector("#interface-diagram");
  const details = [
    "A fixed bilinear interpolation converts 256 source tokens into 196 target-grid positions. The channel dimension remains 192.",
    "Queries come from the resampled grid Q₀ plus target positions. Keys and values come from the original source tokens.",
    "A zero-initialized output projection adds a learned correction to Q₀. Two attention heads each have width 32.",
    "A 192 → 256 → 384 channel MLP and inverse calibration transform produce the receiver’s native visual features.",
  ];
  const equations = [
    "Q₀ = Bilinear(X)   ·   16 × 16 → 14 × 14",
    "Q = (Q₀ + Pᵦ)Wq   ·   K = (X + Pₐ)Wk   ·   V = XWv",
    "Y = Q₀ + Concat(A₁, A₂)Wₒ",
    "T(X) = Sᵦ⁻¹( MLP(Y) )",
  ];
  function render() {
    const ty = Math.floor(selected / 14),
      tx = selected % 14,
      sx = clamp(((tx + 0.5) * 16) / 14 - 0.5, 0, 15),
      sy = clamp(((ty + 0.5) * 16) / 14 - 0.5, 0, 15);
    const weights = [];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const dx = x - sx + (head ? 0.8 : 0),
          dy = y - sy + (head ? -0.6 : 0);
        weights.push(Math.exp(-(dx * dx + dy * dy) / (head ? 12 : 4)));
      }
    const total = weights.reduce((a, b) => a + b, 0);
    weights.forEach((v, i) => (weights[i] = v / total));
    const weighted = weights.reduce(
      (a, v, i) => a + v * sourceValue(i % 16, Math.floor(i / 16)),
      0,
    );
    const base = bilinear(sx, sy);
    document.querySelectorAll("#interface-steps button").forEach((b, i) => {
      b.classList.toggle("selected", i === stage);
      b.setAttribute("aria-pressed", i === stage);
    });
    document.querySelector("#interface-detail").textContent = details[stage];
    document.querySelector("#interface-equation").textContent =
      equations[stage];
    document.querySelector("#head-control").hidden = stage === 0;
    const compact = matchMedia("(max-width: 800px)").matches;
    svg.setAttribute("viewBox", compact ? "0 0 360 605" : "0 0 760 480");
    let out =
      arrow +
      text(
        compact ? 180 : 191,
        compact ? 25 : 60,
        "Source tokens X",
        "node-title",
      ) +
      text(compact ? 180 : 191, compact ? 45 : 82, "16 × 16 · 192 channels") +
      text(
        compact ? 180 : 573,
        compact ? 334 : 60,
        stage === 3
          ? "Receiver visual tokens"
          : stage === 2
            ? "Residual target Y"
            : "Target grid Q₀",
        "node-title",
      ) +
      text(
        compact ? 180 : 573,
        compact ? 354 : 82,
        stage === 3 ? "14 × 14 · 384 channels" : "14 × 14 · 192 channels",
      );
    const ax = compact ? 76 : 55,
      ay = compact ? 60 : 110,
      ac = compact ? 13 : 17,
      bx = compact ? 89 : 454,
      by = compact ? 368 : 124,
      bc = compact ? 13 : 17;
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x,
          v =
            stage === 1 ? weights[i] / Math.max(...weights) : sourceValue(x, y);
        out += `<rect x="${ax + x * ac}" y="${ay + y * ac}" width="${ac - 2}" height="${ac - 2}" rx="2" fill="${color(v)}"/>`;
      }
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 14; x++) {
        const id = y * 14 + x,
          v = bilinear(
            clamp(((x + 0.5) * 16) / 14 - 0.5, 0, 15),
            clamp(((y + 0.5) * 16) / 14 - 0.5, 0, 15),
          );
        out += `<rect class="token" data-token="${id}" x="${bx + x * bc}" y="${by + y * bc}" width="${bc - 2}" height="${bc - 2}" rx="2" fill="${color(v + (stage >= 2 ? 0.06 * Math.sin(x + y) : 0), stage === 3)}" stroke="${id === selected ? D : "none"}" stroke-width="3"/>`;
      }
    const px = bx + tx * bc + (bc - 2) / 2,
      py = by + ty * bc + (bc - 2) / 2;
    out +=
      path(compact ? "M180 291 V309" : "M343 237 H434", true) +
      text(
        compact ? 245 : 389,
        compact ? 305 : 214,
        stage === 0
          ? "Bilinear"
          : stage === 1
            ? "Attention"
            : stage === 2
              ? "+ residual"
              : "MLP",
        "diagram-label",
      );
    if (stage === 1) {
      const largest = weights
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 8);
      for (const { v, i } of largest)
        out += `<path d="M${ax + (i % 16) * ac + (ac - 2) / 2} ${ay + Math.floor(i / 16) * ac + (ac - 2) / 2} Q${compact ? "30 320" : "385 92"} ${px} ${py}" fill="none" stroke="${P}" stroke-opacity="${0.1 + (v / Math.max(...weights)) * 0.3}" stroke-width="1"/>`;
    }
    out +=
      text(
        compact ? 180 : 192,
        compact ? 285 : 411,
        stage === 1
          ? "Normalized attention weights"
          : "Illustrative feature values",
      ) +
      text(
        compact ? 180 : 572,
        compact ? 581 : 411,
        `Selected token (${tx}, ${ty})`,
        "diagram-label",
      );
    const readout =
      stage === 0
        ? `Bilinear value  ${base.toFixed(3)}`
        : stage === 1
          ? `Weighted source value  ${weighted.toFixed(3)}`
          : stage === 2
            ? "Stable base + learned spatial correction"
            : "Receiver scale restored before prediction";
    out += text(
      compact ? 180 : 380,
      compact ? 601 : 455,
      readout,
      "diagram-label",
    );
    svg.innerHTML = out
      .replaceAll('id="arrow"', 'id="interface-arrow"')
      .replaceAll("url(#arrow)", "url(#interface-arrow)");
    svg.querySelectorAll("[data-token]").forEach((el) => {
      el.onclick = () => {
        selected = +el.dataset.token;
        render();
      };
    });
  }
  document.querySelectorAll("#interface-steps button").forEach(
    (b) =>
      (b.onclick = () => {
        stage = +b.dataset.stage;
        render();
      }),
  );
  document.querySelector("#attention-head").onchange = (e) => {
    head = +e.target.value;
    render();
  };
  svg.setAttribute("tabindex", "0");
  svg.addEventListener("keydown", (e) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -14, ArrowDown: 14 }[
      e.key
    ];
    if (delta) {
      e.preventDefault();
      selected = (selected + delta + 196) % 196;
      render();
    }
  });
  matchMedia("(max-width: 800px)").addEventListener("change", render);
  render();
  return {
    setStage(i) {
      if (stage !== i) {
        stage = i;
        render();
      }
    },
  };
}
