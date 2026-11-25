const $ = (s) => document.querySelector(s);
const descriptions = [
  {
    title: "Two encoders, two coordinate systems.",
    text: "The same 606 observations pass through two independently trained encoders. Each dot keeps its observation identity as the two projected spaces rotate.",
  },
  {
    title: "Follow the same observation through both spaces.",
    text: "Each encoder retrieves ten neighbors using its original 192D features. The ranked lists reveal which observations are shared, even when their ranks differ.",
  },
  {
    title: "Look beyond one neighborhood.",
    text: "Across three independent pairs, the encoders share 70.6–74.0% of their ten nearest neighbors on average. Each distribution includes all 606 observations.",
  },
];
export function initPaperViews() {
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
      "Drag to rotate the projected spaces. Each point is one recorded observation.",
      "Matching observations are linked across ranked neighbor lists. Select a new query to compare.",
      "Shared neighbors out of ten · hover or tap a bar to inspect the observation count.",
    ][step];
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
    $("#results-evidence").hidden = id === "cohorts";
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
