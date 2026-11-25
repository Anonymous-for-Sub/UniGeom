import { initCalibration } from "./calibration.js?v=20261126g";
const $ = (s) => document.querySelector(s);
const descriptions = [
  {
    title: "Two encoders, two coordinate systems.",
    text: "The same 606 observations pass through two independent encoders. Each point keeps its identity in both spaces. Rotate the view or select an observation to follow it across the two models.",
  },
  {
    title: "Find the same neighborhood in both spaces.",
    text: "Around the selected observation, each encoder retrieves ten neighbors in its original 192D features. Shared neighbors light up in both clouds; the links follow the same observation across them.",
  },
  {
    title: "Connect the local neighborhoods.",
    text: "Keep the two spaces in view as more shared neighborhoods appear. Their coordinates differ, but several local relationships recur. Choose another model pair to see how much of this structure persists.",
  },
];
export function initPaperViews() {
  const calibration = initCalibration();
  let figures = [],
    step = 0,
    resultView = "cohorts",
    experimentFigure = null;
  const dialog = $("#figure-viewer");
  const get = (id) => figures.find((f) => f.id === id);
  const path = (f) => `assets/paper-figures/dark-${f.file}`;
  function selectGeometry(index) {
    step = Math.max(0, Math.min(2, index));
    $("#geometry-heading").textContent = descriptions[step].title;
    $("#geometry-description").textContent = descriptions[step].text;
    $(".geometry-stage").dataset.geometryPhase = String(step);
    document.querySelectorAll("[data-geometry-step]").forEach((b) => {
      b.classList.toggle("selected", +b.dataset.geometryStep === step);
      b.setAttribute("aria-pressed", +b.dataset.geometryStep === step);
    });
    document
      .querySelectorAll("[data-geometry-detail]")
      .forEach((e) => (e.hidden = step !== 1));
    $("#geometry-cohort").hidden = step !== 2;
    $("#slide-geometry .chapter-copy>.footnote").hidden = step !== 0;
    $("#geometry-hint").textContent = [
      "Drag either space to rotate both. Select a point to follow the same observation.",
      "Purple points are shared neighbors. Select a point or thumbnail to inspect another neighborhood.",
      "Additional neighborhoods appear in the same two spaces. Drag to inspect; change the model pair to compare.",
    ][step];
    $("#geometry-legend").innerHTML =
      step === 0
        ? "606 observations in each space"
        : '<i class="legend-dot violet"></i> Shared neighbor <i class="legend-dot teal"></i> B only <i class="legend-dot sand"></i> A only';
    const view = window.geometryView;
    if (view && !$("#geometry-pair-summary").children.length) {
      view.data.pairs.forEach((p, i) => {
        const b = document.createElement("button");
        b.className = "pair-summary";
        b.innerHTML = `<span>Pair ${i + 1}</span><strong>${(p.mean * 100).toFixed(1)}%</strong>`;
        b.dataset.pair = i;
        b.onclick = () => {
          const select = $("#geometry-pair");
          select.value = String(i);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        $("#geometry-pair-summary").append(b);
      });
    }
    document.querySelectorAll(".pair-summary").forEach((b) => {
      b.classList.toggle("selected", +b.dataset.pair === view?.pair);
      b.setAttribute("aria-pressed", +b.dataset.pair === view?.pair);
    });
    window.geometryView?.setExplorationStep(step);
  }
  function zoom(value) {
    $("#viewer-image").style.width = value + "%";
    $("#viewer-image").style.height = value === 100 ? "100%" : "auto";
    $("#figure-zoom").setAttribute("aria-valuetext", value + " percent");
  }
  function openFigure(id) {
    const f = get(id);
    if (!f) return;
    window.deck?.pause();
    $("#viewer-title").textContent = f.title;
    $("#viewer-image").src = path(f);
    $("#viewer-image").alt = f.title;
    $("#figure-download").href = path(f);
    $("#viewer-caption").textContent = f.caption + " " + f.scope;
    $("#figure-zoom").value = "100";
    zoom(100);
    if (!dialog.open) dialog.showModal();
    $("#viewer-image-scroll").scrollTo(0, 0);
  }
  function fill(container, id) {
    const f = get(id);
    if (!f) return;
    const img = container.querySelector("img");
    img.src = path(f);
    img.alt = f.title;
    container.dataset.figure = id;
    container.querySelector("h3").textContent = f.title;
    container.querySelector(".evidence-caption").textContent = f.caption;
    container.querySelector(".evidence-scope").textContent = f.scope;
    container.querySelector("button").onclick = () => openFigure(id);
    container.classList.remove("evidence-enter");
    requestAnimationFrame(() => container.classList.add("evidence-enter"));
  }
  function setResultView(id) {
    resultView = id;
    $("#results-live").hidden = id !== "cohorts";
    $("#results-evidence").hidden = id !== "prediction-controls";
    calibration.setView(id);
    $("#slide-results .chapter-copy > p").textContent = {
      cohorts:
        "Compare complete evaluation cohorts. Every connected route uses the receiver’s existing prediction and control system.",
      "prediction-controls":
        "Two independently trained model pairs are connected in both directions. Compare the learned interface with native prediction, linear mapping, state copying and shuffled actions.",
      "learned-source":
        "A learned source and correct correspondence make calibration more effective. Explore both factors at the same four trajectory budgets.",
    }[id];
    document
      .querySelectorAll("[data-results-live]")
      .forEach((e) => (e.hidden = id !== "cohorts"));
    document.querySelectorAll("[data-result-view]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.resultView === id);
      b.setAttribute("aria-pressed", b.dataset.resultView === id);
    });
    if (id !== "cohorts") fill($("#results-evidence"), id);
  }
  function showExperimentVideo() {
    experimentFigure = null;
    $(".experiment-player").hidden = false;
    $("#experiments-evidence").hidden = true;
    document.querySelectorAll("[data-experiment-figure]").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
      b.tabIndex = -1;
    });
  }
  function selectExperimentFigure(id) {
    experimentFigure = id;
    $("#case-video").pause();
    $(".experiment-player").hidden = true;
    $("#experiments-evidence").hidden = false;
    document
      .querySelectorAll("[data-case],[data-experiment-figure]")
      .forEach((b) => {
        const active = b.dataset.experimentFigure === id;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active);
        b.tabIndex = active ? 0 : -1;
      });
    fill($("#experiments-evidence"), id);
  }
  document.querySelectorAll("[data-geometry-step]").forEach(
    (b) =>
      (b.onclick = () => {
        selectGeometry(+b.dataset.geometryStep);
        window.geometryView?.resumeExploration();
      }),
  );
  document
    .querySelectorAll("[data-figure-open]")
    .forEach((b) => (b.onclick = () => openFigure(b.dataset.figureOpen)));
  document
    .querySelectorAll("[data-result-view]")
    .forEach((b) => (b.onclick = () => setResultView(b.dataset.resultView)));
  document
    .querySelectorAll("[data-experiment-figure]")
    .forEach(
      (b) =>
        (b.onclick = () => selectExperimentFigure(b.dataset.experimentFigure)),
    );
  $("#close-figure").onclick = () => dialog.close();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  $("#figure-zoom").oninput = (e) => zoom(+e.target.value);
  $("#geometry-pair").addEventListener("change", () => {
    document.querySelectorAll(".pair-summary").forEach((b) => {
      const active = +b.dataset.pair === +$("#geometry-pair").value;
      b.classList.toggle("selected", active);
      b.setAttribute("aria-pressed", active);
    });
  });
  window.addEventListener("geometryready", () => selectGeometry(step));
  selectGeometry(0);
  const ready = fetch("assets/paper-figures/manifest.json")
    .then((r) => {
      if (!r.ok) throw Error("Evidence unavailable");
      return r.json();
    })
    .then((data) => {
      figures = data.figures;
      if (resultView !== "cohorts") fill($("#results-evidence"), resultView);
      if (experimentFigure) fill($("#experiments-evidence"), experimentFigure);
      return figures;
    })
    .catch(() => []);
  return {
    selectGeometry,
    openFigure,
    setResultView,
    showExperimentVideo,
    selectExperimentFigure,
    ready,
    get figures() {
      return figures;
    },
    get geometryStep() {
      return step;
    },
    get resultView() {
      return resultView;
    },
    get experimentFigure() {
      return experimentFigure;
    },
  };
}
