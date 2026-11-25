import { initApplication } from "./application.js?v=20261126g";
import { initFramework, frameworkSteps } from "./framework.js?v=20261126g";
import { GeometryView } from "./geometry.js?v=20261126g";
import { initInterface } from "./diagrams.js?v=20261126g";
const $ = (s) => document.querySelector(s);

function tabKeys(container, selector) {
  container.addEventListener("keydown", (e) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    const buttons = [...container.querySelectorAll(selector)],
      i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : (i +
              (["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : -1) +
              buttons.length) %
            buttons.length;
    buttons[j].click();
    buttons[j].focus();
  });
}

tabKeys($(".experiment-list"), "button");
const connection = initFramework($("#framework-diagram"), {
  onStep(index) {
    $("#connection-detail").textContent = frameworkSteps[index].description;
    document.querySelectorAll("#connection-steps button").forEach((b, i) => {
      b.classList.toggle("selected", i === index);
      b.setAttribute("aria-pressed", i === index);
    });
  },
});
window.frameworkView = connection;
document.querySelectorAll("#connection-steps button").forEach(
  (b) =>
    (b.onclick = () => {
      connection.setStep(+b.dataset.step);
      connection.resume();
    }),
);
$("#play-connection").onclick = () => connection.replay();
const spatialInterface = initInterface();
fetch("assets/data/geometry.json")
  .then((r) => {
    if (!r.ok) throw new Error("Geometry data unavailable");
    return r.json();
  })
  .then((data) => {
    window.geometryView = new GeometryView(data);
    window.dispatchEvent(new Event("geometryready"));
    document.addEventListener("chapterchange", () =>
      window.geometryView.render(),
    );
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !window.deck?.pausedExplicitly)
        window.geometryView.startHero();
    });
  })
  .catch(() => {
    $("#geometry-error").hidden = false;
    $("#geometry-error").textContent =
      "The geometry data could not load. Refresh this page to try again.";
    $("#query-overlap").textContent = "Unavailable";
  });

const studies = {
  navigation: {
    cohort: "64 tasks · 3 learned-interface seeds",
    description:
      "MAE replaces LeWM perception in TwoRooms. Spatial and matched pooled use 1,000 updates; compute-matched pooling uses 4,904. Native and ridge use one route per task.",
    insight:
      "The spatial interface retains 97.44% of native terminal successes, with 79.17% terminal success overall.",
    note: "Pooling uses a matched parameter and update budget. Compute-matched pooling receives more updates. Retention counts paired native-success outcomes.",
    names: {
      native: "Native",
      ridge: "Ridge",
      pooled: "Pooled",
      spatial: "Spatial",
      "pooled-compute": "Pooled · compute",
    },
    emphasis: "spatial",
  },
  spatial: {
    cohort: "96 tasks · 3 interface seeds",
    description:
      "LeWM features enter the complete DINO-WM predictor. Fixed, convolution and attention interfaces share parameter and update budgets.",
    insight:
      "Residual attention adds 9.38 percentage points over fixed resampling; the paired 95% interval is [2.78, 16.32].",
    note: "Pose success on reachable short-push tasks. Post-hoc repeat-last and mean-past-five action controls reach 100%; zero actions reach 0%.",
    names: {
      native: "Native",
      self: "Self-interface",
      fixed: "Fixed",
      convolution: "Convolution",
      attention: "Attention",
    },
    emphasis: "attention",
  },
  second_source: {
    cohort: "96 tasks · 3 interface seeds",
    description:
      "MAE supplies a different representation to the same DINO-WM receiver. The grid, source and task cohort differ from the LeWM experiment.",
    insight:
      "Convolution reaches 78.13% pose success. Its advantage over attention is 7.64 points [1.74, 13.54], showing that interface choice depends on the connection.",
    note: "These intervals describe post-hoc comparisons. Simple-action controls also reach 100% on this cohort. The gain over fixed resampling remains uncertain.",
    names: {
      native: "Native",
      self: "Self-interface",
      fixed: "Fixed",
      convolution: "Convolution",
      attention: "Attention",
    },
    emphasis: "convolution",
  },
  brightness: {
    cohort: "64 tasks · 3 interface seeds",
    description:
      "Images are multiplied by 0.9 before preprocessing. Clean-only and mixed clean/dim continuation use the same 1,000-update budget.",
    insight:
      "Mixed-view calibration recovers 59.38% pose success under dimmed observations; native perception reaches 98.44%.",
    note: "The interface learns from both clean and dimmed observations during recalibration. Evaluation uses a separate 64-task cohort.",
    names: { native: "Native", clean: "Clean only", mixed: "Mixed views" },
    emphasis: "mixed",
  },
};
let results = [];
function renderResults() {
  if (!results.length) return;
  const study = $("#results-study").value,
    metric = $("#results-metric").value,
    s = studies[study],
    root = $("#results-chart");
  const title = $("#results-metric").selectedOptions[0].textContent;
  $("#chart-title").textContent = title;
  $("#chart-cohort").textContent = s.cohort;
  $("#results-context").textContent = s.description;
  $("#result-insight").textContent = s.insight;
  $("#results-note").textContent = s.note;
  root.replaceChildren();
  const rows = Object.entries(s.names).map(([key, name]) => ({
    ...results.find((r) => r.study === study && r.method === key),
    label: name,
  }));
  root.setAttribute(
    "aria-label",
    rows.map((r) => `${r.label} ${r[metric].toFixed(2)} percent`).join("; "),
  );
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = `bar-row ${row.method === s.emphasis ? "emphasis" : ""}`;
    const color =
      row.method === "native"
        ? "#68c5b4"
        : row.method === "self"
          ? "#8caea8"
          : row.method === s.emphasis
            ? "#a29cff"
            : "#676579";
    div.innerHTML = `<span class="bar-label">${row.label}</span><div class="bar-track"><div class="bar-fill" style="--value:${row[metric]}%;--bar-color:${color}"></div></div><span class="bar-value">${row[metric].toFixed(2)}</span>`;
    root.append(div);
  }
  const scale = document.createElement("div");
  scale.className = "bar-scale";
  scale.innerHTML =
    "<span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span>";
  root.append(scale);
}
fetch("assets/data/results.json")
  .then((r) => {
    if (!r.ok) throw new Error("Result data unavailable");
    return r.json();
  })
  .then((data) => {
    results = data;
    renderResults();
  })
  .catch(() => {
    $("#results-chart").textContent =
      "The result data could not load. Please refresh the page.";
  });
