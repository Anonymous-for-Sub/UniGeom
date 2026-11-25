const $ = (s) => document.querySelector(s);
const descriptions = [
  {
    title: "Two encoders, two coordinate systems.",
    text: "Both encoders process the same 606 observations. Each dot is one observation in a separate 3D projection. The layouts differ; what matters is which observations stay close to one another.",
  },
  {
    title: "They find similar neighbors.",
    text: "Select an observation. Each encoder retrieves its ten nearest neighbors in the original 192D features. Purple points belong to both sets; the other colors mark different choices.",
  },
  {
    title: "Shared structure across model pairs.",
    text: "Over all 606 observations, the three pairs share 70.6–74.0% of their ten nearest neighbors. The paper then tests whether this correspondence supports prediction and behavior.",
  },
];
export function initPaperViews() {
  let figures = [],
    selected = "matched-executions",
    step = 0,
    mode = "paper";
  const dialog = $("#figure-viewer");
  const figure = (id) => figures.find((f) => f.id === id);
  function selectGeometry(index) {
    step = Math.max(0, Math.min(2, index));
    const d = descriptions[step];
    $("#geometry-heading").textContent = d.title;
    $("#geometry-description").textContent = d.text;
    $(".geometry-stage").dataset.geometryPhase = String(step);
    document.querySelectorAll("[data-geometry-step]").forEach((b) => {
      const active = +b.dataset.geometryStep === step;
      b.classList.toggle("selected", active);
      b.setAttribute("aria-pressed", active);
    });
    document
      .querySelectorAll("[data-geometry-detail]")
      .forEach((el) => (el.hidden = step !== 1));
    $("#geometry-cohort").hidden = step !== 2;
    $("#slide-geometry .chapter-copy>.footnote").hidden = step === 2;
    window.geometryView?.setExplorationStep(step);
    if (window.geometryView)
      $("#pair-comparison").innerHTML = window.geometryView.data.pairs
        .map(
          (p, i) =>
            `<div class="pair-mini-row"><span>Pair ${i + 1}</span><i style="--pair-value:${p.mean * 100}%"></i><strong>${(p.mean * 100).toFixed(1)}%</strong></div>`,
        )
        .join("");
  }
  function setFramework(view) {
    mode = view === "walkthrough" ? "walkthrough" : "paper";
    $("#paper-framework").hidden = mode !== "paper";
    $("#connection-walkthrough").hidden = mode !== "walkthrough";
    document
      .querySelectorAll("[data-walkthrough-only]")
      .forEach((e) => (e.hidden = mode !== "walkthrough"));
    $("#framework-caption").hidden = mode !== "paper";
    document.querySelectorAll("[data-framework-mode]").forEach((b) => {
      const active = b.dataset.frameworkMode === mode;
      b.classList.toggle("selected", active);
      b.setAttribute("aria-pressed", active);
    });
  }
  function selectFigure(id) {
    selected = id;
    const f = figure(id);
    if (!f) return;
    $(".paper-figure-stage").dataset.aspect =
      f.width / f.height > 3.5 ? "wide" : "regular";
    const img = $("#paper-figure-image");
    img.src = `assets/paper-figures/${f.file}`;
    img.alt = f.title;
    $("#paper-figure-title").textContent = f.title;
    $("#paper-figure-caption").textContent = f.caption;
    $("#paper-figure-scope").textContent = `${f.figureLabel}. ${f.scope}`;
    document.querySelectorAll("[data-paper-figure]").forEach((b) => {
      const active = b.dataset.paperFigure === id;
      b.setAttribute("aria-selected", active);
      b.tabIndex = active ? 0 : -1;
      if (active) b.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  function zoom(value) {
    const img = $("#viewer-image");
    img.style.width = value + "%";
    img.style.height = value === 100 ? "100%" : "auto";
    $("#figure-zoom").setAttribute("aria-valuetext", value + " percent");
  }
  function openFigure(id) {
    const f = figure(id);
    if (!f) return;
    window.deck?.pause();
    $("#viewer-title").textContent = `${f.figureLabel} · ${f.title}`;
    $("#viewer-image").src = `assets/paper-figures/${f.file}`;
    $("#viewer-image").alt = f.title;
    $("#figure-download").href = `assets/paper-figures/${f.file}`;
    $("#viewer-caption").textContent = f.caption + " " + f.scope;
    $("#figure-zoom").value = "100";
    zoom(100);
    if (!dialog.open) dialog.showModal();
    $("#viewer-image-scroll").scrollTo(0, 0);
  }
  document.querySelectorAll("[data-geometry-step]").forEach(
    (b) =>
      (b.onclick = () => {
        selectGeometry(+b.dataset.geometryStep);
        window.geometryView?.resumeExploration();
      }),
  );
  document
    .querySelectorAll("[data-framework-mode]")
    .forEach((b) => (b.onclick = () => setFramework(b.dataset.frameworkMode)));
  document
    .querySelectorAll("[data-figure-open]")
    .forEach((b) => (b.onclick = () => openFigure(b.dataset.figureOpen)));
  $("#enlarge-gallery").onclick = $("#gallery-image-button").onclick = () =>
    openFigure(selected);
  $("#close-figure").onclick = () => dialog.close();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  $("#figure-zoom").oninput = (e) => zoom(+e.target.value);
  $("#paper-figure-list").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
      return;
    e.preventDefault();
    const buttons = [...$("#paper-figure-list").querySelectorAll("button")],
      i = buttons.indexOf(document.activeElement),
      next =
        (i +
          (["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1) +
          buttons.length) %
        buttons.length;
    buttons[next].click();
    buttons[next].focus();
  });
  window.addEventListener("geometryready", () => selectGeometry(step));
  selectGeometry(0);
  setFramework("paper");
  const ready = fetch("assets/paper-figures/manifest.json")
    .then((r) => {
      if (!r.ok) throw Error("Figure catalog unavailable");
      return r.json();
    })
    .then((data) => {
      const order = [
        "problem",
        "framework",
        "shared-geometry",
        "prediction-controls",
        "learned-source",
        "matched-executions",
        "manipulation-predictions",
        "driving-context",
      ];
      figures = order
        .map((id) => data.figures.find((f) => f.id === id))
        .filter(Boolean);
      const labels = {
        problem: "State and function",
        framework: "Framework",
        "shared-geometry": "Shared geometry",
        "prediction-controls": "Prediction controls",
        "learned-source": "Calibration budget",
        "matched-executions": "Four-task comparison",
        "manipulation-predictions": "Granular and RoboTwin",
        "driving-context": "Driving replays",
      };
      const list = $("#paper-figure-list");
      for (const f of figures) {
        const b = document.createElement("button");
        b.dataset.paperFigure = f.id;
        b.setAttribute("role", "tab");
        b.innerHTML = `<span>${labels[f.id]}</span><small>${f.figureLabel}</small>`;
        b.onclick = () => selectFigure(f.id);
        list.append(b);
      }
      selectFigure(selected);
      return figures;
    })
    .catch(() => {
      $("#paper-figure-title").textContent =
        "The figure catalog could not load. Please refresh this page.";
      return [];
    });
  return {
    selectGeometry,
    setFramework,
    selectFigure,
    openFigure,
    ready,
    get figures() {
      return figures;
    },
    get geometryStep() {
      return step;
    },
    get frameworkMode() {
      return mode;
    },
  };
}
