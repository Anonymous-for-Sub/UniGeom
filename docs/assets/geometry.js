const colors = {
  purple: "#a29cff",
  deep: "#c6c3ff",
  teal: "#68c5b4",
  sand: "#d4b590",
  ink: "#f2f0ff",
};
const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;

export class GeometryView {
  constructor(data) {
    this.data = data;
    this.pair = 0;
    this.query = data.pairs[0].example;
    this.yaw = -0.45;
    this.pitch = 0.28;
    this.points = [];
    this.drag = null;
    this.canvas = document.querySelector("#geometry-cloud");
    this.hero = document.querySelector("#hero-cloud");
    this.motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = this.motionPreference.matches;
    this.normalized = new WeakMap();
    this.heroVisible = true;
    this.explorerVisible = false;
    this.explorationStep = 1;
    this.heroPaused = false;
    this.explorerPaused = false;
    this.frame = null;
    this.phase = 0;
    const heroPair = data.pairs[0];
    this.heroQuery = heroPair.example;
    this.heroShared = heroPair.neighborsA[this.heroQuery].filter((id) =>
      heroPair.neighborsB[this.heroQuery].includes(id),
    );
    this.heroFocus = new Set([this.heroQuery, ...this.heroShared]);
    // Center and uniformly scale each measured projection independently.
    // These display transforms do not align the two representation spaces.
    this.heroClouds = [this.normalize(heroPair.a), this.normalize(heroPair.b)];
    this.motionPreference.addEventListener("change", (event) => {
      this.reduced = event.matches;
      this.stopHero();
      this.startHero();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopHero();
      else this.startHero();
    });
    new ResizeObserver(() => this.render()).observe(this.canvas);
    new ResizeObserver(() => this.drawHero()).observe(this.hero);
    new IntersectionObserver(([entry]) => {
      this.heroVisible = entry.isIntersecting;
      if (this.heroVisible) this.startHero();
      else if (!this.explorerVisible) this.stopHero();
    }).observe(this.hero);
    new IntersectionObserver(([entry]) => {
      this.explorerVisible = entry.isIntersecting;
      if (this.explorerVisible) this.startHero();
      else if (!this.heroVisible) this.stopHero();
    }).observe(this.canvas);
    this.canvas.addEventListener("pointerdown", (e) => {
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      this.yaw += (e.clientX - this.drag.x) * 0.008;
      this.pitch = Math.max(
        -1.2,
        Math.min(1.2, this.pitch + (e.clientY - this.drag.y) * 0.008),
      );
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.render();
    });
    this.canvas.addEventListener("pointerup", (e) => {
      if (!this.drag) return;
      const moved = Math.hypot(
        e.clientX - this.drag.startX,
        e.clientY - this.drag.startY,
      );
      this.drag = null;
      if (moved > 5) return;
      const r = this.canvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
      let best = null,
        dist = 18;
      for (const p of this.points) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < dist) {
          dist = d;
          best = p;
        }
      }
      if (best) this.select(best.id);
    });
    this.canvas.addEventListener("pointercancel", () => (this.drag = null));
    this.canvas.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        this.select(this.query + (e.key === "ArrowRight" ? 1 : -1));
      }
    });
    document.querySelector("#geometry-pair").addEventListener("change", (e) => {
      this.pair = +e.target.value;
      this.select(this.data.pairs[this.pair].example);
    });
    document.querySelector("#next-query").onclick = () =>
      this.select(this.query + 1);
    document.querySelector("#previous-query").onclick = () =>
      this.select(this.query - 1);
    document.querySelector("#reset-camera").onclick = () => {
      this.yaw = -0.45;
      this.pitch = 0.28;
      this.render();
    };
    this.select(this.query);
    this.startHero();
  }
  sprite(el, index) {
    const size =
      parseFloat(getComputedStyle(el).backgroundSize.split(" ")[0]) / 32;
    el.style.backgroundPosition = `${-(index % 32) * size}px ${-Math.floor(index / 32) * size}px`;
  }
  select(index) {
    this.query =
      (index + this.data.episodes.length) % this.data.episodes.length;
    const p = this.data.pairs[this.pair];
    const shared = new Set(
      p.neighborsA[this.query].filter((i) =>
        p.neighborsB[this.query].includes(i),
      ),
    );
    document.querySelector("#query-id").textContent =
      `Observation ${this.data.episodes[this.query]}`;
    document.querySelector("#query-overlap").textContent =
      `${shared.size} / 10`;
    document.querySelector("#geometry-mean").textContent =
      `${(p.mean * 100).toFixed(1)}%`;
    this.sprite(document.querySelector("#query-image"), this.query);
    const strip = document.querySelector("#neighbor-strip");
    strip.replaceChildren();
    p.neighborsA[this.query].forEach((id) => {
      const b = document.createElement("button");
      b.className = shared.has(id) ? "shared" : "";
      b.title = `Observation ${this.data.episodes[id]} · ${shared.has(id) ? "shared by both encoders" : "encoder A only"}`;
      b.setAttribute("aria-label", b.title);
      b.onclick = () => this.select(id);
      strip.append(b);
      this.sprite(b, id);
    });
    this.render();
  }
  setup(canvas) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(r.width * dpr);
    const height = Math.round(r.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    return { ctx, w: r.width, h: r.height };
  }
  normalize(points) {
    if (this.normalized.has(points)) return this.normalized.get(points);
    const c = [0, 1, 2].map((j) => mean(points.map((p) => p[j])));
    const radius = Math.max(
      ...points.map((p) => Math.hypot(...p.map((v, j) => v - c[j]))),
    );
    const normalized = points.map((p) =>
      p.map((v, j) => (v - c[j]) / (radius || 1)),
    );
    this.normalized.set(points, normalized);
    return normalized;
  }
  project(p, cx, cy, scale, yaw = this.yaw, pitch = this.pitch) {
    const x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw),
      z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
    return {
      x: cx + x * scale,
      y: cy + (p[1] * Math.cos(pitch) - z * Math.sin(pitch)) * scale,
      z: p[1] * Math.sin(pitch) + z * Math.cos(pitch),
    };
  }
  dot(ctx, p, r, color, triangle = false) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (triangle) {
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x + r * 0.9, p.y + r * 0.65);
      ctx.lineTo(p.x - r * 0.9, p.y + r * 0.65);
      ctx.closePath();
    } else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  setExplorationStep(step) {
    this.explorationStep = Math.max(
      0,
      Math.min(2, Math.trunc(Number(step) || 0)),
    );
    this.canvas.dataset.explorationStep = String(this.explorationStep);
    this.render();
  }
  // Orthographic projection and a uniform display scale retain the geometry.
  // Fit the full projected bounds, including outliers, inside each viewport.
  fitCloud(points, box, yaw = this.yaw, pitch = this.pitch) {
    const projected = points.map((p, id) => ({
      ...this.project(p, 0, 0, 1, yaw, pitch),
      id,
    }));
    const xs = projected.map((p) => p.x),
      ys = projected.map((p) => p.y);
    const left = Math.min(...xs),
      right = Math.max(...xs);
    const top = Math.min(...ys),
      bottom = Math.max(...ys);
    const scale = Math.min(
      box.w / (right - left || 1),
      box.h / (bottom - top || 1),
    );
    return projected.map((p) => ({
      ...p,
      x: box.x + (p.x - (left + right) / 2) * scale,
      y: box.y + (p.y - (top + bottom) / 2) * scale,
    }));
  }
  glow(ctx, x, y, radius, color) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
    halo.addColorStop(0, color + "19");
    halo.addColorStop(0.55, color + "08");
    halo.addColorStop(1, color + "00");
    ctx.fillStyle = halo;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  queryMarker(ctx, point, color, radius = 12) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    this.dot(ctx, point, 5, colors.ink);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#17171e";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  render(refreshSprites = true) {
    const setup = this.setup(this.canvas);
    if (!setup) return;
    const { ctx, w, h } = setup,
      p = this.data.pairs[this.pair];
    this.points = [];
    const shared = new Set(
      p.neighborsA[this.query].filter((id) =>
        p.neighborsB[this.query].includes(id),
      ),
    );
    const reveal = this.explorationStep > 0;
    const pulse = this.reduced ? 0.5 : (1 + Math.sin(this.phase * 5)) / 2;
    const positions = ["a", "b"].map((side, j) =>
      this.fitCloud(this.normalize(p[side]), {
        x: w * (j ? 0.755 : 0.245),
        y: h * 0.5,
        w: Math.max(20, w * 0.45 - 18),
        h: Math.max(20, h - 54),
      }),
    );
    positions.forEach((pts, j) => {
      const base = j ? colors.teal : colors.purple;
      const ids = j ? p.neighborsB[this.query] : p.neighborsA[this.query];
      const query = pts[this.query];
      this.points.push(...pts);
      this.glow(
        ctx,
        w * (j ? 0.755 : 0.245),
        h * 0.5,
        Math.min(w * 0.3, h * 0.6),
        base,
      );
      pts
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((q) => {
          const depth = Math.max(0, Math.min(1, (q.z + 1) / 2));
          ctx.globalAlpha = (reveal ? 0.4 : 0.62) + depth * 0.28;
          this.dot(ctx, q, (w < 500 ? 1.9 : 2.4) + depth * 1.05, base);
        });
      ctx.globalAlpha = 1;
      if (reveal) {
        ids.forEach((id, i) => {
          const color = shared.has(id)
            ? colors.purple
            : j
              ? colors.teal
              : colors.sand;
          const target = pts[id];
          ctx.strokeStyle = color;
          ctx.globalAlpha = shared.has(id) ? 0.72 : 0.45;
          ctx.lineWidth = shared.has(id) ? 1.8 : 1.2;
          ctx.beginPath();
          ctx.moveTo(query.x, query.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
          // A light travels along an existing measured neighbor link only.
          if (!this.reduced && shared.has(id)) {
            const t = (this.phase * 0.7 + i / ids.length) % 1;
            this.dot(
              ctx,
              {
                x: query.x + (target.x - query.x) * t,
                y: query.y + (target.y - query.y) * t,
              },
              2,
              "#eeebff",
            );
          }
        });
        ids.forEach((id) => {
          const color = shared.has(id)
            ? colors.purple
            : j
              ? colors.teal
              : colors.sand;
          const point = pts[id];
          if (shared.has(id)) {
            ctx.globalAlpha = 0.15 + pulse * 0.12;
            this.dot(ctx, point, 10 + pulse * 2, color);
            ctx.globalAlpha = 1;
          }
          this.dot(ctx, point, w < 500 ? 5 : 6.2, color, !shared.has(id));
          ctx.strokeStyle = "#f4f0ff";
          ctx.lineWidth = shared.has(id) ? 1.2 : 0.6;
          ctx.stroke();
        });
      }
      this.queryMarker(ctx, query, colors.ink, w < 500 ? 10 : 13);
    });
    if (refreshSprites) {
      document
        .querySelectorAll("#neighbor-strip button")
        .forEach((el, i) => this.sprite(el, p.neighborsA[this.query][i]));
    }
  }
  drawHero() {
    const setup = this.setup(this.hero);
    if (!setup) return;
    const { ctx, w, h } = setup;
    const compact = w < 450;
    const yaw = -0.35 + Math.sin(this.phase * 0.5) * 0.5;
    const pitch = 0.32 + Math.sin(this.phase * 0.35) * 0.1;
    const centers = [
      [w * 0.34, h * 0.29],
      [w * 0.66, h * 0.71],
    ];
    const positions = this.heroClouds.map((points, j) =>
      this.fitCloud(
        points,
        {
          x: centers[j][0],
          y: centers[j][1],
          w: w * 0.66 - 24,
          h: h * (compact ? 0.5 : 0.54) - 20,
        },
        yaw,
        pitch,
      ),
    );
    this.heroPositions = positions;
    centers.forEach(([x, y], j) =>
      this.glow(
        ctx,
        x,
        y,
        Math.min(w * 0.43, h * 0.39),
        j ? colors.teal : colors.purple,
      ),
    );

    // The sweeping bridge restores the original visual motif. Each curve joins
    // the same measured observation ID: a sparse sample plus the exact k-NN
    // intersection. It does not depict learned alignment or moving features.
    const bridgeIds = new Set(this.heroShared);
    for (let id = 0; id < positions[0].length; id += 34) bridgeIds.add(id);
    bridgeIds.add(this.heroQuery);
    [...bridgeIds].forEach((id, i) => {
      const a = positions[0][id],
        b = positions[1][id];
      const focus = this.heroFocus.has(id);
      const c1 = { x: w * 0.22, y: h * 0.53 };
      const c2 = { x: w * 0.8, y: h * 0.47 };
      const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      gradient.addColorStop(0, colors.purple);
      gradient.addColorStop(0.5, "#b7b8ec");
      gradient.addColorStop(1, colors.teal);
      ctx.globalAlpha = focus ? 0.38 : 0.14;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = focus ? 1.35 : 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      ctx.stroke();
      if (focus && !this.reduced) {
        const t = (this.phase * 0.3 + i * 0.13) % 1,
          u = 1 - t;
        ctx.globalAlpha = 0.8;
        this.dot(
          ctx,
          {
            x:
              u ** 3 * a.x +
              3 * u ** 2 * t * c1.x +
              3 * u * t ** 2 * c2.x +
              t ** 3 * b.x,
            y:
              u ** 3 * a.y +
              3 * u ** 2 * t * c1.y +
              3 * u * t ** 2 * c2.y +
              t ** 3 * b.y,
          },
          compact ? 1.5 : 2.1,
          "#d8d4ff",
        );
      }
    });
    ctx.globalAlpha = 1;
    positions.forEach((points, j) => {
      const color = j ? colors.teal : colors.purple;
      const query = points[this.heroQuery];
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      this.heroShared.forEach((id) => {
        ctx.beginPath();
        ctx.moveTo(query.x, query.y);
        ctx.lineTo(points[id].x, points[id].y);
        ctx.stroke();
      });
      points
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((point) => {
          if (this.heroFocus.has(point.id)) return;
          const depth = Math.max(0, Math.min(1, (point.z + 1) / 2));
          ctx.globalAlpha = 0.58 + depth * 0.4;
          this.dot(ctx, point, (compact ? 1.55 : 2.05) + depth * 1.25, color);
        });
      ctx.globalAlpha = 1;
      this.heroShared.forEach((id) => {
        const point = points[id];
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        this.dot(ctx, point, compact ? 3.7 : 4.7, color);
        ctx.shadowBlur = 0;
        this.dot(ctx, point, 1.4, j ? "#d5fff3" : "#e5e2ff");
      });
      this.queryMarker(ctx, query, j ? "#b0eadc" : "#d4d0ff", compact ? 8 : 11);
    });
  }
  stopHero() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.lastHeroFrame = null;
  }
  pauseHero() {
    this.heroPaused = true;
    this.stopHero();
    this.startHero();
  }
  resumeHero() {
    this.heroPaused = false;
    this.startHero();
  }
  pauseExploration() {
    this.explorerPaused = true;
    this.stopHero();
    this.startHero();
  }
  resumeExploration() {
    this.explorerPaused = false;
    this.startHero();
  }
  startHero() {
    const active = () =>
      !document.hidden &&
      ((this.heroVisible && !this.heroPaused) ||
        (this.explorerVisible && !this.explorerPaused));
    if (this.frame !== null || !active()) return;
    const draw = () => {
      if (this.heroVisible && !this.heroPaused) this.drawHero();
      if (this.explorerVisible && !this.explorerPaused) this.render(false);
    };
    draw();
    if (this.reduced) return;
    this.lastHeroFrame = null;
    const tick = (time) => {
      this.frame = null;
      if (!active() || this.reduced) return;
      if (this.lastHeroFrame === null) this.lastHeroFrame = time;
      const elapsed = time - this.lastHeroFrame;
      // Thirty drawn frames per second is sufficient for the slow camera drift.
      if (elapsed >= 1000 / 30) {
        this.phase += Math.min(elapsed, 100) * 0.00011;
        this.lastHeroFrame = time;
        draw();
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
