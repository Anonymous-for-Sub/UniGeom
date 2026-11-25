const colors = {
  purple: "#9995ff",
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
    this.heroPaused = false;
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
      else this.stopHero();
    }).observe(this.hero);
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
  render() {
    const setup = this.setup(this.canvas);
    if (!setup) return;
    const { ctx, w, h } = setup,
      p = this.data.pairs[this.pair];
    this.points = [];
    const shared = new Set(
      p.neighborsA[this.query].filter((i) =>
        p.neighborsB[this.query].includes(i),
      ),
    );
    ["a", "b"].forEach((side, j) => {
      const cx = w * (j ? 0.76 : 0.24),
        cy = h * 0.51,
        scale = Math.min(w * 0.24, h * 0.43);
      const pts = this.normalize(p[side]).map((v, id) => ({
        ...this.project(v, cx, cy, scale),
        id,
      }));
      this.points.push(...pts);
      // Common view rotation, independent original 3D coordinates.
      ctx.strokeStyle = "#454451";
      ctx.lineWidth = 0.7;
      [
        [-1, -0.95, -0.8],
        [0.9, -0.95, -0.8],
        [-1, 0.9, -0.8],
        [-1, -0.95, 0.9],
      ]
        .map((v) => this.project(v, cx, cy, scale))
        .forEach((q, i, a) => {
          if (i) {
            ctx.beginPath();
            ctx.moveTo(a[0].x, a[0].y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        });
      pts
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((q) =>
          this.dot(
            ctx,
            q,
            1.8 + (q.z + 1) * 0.35,
            j ? "#68c5b47a" : "#9995ff8c",
          ),
        );
      const ids = j ? p.neighborsB[this.query] : p.neighborsA[this.query];
      const query = pts[this.query];
      ids.forEach((id) => {
        const color = shared.has(id)
          ? colors.purple
          : j
            ? colors.teal
            : colors.sand;
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(query.x, query.y);
        ctx.lineTo(pts[id].x, pts[id].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      ids.forEach((id) => {
        const color = shared.has(id)
          ? colors.purple
          : j
            ? colors.teal
            : colors.sand;
        this.dot(ctx, pts[id], 5.2, color, !shared.has(id));
        ctx.strokeStyle = "#15151d";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(query.x, query.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      this.dot(ctx, query, 4, colors.ink);
    });
    document
      .querySelectorAll("#neighbor-strip button")
      .forEach((el, i) => this.sprite(el, p.neighborsA[this.query][i]));
  }
  projectCloud(points, cx, cy, scale, yaw, pitch) {
    const cosY = Math.cos(yaw),
      sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch),
      sinP = Math.sin(pitch);
    return points.map((p, id) => {
      const x = p[0] * cosY + p[2] * sinY;
      const z = -p[0] * sinY + p[2] * cosY;
      const depth = p[1] * sinP + z * cosP;
      const perspective = 3.8 / (3.8 - depth);
      return {
        id,
        x: cx + x * scale * perspective,
        y: cy + (p[1] * cosP - z * sinP) * scale * perspective,
        z: depth,
      };
    });
  }
  drawHero() {
    const setup = this.setup(this.hero);
    if (!setup) return;
    const { ctx, w, h } = setup;
    const scale = Math.min(w * 0.37, h * 0.29);
    const centers = [
      [w * 0.32, h * 0.32],
      [w * 0.68, h * 0.67],
    ];
    const yaw = -0.35 + Math.sin(this.phase * 0.6) * 0.42;
    const pitch = 0.29 + Math.sin(this.phase * 0.4) * 0.09;
    const positions = this.heroClouds.map((points, j) =>
      this.projectCloud(points, ...centers[j], scale, yaw, pitch),
    );

    // Soft lighting is decorative; every visible dot below is a measured point.
    centers.forEach(([x, y], j) => {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, scale * 1.35);
      halo.addColorStop(0, j ? "#68c5b412" : "#9995ff19");
      halo.addColorStop(0.5, j ? "#68c5b407" : "#9995ff09");
      halo.addColorStop(1, "#10101400");
      ctx.fillStyle = halo;
      ctx.fillRect(
        x - scale * 1.35,
        y - scale * 1.35,
        scale * 2.7,
        scale * 2.7,
      );
    });

    // Join only identical observation IDs in the measured k-NN intersection.
    // These curves communicate observation identity, not geometric alignment.
    this.heroShared.forEach((id, i) => {
      const a = positions[0][id],
        b = positions[1][id];
      const emphasis = this.reduced
        ? 0.5
        : 0.5 + 0.5 * Math.sin(this.phase * 2 - i * 0.6);
      const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      gradient.addColorStop(0, "#9995ff");
      gradient.addColorStop(0.52, "#a3b5d7");
      gradient.addColorStop(1, "#68c5b4");
      ctx.globalAlpha = 0.12 + emphasis * 0.16;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = w < 450 ? 0.75 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(
        a.x + w * 0.16,
        a.y + h * 0.12,
        b.x - w * 0.16,
        b.y - h * 0.12,
        b.x,
        b.y,
      );
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    positions.forEach((points, j) => {
      const color = j ? colors.teal : colors.purple;
      const query = points[this.heroQuery];
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.65;
      ctx.globalAlpha = 0.26;
      this.heroShared.forEach((id) => {
        ctx.beginPath();
        ctx.moveTo(query.x, query.y);
        ctx.lineTo(points[id].x, points[id].y);
        ctx.stroke();
      });
      const sorted = [...points].sort((a, b) => a.z - b.z);
      sorted.forEach((point) => {
        if (this.heroFocus.has(point.id)) return;
        const depth = Math.max(0, Math.min(1, (point.z + 1) / 2));
        ctx.globalAlpha = 0.22 + depth * 0.66;
        this.dot(ctx, point, (w < 450 ? 0.8 : 1) + depth * 1.15, color);
      });
      ctx.globalAlpha = 1;
      this.heroShared.forEach((id) => {
        const point = points[id];
        ctx.shadowColor = color;
        ctx.shadowBlur = 9;
        this.dot(ctx, point, w < 450 ? 2.6 : 3.1, color);
        ctx.shadowBlur = 0;
        this.dot(ctx, point, 1, j ? "#d5fff3" : "#e5e2ff");
      });
      ctx.strokeStyle = j ? "#b0eadc" : "#c6c3ff";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(query.x, query.y, w < 450 ? 6.5 : 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      this.dot(ctx, query, 3.3, colors.ink);
      ctx.shadowBlur = 0;
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
  }
  resumeHero() {
    this.heroPaused = false;
    this.startHero();
  }
  startHero() {
    if (
      this.frame !== null ||
      this.heroPaused ||
      !this.heroVisible ||
      document.hidden
    )
      return;
    this.drawHero();
    if (this.reduced) return;
    this.lastHeroFrame = null;
    const tick = (time) => {
      this.frame = null;
      if (
        this.heroPaused ||
        !this.heroVisible ||
        document.hidden ||
        this.reduced
      )
        return;
      if (this.lastHeroFrame === null) this.lastHeroFrame = time;
      const elapsed = time - this.lastHeroFrame;
      // Thirty drawn frames per second is sufficient for the slow camera drift.
      if (elapsed >= 1000 / 30) {
        this.phase += Math.min(elapsed, 100) * 0.00011;
        this.lastHeroFrame = time;
        this.drawHero();
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