$("#results-study").onchange = renderResults;
$("#results-metric").onchange = renderResults;

const cases = [
  {
    file: "01_navigation",
    title: "Navigation with a frozen LeWM receiver",
    description:
      "A spatial interface replaces ridge while the LeWM receiver and controller stay frozen.",
    metric: "102.0 <span>→</span> 1.3 <small>px</small>",
    label: "Final distance to goal ↓",
    note: "Selected task 3129 · interface seed 0 · 51 recorded states. Both routes start from the same state and goal.",
  },
  {
    file: "02_spatial_interface",
    title: "Make spatial features usable.",
    description:
      "Residual attention refines the fixed resampling interface from LeWM to DINO-WM.",
    metric: "41.9 <span>→</span> 79.3 <small>%</small>",
    label: "Target overlap ↑",
    note: "Selected task 27 · interface seed 0 · 25 active and 25 holding steps. The green T marks the supplied target pose.",
  },
  {
    file: "03_mae_spatial_interface",
    title: "Adapt the interface to the source.",
    description:
      "A convolution residual improves this MAE-to-DINO-WM execution over fixed resampling.",
    metric: "57.1 <span>→</span> 84.9 <small>%</small>",
    label: "Target overlap ↑",
    note: "Selected task 78 · interface seed 0 · matched initial state, goal and controller. Target overlap and pose success are separate metrics.",
  },
  {
    file: "04_brightness_recalibration",
    title: "Recover control in a changed view.",
    description:
      "Matched-budget mixed-view calibration reconnects dimmed perception to the existing receiver.",
    metric: "13.8 <span>→</span> 90.5 <small>%</small>",
    label: "Target overlap ↑",
    note: "Selected task 41 · interface seed 0 · 0.9 RGB multiplier. Clean and mixed routes use the same continuation-update budget.",
  },
  {
    file: "05_recurrent_control",
    title: "Reacher with a frozen Dreamer receiver",
    description:
      "Mapped LeWM features feed Dreamer’s frozen observation update, recurrent dynamics and actor.",
    metric: "13 <span>→</span> 813",
    label: "Ridge → UniGeom return ↑",
    note: "Selected development reset 7006 · seed 0 · native return 982. The paper separately reports 32 fresh-reset confirmation results.",
  },
];
let activeCase = -1;
function showCase(i) {
  window.paperViews?.showExperimentVideo();
  activeCase = i;
  const c = cases[i],
    v = $("#case-video");
  v.pause();
  v.src = `assets/videos/${c.file}.mp4`;
  v.poster = `assets/videos/${c.file}.png`;
  v.setAttribute("aria-label", c.title);
  v.load();
  $("#case-title").textContent = c.title;
  $("#case-description").textContent = c.description;
  $("#case-metric").innerHTML = c.metric;
  $("#case-metric-label").textContent = c.label;
  $("#case-note").textContent = c.note;
  document.querySelectorAll("[data-case]").forEach((b, j) => {
    b.classList.toggle("active", i === j);
    b.setAttribute("aria-selected", i === j);
    b.tabIndex = i === j ? 0 : -1;
  });
}
document
  .querySelectorAll("[data-case]")
  .forEach((b) => (b.onclick = () => showCase(+b.dataset.case)));
showCase(0);
new IntersectionObserver(
  ([e]) => {
    if (!e.isIntersecting) $("#case-video").pause();
  },
  { threshold: 0 },
).observe($("#case-video"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) $("#case-video").pause();
});
import { initDeck } from "./deck.js?v=20261126g";
import { initPaperViews } from "./paper-views.js?v=20261126g";
const paperViews = initPaperViews();
window.paperViews = paperViews;
const application = initApplication();
window.applicationScene = application;
initDeck({
  application,
  paperViews,
  connection,
  spatialInterface,
  showCase,
  getActiveCase: () => activeCase,
  setStudy(name) {
    $("#results-study").value = name;
    paperViews.setResultView("cohorts");
    renderResults();
  },
});
