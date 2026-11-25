export const frameworkSteps = [
  {
    title: "Paired-state calibration",
    description:
      "Both frozen encoders see the same observation. The interface T learns to map the source features to the receiver encoder’s target.",
  },
  {
    title: "Bilinear base",
    description:
      "Standardize the 16 × 16 source grid, then bilinearly resample it to 14 × 14. Each of the 196 receiver locations starts with a 192-channel query.",
  },
  {
    title: "Residual correction",
    description:
      "Two attention heads read the source tokens and add a learned correction to the bilinear base. A channel MLP maps each location to 384 channels, then restores the receiver scale.",
  },
  {
    title: "Frozen rollout",
    description:
      "The same interface maps history and goal. The frozen dynamics predict future latent states under candidate actions, and the receiver’s goal cost scores each prediction.",
  },
];

const NS = "http://www.w3.org/2000/svg";
let instance = 0;

function draw(prefix) {
  const id = (name) => prefix + name;
  let gridIndex = 0;
  const paint = (name) => "url(#" + id(name) + ")";
  const label = (x, y, content, cls = "label", anchor = "middle") =>
    `<text x="${x}" y="${y}" class="fw-${cls}" text-anchor="${anchor}">${content}</text>`;
  const group = (stages, content) =>
    `<g data-fw-stages="${stages}">${content}</g>`;
  const rect = (x, y, w, h, rx, cls) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="fw-${cls}"/>`;
  function flow(d, stages, color = "purple", arrow = true) {
    return group(
      stages,
      `<path d="${d}" class="fw-wire fw-${color}" ${arrow ? 'marker-end="' + paint("tip-" + color) + '"' : ""}/><path d="${d}" pathLength="100" class="fw-packet fw-${color}"/>`,
    );
  }
  function node(x, y, w, h, color, skew = 9) {
    return `<path d="M${x + skew} ${y} h${w - skew} l${-skew} ${h} h${skew - w} Z" class="fw-node fw-${color}"/>`;
  }
  function grid(x, y, w, h, n, color, layers = 1) {
    const shift = h * 0.34;
    const face = `M${shift} 0 H${w + shift} L${w} ${h} H0 Z`;
    const clipId = id("grid-clip-" + ++gridIndex);
    let rules = "";
    for (let i = 1; i < n; i++) {
      const px = (i * w) / n;
      const py = (i * h) / n;
      rules += `M${px + shift} 0 l${-shift} ${h} M${shift * (1 - i / n)} ${py} h${w} `;
    }
    return `<g class="fw-grid fw-${color}" transform="translate(${x} ${y})">${layers > 1 ? `<path d="${face}" transform="translate(5 -4)" class="fw-grid-back"/>` : ""}
      <path d="${face}" fill="${paint("grid-" + color)}" class="fw-grid-face"/><path d="${rules}" class="fw-grid-lines"/>
      <clipPath id="${clipId}"><path d="${face}"/></clipPath><g clip-path="url(#${clipId})"><path d="M${shift} 0 l${-shift} ${h}" class="fw-scan" style="--fw-scan-width:${w}px"/></g></g>`;
  }
  function observation(x, y, scale = 1, goal = false) {
    const point = goal ? "36 17 33 24 39 22" : "12 17 9 24 15 22";
    return `<g transform="translate(${x} ${y}) scale(${scale})"><rect width="62" height="32" rx="1.5" fill="#222a34" stroke="#9cacc1" stroke-width="1.5"/><path d="M3 2 H60 V30 H3 Z M32 2 V15 M32 22 V30" fill="none" stroke="#79899c" stroke-width="1.1"/><path d="M${point} Z" fill="#9dc6fa"/><path d="M49 5 l1.5 4.1 4.4.2-3.5 2.8 1.1 4.3-3.5-2.6-3.6 2.6 1.2-4.3-3.5-2.8 4.4-.2Z" fill="#f0bf78"/></g>`;
  }
  function lock(x, y) {
    return `<g transform="translate(${x} ${y})" fill="none" stroke="#a1c9c5" stroke-width="1.4"><path d="M2 6 V4a3 3 0 0 1 6 0v2"/><rect x="1" y="6" width="8" height="7" rx="1.4"/><path d="M5 8.5v2"/></g>`;
  }
  function plus(x, y) {
    return `<circle cx="${x}" cy="${y}" r="9" class="fw-junction"/><path d="M${x - 4} ${y}h8 M${x} ${y - 4}v8" class="fw-plus"/>`;
  }

  const markers = ["purple", "blue", "teal"]
    .map(
      (color) =>
        `<marker id="${id("tip-" + color)}" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" class="fw-tip fw-${color}"/></marker>`,
    )
    .join("");
  const gradients = [
    ["blue", "#293748", "#193140"],
    ["purple", "#443758", "#2f2d49"],
    ["teal", "#24423f", "#183833"],
  ]
    .map(
      ([name, start, end]) =>
        `<linearGradient id="${id("grid-" + name)}" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`,
    )
    .join("");
  const defs = `<defs>${markers}${gradients}<linearGradient id="${id("zoom")}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#aa98fa" stop-opacity=".29"/><stop offset="1" stop-color="#aa98fa" stop-opacity=".035"/></linearGradient></defs>`;

  const route = [
    group(
      "0 3",
      observation(25, 16, 0.75) +
        observation(41, 25, 0.75, true) +
        observation(24, 75, 0.83, true),
    ),
    flow("M92 42 H118", "0 3", "blue"),
    flow("M81 89 H107", "0 3", "blue"),
    group(
      "0 3",
      node(108, 24, 111, 75, "blue", 14) +
        label(162, 58, "Source", "module") +
        label(162, 76, "encoder", "module") +
        lock(189, 53),
    ),
    flow("M216 42 H244", "0 3"),
    flow("M207 89 H234", "0 3"),
    group(
      "0 1 2 3",
      node(234, 24, 95, 75, "purple", 12) +
        label(283, 57, "Interface", "module") +
        label(279, 83, "T", "symbol"),
    ),
    flow("M328 42 H485", "3", "teal"),
    label(404, 33, "History", "route"),
    flow("M320 89 H778", "3", "teal"),
    label(405, 80, "Goal", "route"),
    group(
      "3",
      node(472, 23, 167, 42, "teal", 15) +
        label(549, 49, "Frozen dynamics", "module") +
        lock(613, 36),
    ),
    group(
      "3",
      label(550, 12, "Actions", "route") + flow("M550 15 V23", "3", "teal"),
    ),
    group(
      "3",
      label(708, 47, "Predicted latent states", "route") +
        flow("M630 59 H752 Q761 59 767 66 L781 77", "3", "teal"),
    ),
    group(
      "3",
      rect(779, 66, 104, 37, 9, "cost") + label(831, 90, "Goal cost", "module"),
    ),
  ].join("");

  const detail = [
    `<path d="M246 99 H317 L501 142 H73 Z" fill="${paint("zoom")}"/>`,
    rect(7, 142, 886, 333, 15, "detail-bg"),
    label(25, 164, "Spatial interface T", "section", "start"),

    // The 256 input tokens form a 16 × 16 grid. All input tokens have 192 channels.
    group(
      "1",
      label(107, 184, "X", "symbol") +
        label(107, 201, "256 × 192", "shape") +
        grid(66, 213, 65, 44, 16, "blue", 2) +
        label(106, 277, "16 × 16", "shape"),
    ),
    group(
      "1",
      `<circle cx="32" cy="237" r="15" class="fw-junction"/>` +
        label(32, 242, "Sₐ", "math"),
    ),
    flow("M48 237 H71", "1", "blue"),
    flow("M140 237 H222", "1", "blue"),
    group(
      "1",
      label(181, 215, "Bilinear", "label") + label(181, 229, "base", "label"),
    ),
    group(
      "1 2",
      label(261, 184, "Q₀", "symbol") +
        label(261, 201, "196 × 192", "shape") +
        grid(219, 213, 65, 44, 14, "blue", 2) +
        label(259, 277, "14 × 14", "shape"),
    ),
    flow("M293 237 H456", "1 2", "blue"),
    group("2", plus(466, 237) + label(446, 217, "Y = Q₀ + ΔQ", "math")),
    flow("M476 237 H504", "2"),
    group(
      "2",
      label(545, 184, "Y", "symbol") +
        label(545, 201, "196 × 192", "shape") +
        grid(501, 213, 65, 44, 14, "purple", 2) +
        label(541, 277, "14 × 14", "shape"),
    ),
    flow("M576 237 H592", "2"),
    group(
      "2",
      label(641, 199, "Channel MLP", "module") +
        [0, 1, 2]
          .map(
            (i) =>
              node(586 + i * 33, 213, 40, 47, "purple", 12) +
              `<g transform="translate(${606 + i * 33} 237) rotate(-73)">${label(0, 3, ["Linear", "GELU", "Linear"][i], "chip")}</g>`,
          )
          .join("") +
        label(638, 277, "192 → 256 → 384", "shape"),
    ),
    flow("M685 237 H704", "2"),
    group(
      "2",
      rect(706, 223, 43, 28, 4, "scale") +
        label(727, 242, "Sᵦ⁻¹", "math") +
        label(729, 274, "Restore scale", "small"),
    ),
    flow("M750 237 H789", "2", "teal"),
    group(
      "2 3",
      label(831, 190, "Visual tokens", "module") +
        grid(784, 212, 69, 47, 14, "teal", 2) +
        label(829, 277, "14 × 14", "shape") +
        label(829, 293, "384 channels", "small"),
    ),

    // Queries branch from Q₀, keys and values from X. Fixed positions enter Q and K.
    flow(
      "M302 237 V282 Q302 287 296 287 H160 Q154 287 154 293 V336 H189",
      "2",
      "blue",
    ),
    flow("M80 257 V372 Q80 379 86 379 H189", "2", "blue"),
    flow("M80 368 V421 Q80 427 86 427 H231", "2", "blue"),
    group(
      "2",
      label(217, 316, "Pᵦ", "math") +
        grid(189, 303, 15, 11, 4, "blue") +
        flow("M198 316 V325", "2") +
        plus(198, 336) +
        label(217, 359, "Pₐ", "math") +
        grid(189, 348, 15, 11, 4, "blue") +
        flow("M198 361 V368", "2") +
        plus(198, 379),
    ),
    flow("M208 336 H231", "2"),
    flow("M208 379 H231", "2"),
    group(
      "2",
      [336, 379, 427]
        .map(
          (y, i) =>
            node(231, y - 12, 35, 24, "purple", 6) +
            label(249, y + 5, ["Q", "K", "V"][i], "math"),
        )
        .join(""),
    ),
    flow("M266 336 H278 Q283 336 283 341 V352 Q283 357 289 357 H298", "2"),
    flow("M266 379 H293", "2"),
    flow("M266 427 H282 Q288 427 288 421 V402 Q288 397 293 397 H298", "2"),
    group(
      "2",
      label(354, 309, "Cross-attention", "module") +
        label(354, 325, "196 × 256 · 2 heads × 32", "shape") +
        grid(303, 342, 86, 61, 10, "purple", 2) +
        rect(321, 361, 64, 18, 4, "grid-tag") +
        label(353, 374, "Schematic", "chip"),
    ),
    flow("M399 357 H420 Q425 357 429 364 L434 373", "2"),
    flow("M392 392 H419 Q425 392 429 386 L434 379", "2"),
    group(
      "2",
      label(424, 352, "H₁", "math") +
        label(414, 410, "H₂", "math") +
        `<circle cx="443" cy="376" r="10" class="fw-junction"/>` +
        label(443, 381, "Σ", "math"),
    ),
    flow("M454 376 H480", "2"),
    group(
      "2",
      node(481, 361, 43, 31, "purple", 7) +
        label(503, 382, "ΔQ", "math") +
        label(502, 410, "196 × 192", "shape"),
    ),
    flow("M524 376 H535 Q543 376 543 368 V347", "2"),
    group(
      "2",
      grid(520, 313, 38, 30, 8, "purple") + label(542, 302, "14 × 14", "shape"),
    ),
    flow("M523 326 H474 Q466 326 466 318 V248", "2"),
    group("2", label(353, 422, "Zero-init projection", "small")),
  ].join("");

  const calibration = group(
    "0",
    [
      rect(583, 316, 292, 139, 12, "inset"),
      label(600, 337, "Paired state calibration", "section", "start"),
      observation(601, 372, 0.8, true),
      flow(
        "M652 384 H659 Q664 384 664 378 V366 Q664 361 669 361 H685",
        "0",
        "blue",
      ),
      flow(
        "M652 384 H659 Q664 384 664 390 V408 Q664 413 669 413 H685",
        "0",
        "teal",
      ),
      node(685, 348, 55, 27, "blue", 7),
      label(706, 366, "Eₐ", "math"),
      lock(721, 354),
      node(685, 400, 55, 27, "teal", 7),
      label(706, 419, "Eᵦ", "math"),
      lock(721, 406),
      flow("M738 361 H762", "0"),
      node(763, 348, 40, 27, "purple", 7),
      label(783, 367, "T", "math"),
      flow("M802 361 H829 Q836 361 836 369 V375", "0"),
      flow("M738 413 H829 Q836 413 836 404 V398", "0", "teal"),
      `<circle cx="836" cy="387" r="12" class="fw-junction"/>`,
      label(836, 392, "ℒ", "math"),
    ].join(""),
  );
  return defs + route + detail + calibration;
}

