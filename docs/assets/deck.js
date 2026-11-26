const $ = (s) => document.querySelector(s);
const pages = [
  { id: "overview", label: "Overview", duration: 14000 },
  { id: "geometry", label: "Shared geometry", duration: 42000 },
  { id: "application", label: "Application", duration: 26000 },
  { id: "connection", label: "Framework", duration: 32000 },
  { id: "interface", label: "Interface", duration: 24000 },
  { id: "experiments", label: "Experiments", duration: 87000 },
  { id: "results", label: "Results", duration: 48000 },
];
const offsets = pages.map((_, i) =>
  pages.slice(0, i).reduce((s, p) => s + p.duration, 0),
);
const total = pages.reduce((s, p) => s + p.duration, 0);
// Original recordings at their native playback speed, with readable end holds.
const cases = [
  { start: 0, end: 7500, duration: 5.1 },
  { start: 7500, end: 15000, duration: 5.5 },
  { start: 15000, end: 22500, duration: 5.5 },
  { start: 22500, end: 30000, duration: 5.5 },
  { start: 30000, end: 57000, duration: 20.2 },
];
// Manual navigation follows meaningful substeps, not just chapter boundaries.
const stops = {
  overview: [[0, "Overview"]],
  geometry: [
    [0, "Two spaces"],
    [12000, "Shared neighbors"],
    [28000, "Shared structure"],
  ],
  application: [[0, "Continuous application demo"]],
  connection: [
    [0, "Calibrate"],
    [8000, "Resample"],
    [16000, "Refine"],
    [24000, "Predict"],
  ],
  interface: [
    [0, "Resample the source grid"],
    [6000, "Attend to source tokens"],
    [12000, "Add the spatial residual"],
    [18000, "Restore receiver features"],
  ],
  experiments: [
    [0, "Navigation"],
    [7500, "Spatial interface"],
    [15000, "MAE spatial interface"],
    [22500, "View recalibration"],
    [30000, "Recurrent control"],
    [57000, "Matched executions"],
    [67000, "Manipulation predictions"],
    [77000, "Driving context"],
  ],
  results: [
    [0, "TwoRooms control"],
    [7000, "PushT control"],
    [14000, "Second source"],
    [21000, "View recalibration"],
    [28000, "Prediction checks"],
    [38000, "Calibration budget"],
  ],
};
export function initDeck(api) {
  let page = 0,
    elapsed = 0,
    playing = false,
    last = 0,
    raf = null;
  let cue = "",
    explicitPause = false,
    mediaGeneration = 0;
  const v = $("#case-video");
  const slide = () => $(`#slide-${pages[page].id}`);
  function updateControls() {
    $("#mobile-chapter").value = pages[page].id;
    $("#autoplay").setAttribute("aria-pressed", String(playing));
    $("#autoplay span").textContent = playing
      ? "Pause"
      : elapsed >= pages[page].duration && page === pages.length - 1
        ? "Play again"
        : "Auto play";
    $("#page-count").textContent =
      `${String(page + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`;
    $("#page-name").textContent = pages[page].label;
    const previous = neighbor(-1),
      next = neighbor(1);
    for (const [id, target, direction] of [
      ["previous-page", previous, "Previous"],
      ["next-page", next, "Next"],
    ]) {
      const button = $("#" + id);
      button.disabled = !target;
      const label = target
        ? `${direction}: ${pages[target.page].label} · ${stops[pages[target.page].id][target.stop][1]}`
        : `${direction}: ${direction === "Previous" ? "beginning" : "end"} of presentation`;
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    const ratio = Math.min(1000, ((offsets[page] + elapsed) / total) * 1000);
    $("#tour-seek").value = ratio;
    $("#tour-seek").style.setProperty("--progress", `${ratio / 10}%`);
    $("#tour-seek").setAttribute(
      "aria-valuetext",
      `${pages[page].label}, ${Math.round((elapsed / pages[page].duration) * 100)} percent`,
    );
  }
  function currentStop() {
    const list = stops[pages[page].id];
    return Math.max(
      0,
      list.findLastIndex((s) => elapsed >= s[0]),
    );
  }
  function neighbor(direction) {
    const list = stops[pages[page].id],
      i = currentStop() + direction;
    if (i >= 0 && i < list.length) return { page, stop: i };
    const target = page + direction;
    if (target < 0 || target >= pages.length) return null;
    return {
      page: target,
      stop: direction > 0 ? 0 : stops[pages[target].id].length - 1,
    };
  }
  function resumeScene() {
    explicitPause = false;
    if (pages[page].id === "overview") window.geometryView?.resumeHero();
    if (pages[page].id === "geometry") window.geometryView?.resumeExploration();
    if (pages[page].id === "connection") api.connection.resume();
    if (pages[page].id === "interface") api.spatialInterface.resume?.();
  }
  function stepBy(direction) {
    const target = neighbor(direction);
    if (!target) return;
    pause();
    const local = stops[pages[target.page].id][target.stop][0];
    if (target.page === page) {
      elapsed = local;
      cue = "";
      sync(true, true);
      updateControls();
      $("#page-announcement").textContent =
        `${pages[page].label}. ${stops[pages[page].id][target.stop][1]}.`;
    } else change(target.page, local, "push");
    resumeScene();
  }
  function pause() {
    playing = false;
    explicitPause = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    api.connection.stop();
    api.application?.pause();
    api.spatialInterface.stop?.();
    v.pause();
    document.querySelectorAll("svg").forEach((el) => el.pauseAnimations?.());
    window.geometryView?.pauseHero();
    window.geometryView?.pauseExploration();
    updateControls();
  }
  function mediaAtTime(force = false) {
    const i = cases.findIndex((c) => elapsed < c.end);
    const index = i < 0 ? 4 : i,
      segment = cases[index];
    const t = Math.max(
      0,
      Math.min(segment.duration, (elapsed - segment.start) / 1000),
    );
    const changed =
      api.getActiveCase() !== index || api.paperViews.experimentFigure !== null;
    if (changed) {
      api.showCase(index);
      mediaGeneration++;
    }
    const generation = mediaGeneration;
    const apply = () => {
      if (generation !== mediaGeneration || pages[page].id !== "experiments")
        return;
      if (force || changed || Math.abs(v.currentTime - t) > 0.6)
        v.currentTime = Math.min(t, v.duration || t);
      if (playing && t < segment.duration - 0.05) {
        v.muted = true;
        v.play().catch(() => {
          if (generation === mediaGeneration) pause();
        });
      } else v.pause();
    };
    if (v.readyState >= 2) apply();
    else if (changed || force)
      v.addEventListener("loadeddata", apply, { once: true });
  }
  function sync(force = false, previewScenes = false) {
    const id = pages[page].id;
    if (id === "connection") {
      const step = Math.min(3, Math.floor(elapsed / 8000));
      if (cue !== `connection-${step}` || force) {
        api.connection.setStep(step);
        cue = `connection-${step}`;
      }
    } else if (id === "application") {
      if (cue !== "application" || force) {
        if (previewScenes && !playing) api.application.playFrom(elapsed / 1000);
        cue = "application";
      }
      if (playing || !previewScenes)
        api.application.setProgress(elapsed / 1000);
    } else if (id === "interface") {
      const step = Math.min(3, Math.floor(elapsed / 6000));
      // Compute motion shares the tour clock. Manual navigation previews a
      // stage locally; an explicit seek renders a deterministic frozen frame.
      if (playing || !previewScenes) {
        api.spatialInterface.setProgress?.(elapsed / 1000);
        cue = `interface-${step}`;
      } else if (cue !== `interface-${step}` || force) {
        api.spatialInterface.setStage(step);
        cue = `interface-${step}`;
      }
    } else if (id === "results") {
      const name =
        elapsed < 28000
          ? ["navigation", "spatial", "second_source", "brightness"][
              Math.min(3, Math.floor(elapsed / 7000))
            ]
          : elapsed < 38000
            ? "prediction-controls"
            : "learned-source";
      if (cue !== name || force) {
        if (elapsed < 28000) api.setStudy(name);
        else api.paperViews.setResultView(name);
        cue = name;
      }
    } else if (id === "geometry") {
      const step = elapsed < 12000 ? 0 : elapsed < 28000 ? 1 : 2;
      const index =
        step === 2 ? Math.min(2, Math.floor((elapsed - 28000) / 4600)) : 0;
      if (cue !== `geometry-${step}-${index}` || force) {
        api.paperViews.selectGeometry(step);
        if (window.geometryView && step === 2) {
          const select = $("#geometry-pair");
          select.value = String(index);
          select.dispatchEvent(new Event("change"));
        }
        cue = `geometry-${step}-${index}`;
      }
    } else if (id === "experiments") {
      if (elapsed < 57000) {
        mediaAtTime(force);
      } else {
        v.pause();
        const id = [
          "matched-executions",
          "manipulation-predictions",
          "driving-context",
        ][Math.min(2, Math.floor((elapsed - 57000) / 10000))];
        if (cue !== id || force) {
          api.paperViews.selectExperimentFigure(id);
          cue = id;
        }
      }
    }
  }

  function change(
    index,
    local = 0,
    historyMode = "replace",
    previewScenes = true,
  ) {
    page = Math.max(0, Math.min(pages.length - 1, index));
    elapsed = Math.max(0, Math.min(pages[page].duration, local));
    cue = "";
    mediaGeneration++;
    v.pause();
    api.connection.stop();
    api.application?.pause();
    api.spatialInterface.stop?.();
    document.querySelectorAll(".slide").forEach((el) => {
      el.hidden = el.dataset.slide !== pages[page].id;
      el.classList.toggle("entering", !el.hidden);
      if (!el.hidden) el.scrollTop = 0;
    });
    document.querySelectorAll("[data-page]").forEach((b) => {
      const active = b.dataset.page === pages[page].id;
      b.setAttribute("aria-selected", active);
      b.tabIndex = active ? 0 : -1;
      if (active && b.getClientRects().length) b.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    if (historyMode !== "none")
      history[historyMode === "push" ? "pushState" : "replaceState"](
        null,
        "",
        `#${pages[page].id}`,
      );
    document.dispatchEvent(
      new CustomEvent("chapterchange", { detail: pages[page].id }),
    );
    $("#page-announcement").textContent =
      `Page ${page + 1} of ${pages.length}. ${pages[page].label}.`;
    if (pages[page].id === "overview" && !explicitPause)
      window.geometryView?.resumeHero();
    else window.geometryView?.pauseHero();
    if (pages[page].id === "geometry" && !explicitPause)
      window.geometryView?.resumeExploration();
    else window.geometryView?.pauseExploration();
    sync(true, previewScenes);
    if (pages[page].id === "connection" && !explicitPause)
      api.connection.resume();
    updateControls();
    last = performance.now();
  }
  function tick(now) {
    raf = null;
    if (!playing || document.hidden) return;
    const dt = Math.min(120, now - last);
    last = now;
    // Pause the presentation clock while a requested recorded clip buffers.
    const buffering =
      pages[page].id === "experiments" && elapsed < 57000 && v.readyState < 2;
    if (!buffering) elapsed += dt;
    if (elapsed >= pages[page].duration) {
      if (page === pages.length - 1) {
        elapsed = pages[page].duration;
        pause();
        return;
      }
      change(page + 1);
    }
    sync();
    updateControls();
    if (playing) raf = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) return;
    explicitPause = false;
    if (page === pages.length - 1 && elapsed >= pages[page].duration) change(0);
    playing = true;
    document.querySelectorAll("svg").forEach((el) => el.unpauseAnimations?.());
    if (pages[page].id === "overview") window.geometryView?.resumeHero();
    if (pages[page].id === "geometry") window.geometryView?.resumeExploration();
    sync(true);
    if (pages[page].id === "connection" && !explicitPause)
      api.connection.resume();
    updateControls();
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function go(index) {
    pause();
    change(index, 0, "push");
    explicitPause = false;
    if (page === 0) window.geometryView?.resumeHero();
    if (pages[page].id === "connection") api.connection.resume();
    if (pages[page].id === "interface") api.spatialInterface.resume?.();
    if (pages[page].id === "geometry") window.geometryView?.resumeExploration();
  }
  $("#autoplay").onclick = () => (playing ? pause() : play());
  $("#previous-page").onclick = () => stepBy(-1);
  $("#next-page").onclick = () => stepBy(1);
  $("#replay-page").onclick = () => {
    pause();
    change(page);
    play();
  };
  document.querySelectorAll("[data-page],[data-go]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.page || b.dataset.go;
        go(pages.findIndex((p) => p.id === id));
      }),
  );
  $("#tour-seek").addEventListener("input", (e) => {
    const requested = +e.target.value;
    pause();
    const t = (requested / 1000) * total;
    const index = offsets.findIndex(
      (start, i) =>
        t >= start && (i === pages.length - 1 || t < offsets[i + 1]),
    );
    change(index, t - offsets[index], "replace", false);
  });
  // A user inspection pauses the tour instead of fighting its timeline.
  $("#stage").addEventListener(
    "pointerdown",
    (e) => {
      if (
        e.target.closest(
          "#application-scene canvas, #application-scene .app-reset",
        )
      )
        return;
      if (
        e.isTrusted &&
        e.target.closest("button, select, input, canvas, svg, video, a")
      )
        pause();
    },
    true,
  );
  $("#stage").addEventListener(
    "keydown",
    (e) => {
      if (
        e.target.closest(
          "#application-scene canvas, #application-scene .app-reset",
        )
      )
        return;
      if (e.isTrusted && playing) pause();
    },
    true,
  );
  $("#stage").addEventListener("click", (e) => {
    const b = e.target.closest(
      "button[data-step],button[data-stage],button[data-case],button[data-geometry-step],button[data-result-view],button[data-experiment-figure]",
    );
    if (!b) return;
    if (b.dataset.step !== undefined) elapsed = +b.dataset.step * 8000;
    if (b.dataset.geometryStep !== undefined)
      elapsed = [0, 12000, 28000][+b.dataset.geometryStep];
    if (b.dataset.resultView !== undefined)
      elapsed = {
        cohorts:
          ["navigation", "spatial", "second_source", "brightness"].indexOf(
            $("#results-study").value,
          ) * 7000,
        "prediction-controls": 28000,
        "learned-source": 38000,
      }[b.dataset.resultView];
    if (b.dataset.experimentFigure !== undefined)
      elapsed =
        57000 +
        [
          "matched-executions",
          "manipulation-predictions",
          "driving-context",
        ].indexOf(b.dataset.experimentFigure) *
          10000;
    if (b.dataset.stage !== undefined) elapsed = +b.dataset.stage * 6000;
    if (b.dataset.case !== undefined) elapsed = cases[+b.dataset.case].start;
    cue = "";
    updateControls();
  });
  $("#stage").addEventListener("change", (e) => {
    if (!e.isTrusted) return;
    if (e.target.id === "geometry-pair" && api.paperViews.geometryStep === 2)
      elapsed = 28000 + +e.target.value * 4600;
    if (e.target.id === "results-study")
      elapsed =
        ["navigation", "spatial", "second_source", "brightness"].indexOf(
          e.target.value,
        ) * 7000;
    cue = "";
    updateControls();
  });
  $("#mobile-chapter").addEventListener("change", (event) => {
    go(pages.findIndex((p) => p.id === event.target.value));
  });
  const rail = $(".page-tabs");
  rail.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const index =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? pages.length - 1
          : (page + (e.key === "ArrowRight" ? 1 : -1) + pages.length) %
            pages.length;
    go(index);
    $(`[data-page="${pages[index].id}"]`).focus();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.defaultPrevented ||
      e.target.closest(
        "button,select,input,textarea,a,canvas,svg,pre,[contenteditable]",
      )
    )
      return;
    if (["ArrowLeft", "PageUp"].includes(e.key)) {
      e.preventDefault();
      stepBy(-1);
    }
    if (["ArrowRight", "PageDown"].includes(e.key)) {
      e.preventDefault();
      stepBy(1);
    }
    if (e.code === "Space") {
      e.preventDefault();
      playing ? pause() : play();
    }
    if (e.key === "Escape") pause();
  });
  let wheel = 0,
    wheelTime = 0,
    gestureUsed = false;
  $("#stage").addEventListener(
    "wheel",
    (e) => {
      if (
        innerWidth <= 800 ||
        e.ctrlKey ||
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ||
        e.target.closest("select,input,canvas,svg,video,pre,.diagram-scroll")
      )
        return;
      const now = performance.now();
      if (now - wheelTime > 230) {
        wheel = 0;
        gestureUsed = false;
      }
      wheelTime = now;
      const el = slide(),
        down = e.deltaY > 0;
      if (
        down
          ? el.scrollTop + el.clientHeight < el.scrollHeight - 3
          : el.scrollTop > 3
      )
        return;
      if (gestureUsed) {
        e.preventDefault();
        return;
      }
      wheel += e.deltaY;
      if (Math.abs(wheel) > 105) {
        e.preventDefault();
        gestureUsed = true;
        stepBy(wheel > 0 ? 1 : -1);
      }
    },
    { passive: false },
  );
  let touch = null;
  $("#stage").addEventListener(
    "touchstart",
    (e) => {
      if (
        !e.target.closest(
          "canvas,svg,video,input,select,button,a,.diagram-scroll,.experiment-list",
        )
      )
        touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true },
  );
  $("#stage").addEventListener(
    "touchend",
    (e) => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.x,
        dy = e.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 75 && Math.abs(dy) < 45) stepBy(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
  window.addEventListener("hashchange", () => {
    const index = pages.findIndex((p) => p.id === location.hash.slice(1));
    if (index >= 0) {
      pause();
      change(index, 0, "none");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("geometryready", () => {
    if (page !== 0 || explicitPause) window.geometryView?.pauseHero();
    if (pages[page].id !== "geometry" || explicitPause)
      window.geometryView?.pauseExploration();
    if (pages[page].id === "geometry") sync(true);
  });
  window.deck = {
    go,
    play,
    pause,
    seek(index, local = 0) {
      pause();
      change(index, local, "replace", false);
    },
    get state() {
      return { page: pages[page].id, index: page, elapsed, playing };
    },
    get pausedExplicitly() {
      return explicitPause;
    },
    pages,
    stepBy,
    stops,
  };
  const initial = pages.findIndex((p) => p.id === location.hash.slice(1));
  change(initial >= 0 ? initial : 0, 0, "replace");
}
