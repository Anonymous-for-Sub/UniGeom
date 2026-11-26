import { buildScene } from "./application-scene/scene.js?v=20261126j";
import { createRenderer } from "./application-scene/render.js?v=20261126j";

const stages = [
  {
    title: "Start with familiar dynamics",
    description:
      "The robot carries a coupling through a bright workspace. Its native encoder supplies states to the existing predictor.",
    location: "Bright workspace",
    encoder: "Native encoder B",
    bridge: "Native state",
  },
  {
    title: "Connect a new visual encoder",
    description:
      "Common observations calibrate the interface before use. Encoder A can then supply states in the frozen predictor’s coordinates.",
    location: "Doorway",
    encoder: "Source encoder A",
    bridge: "Calibrate T",
  },
  {
    title: "Reuse the same predictor",
    description:
      "In the factory, the robot places the coupling. The interface changes how it sees the scene; the predictor remains frozen.",
    location: "Factory",
    encoder: "Source encoder A",
    bridge: "Fitted T",
  },
];
const reducedTimes = [5, 18.5, 32.6];
const duration = 26;
const speed = 1.5;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function initApplication() {
  const root = document.querySelector("#application-scene");
  if (!root) return null;
  const panel = root.closest("#slide-application");
  const title = document.querySelector("#application-heading"),
    description = document.querySelector("#application-description");
  root.innerHTML = `<div class="app-viewport"><canvas tabindex="0" aria-label="Interactive 3D scene. Drag horizontally or use the left and right arrow keys to rotate the view."></canvas>
    <div class="app-location"><i></i><span></span></div>
    <button type="button" class="app-reset" hidden>Reset view</button>
    <p class="app-status" role="status">Loading scene…</p></div>
    <div class="app-route" aria-label="Perception and prediction path">
      <span class="app-encoder"></span><b aria-hidden="true">→</b><span class="app-bridge"><svg aria-hidden="true" viewBox="0 0 31 22" width="30" height="20"><g fill="none" stroke="#a29cff" stroke-width="1.3" pathLength="1"><path pathLength="1" d="M5 4 L26 11"/><path pathLength="1" d="M5 11 L26 18"/><path pathLength="1" d="M5 18 L26 4"/></g><g fill="#a29cff"><circle cx="4" cy="4" r="2"/><circle cx="4" cy="11" r="2"/><circle cx="4" cy="18" r="2"/></g><g fill="#a9e8d6"><circle cx="27" cy="4" r="2"/><circle cx="27" cy="11" r="2"/><circle cx="27" cy="18" r="2"/></g></svg><span class="app-bridge-text"></span></span><b aria-hidden="true">→</b>
      <span class="app-predictor"><i aria-hidden="true"></i>Frozen predictor B</span></div><div class="app-timeline" aria-hidden="true"><i></i></div>`;
  const canvas = root.querySelector("canvas"),
    viewport = root.querySelector(".app-viewport");
  const caption = panel.querySelector(".chapter-copy");
  if (caption) {
    caption.className = "app-caption";
    caption.prepend(root.querySelector(".app-location"));
    viewport.append(caption);
  }
  const location = root.querySelector(".app-location span"),
    status = root.querySelector(".app-status");
  const reset = root.querySelector(".app-reset");
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  let scene,
    renderer,
    seconds = 0,
    stage = -1,
    locallyPlaying = false;
  let handle = 0,
    lastTick = 0,
    lastFrame = -Infinity,
    lastDrawTime = NaN,
    disposed = false,
    orbit = 0,
    drag = null;
  const visible = () =>
    !document.hidden &&
    !panel?.hidden &&
    root.getBoundingClientRect().width > 0;

  function select(i) {
    if (i === stage) return;
    stage = i;
    const s = stages[i];
    root.dataset.stage = String(i);
    if (title) title.textContent = s.title;
    if (description) description.textContent = s.description;
    location.textContent = s.location;
    root.querySelector(".app-encoder").textContent = s.encoder;
    root.querySelector(".app-bridge-text").textContent = s.bridge;
  }
  function draw(force = false) {
    if (!scene || !renderer || disposed || !visible()) return;
    const time = mq.matches ? reducedTimes[stage] : seconds * speed;
    root.style.setProperty("--app-progress", `${(seconds / duration) * 100}%`);
    if (!force && time === lastDrawTime) return;
    const now = performance.now();
    const fps = renderer.name === "webgl" ? 35 : 18;
    if (!force && now - lastFrame < 1000 / fps) return;
    lastDrawTime = time;
    lastFrame = now;
    if (stage === 1) {
      const paired = clamp((time - 12) / 7, 0, 1);
      root.style.setProperty("--app-pair-offset", String(1 - paired));
    }
    const { view, objects } = scene.frame(
      time,
      canvas.width / canvas.height,
      orbit,
    );
    renderer.draw(view, objects);
  }
  function resize() {
    if (!renderer || !visible()) return;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    const ratio = renderer.pixelRatio(w);
    if (w && h) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      draw(true);
    }
  }
  function tick(now) {
    handle = 0;
    if (!locallyPlaying || mq.matches || disposed || !visible()) {
      lastTick = 0;
      return;
    }
    if (lastTick) seconds = (seconds + (now - lastTick) / 1000) % duration;
    select(Math.min(2, Math.floor(seconds / 8)));
    lastTick = now;
    draw();
    handle = requestAnimationFrame(tick);
  }
  function schedule() {
    if (
      !handle &&
      scene &&
      renderer &&
      locallyPlaying &&
      visible() &&
      !mq.matches
    )
      handle = requestAnimationFrame(tick);
  }
  function pause() {
    locallyPlaying = false;
    lastTick = 0;
    cancelAnimationFrame(handle);
    handle = 0;
  }
  function playFrom(value = 0) {
    pause();
    seconds = clamp(Number(value) || 0, 0, duration);
    select(Math.min(2, Math.floor(seconds / 8)));
    locallyPlaying = !mq.matches;
    draw(true);
    schedule();
  }
  function setStage(i) {
    playFrom(clamp(i, 0, 2) * 8);
  }
  function setProgress(value) {
    pause();
    const time = clamp(Number(value) || 0, 0, duration),
      i = Math.min(2, Math.floor(time / 8));
    const jump = Math.abs(time - seconds) > 0.18 || stage !== i;
    seconds = time;
    select(i);
    draw(jump || time === duration);
  }
  function refresh() {
    lastTick = 0;
    if (!visible()) {
      cancelAnimationFrame(handle);
      handle = 0;
      return;
    }
    resize();
    schedule();
  }
  function setOrbit(value) {
    orbit = clamp(value, -0.6, 0.76);
    reset.hidden = Math.abs(orbit) < 0.015;
    draw(true);
  }
  const listeners = new AbortController();
  const on = (target, event, fn) =>
    target.addEventListener(event, fn, { signal: listeners.signal });
  on(canvas, "pointerdown", (ev) => {
    if (ev.button !== 0) return;
    drag = { x: ev.clientX, start: orbit, id: ev.pointerId };
    canvas.setPointerCapture(ev.pointerId);
  });
  on(canvas, "pointermove", (ev) => {
    if (drag?.id === ev.pointerId)
      setOrbit(drag.start + (ev.clientX - drag.x) * 0.005);
  });
  on(canvas, "lostpointercapture", () => {
    drag = null;
  });
  on(canvas, "dblclick", () => setOrbit(0));
  on(canvas, "keydown", (ev) => {
    const direction =
      ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
    if (direction) {
      ev.preventDefault();
      ev.stopPropagation();
      setOrbit(orbit + direction * 0.15);
    }
    if (ev.key === "Home") {
      ev.preventDefault();
      ev.stopPropagation();
      setOrbit(0);
    }
  });
  on(reset, "click", () => setOrbit(0));
  on(document, "visibilitychange", refresh);
  on(mq, "change", () => {
    if (mq.matches) pause();
    draw(true);
  });
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  const visibilityObserver = new MutationObserver(refresh);
  if (panel)
    visibilityObserver.observe(panel, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  select(0);
  root.dataset.ready = "loading";
  const ready = Promise.all([
    fetch("assets/application-scene/meshes.json?v=20261126j").then((res) =>
      res.json(),
    ),
    fetch("assets/application-scene/rig.json?v=20261126j").then((res) =>
      res.json(),
    ),
  ])
    .then(([meshes, rig]) => {
      if (disposed) return;
      scene = buildScene(meshes, rig);
      renderer = createRenderer(canvas);
      root.dataset.renderer = renderer.name;
      root.dataset.ready = "true";
      status.hidden = true;
      resize();
      schedule();
    })
    .catch((error) => {
      if (disposed) return;
      root.dataset.ready = "error";
      status.textContent = "The 3D scene could not be loaded.";
      console.error("Application scene:", error);
    });
  return {
    ready,
    setStage,
    playFrom,
    setProgress,
    pause,
    resize,
    get time() {
      return seconds;
    },
    get stage() {
      return stage;
    },
    dispose() {
      disposed = true;
      pause();
      observer.disconnect();
      visibilityObserver.disconnect();
      listeners.abort();
      renderer?.dispose();
      root.replaceChildren();
    },
  };
}