export function initFramework(container, { onStep } = {}) {
  const svgContainer = container.namespaceURI === NS;
  const svg = svgContainer ? container : document.createElementNS(NS, "svg");
  const prefix = `uni-framework-${++instance}-`;
  svg.classList.add("native-framework");
  svg.setAttribute("viewBox", "0 0 900 483");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-labelledby",
    prefix + "title " + prefix + "description",
  );
  svg.innerHTML =
    `<title id="${prefix}title">UniGeom perception-to-dynamics framework</title><desc id="${prefix}description">The upper path carries history and goal through the same source encoder and learned interface. The expanded adapter below combines bilinear resampling, residual cross-attention and a channel MLP. The inset shows calibration on paired encoder states.</desc>` +
    draw(prefix);
  if (!svgContainer) {
    container.classList.add("native-framework-viewport");
    container.replaceChildren(svg);
  }
  const groups = Array.from(svg.querySelectorAll("[data-fw-stages]"));
  let current = -1;
  function alignStage() {
    if (svgContainer || !container.clientWidth) return;
    const overflow = container.scrollWidth > container.clientWidth;
    if (overflow) {
      const centers = [0.81, 0.21, 0.43, 0.78];
      container.scrollLeft =
        svg.clientWidth * centers[current] - container.clientWidth / 2;
      const heights = [0.81, 0.46, 0.77, 0.12];
      container.scrollTop =
        svg.clientHeight * heights[current] - container.clientHeight / 2;
      container.tabIndex = 0;
      container.setAttribute("role", "region");
      container.setAttribute(
        "aria-label",
        "Framework diagram, scroll to explore",
      );
    } else {
      container.removeAttribute("tabindex");
    }
  }
  function setStep(index) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= frameworkSteps.length ||
      current === index
    )
      return;
    current = index;
    svg.dataset.frameworkStep = String(index);
    for (const group of groups) {
      group.classList.toggle(
        "fw-active",
        group.dataset.fwStages.split(" ").includes(String(index)),
      );
    }
    alignStage();
    onStep?.(index, frameworkSteps[index]);
  }
  function stop() {
    svg.classList.add("fw-paused");
  }
  function resume() {
    svg.classList.remove("fw-paused");
  }
  function replay() {
    for (const animation of svg.getAnimations({ subtree: true })) {
      if (
        animation.animationName === "fw-flow" ||
        animation.animationName === "fw-scan"
      )
        animation.currentTime = 0;
    }
    resume();
  }
  setStep(0);
  // The slide can initially be hidden; align the mobile viewport when it becomes visible.
  if (!svgContainer && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(alignStage).observe(container);
  }
  return { setStep, replay, stop, resume };
}
