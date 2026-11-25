const colors = {
  purple: "#8080ff",
  deep: "#5751b9",
  teal: "#397f7d",
  sand: "#b69a79",
  ink: "#262538",
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
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.heroVisible = true;
    this.phase = 0;
    new ResizeObserver(() => this.render()).observe(this.canvas);
    new ResizeObserver(() => this.drawHero()).observe(this.hero);
    new IntersectionObserver(([entry]) => {
      this.heroVisible = entry.isIntersecting;
      if (this.heroVisible) this.startHero();
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
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }
  normalize(points) {
    const c = [0, 1, 2].map((j) => mean(points.map((p) => p[j])));
    const radius = Math.max(
      ...points.map((p) => Math.hypot(...p.map((v, j) => v - c[j]))),
    );
    return points.map((p) => p.map((v, j) => (v - c[j]) / radius));
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
      ctx.strokeStyle = "#ddd9ea";
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
            j ? "#81b2aa65" : "#a8a0d075",
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
        ctx.strokeStyle = "#ffffff";
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
  drawHero() {
    const setup = this.setup(this.hero);
    if (!setup) return;
    const { ctx, w, h } = setup,
      p = this.data.pairs[0];
    const positions = [];
    ["a", "b"].forEach((side, j) => {
      const pts = this.normalize(p[side]);
      positions[j] = pts.map((v) =>
        this.project(
          v,
          w * (j ? 0.66 : 0.34),
          h * (j ? 0.69 : 0.3),
          Math.min(w * 0.39, h * 0.3),
          -0.35 + this.phase,
          0.32,
        ),
      );
    });
    for (let id = 0; id < 606; id += 34) {
      ctx.strokeStyle = "#9b95dc35";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(positions[0][id].x, positions[0][id].y);
      ctx.bezierCurveTo(
        w * 0.3,
        h * 0.5,
        w * 0.7,
        h * 0.49,
        positions[1][id].x,
        positions[1][id].y,
      );
      ctx.stroke();
    }
    positions.forEach((pts, j) => {
      pts
        .map((p, id) => ({ ...p, id }))
        .sort((a, b) => a.z - b.z)
        .forEach((q) => {
          const focus = p.neighborsA[15].includes(q.id) || q.id === 15;
          this.dot(
            ctx,
            q,
            focus ? 3.7 : 1.4 + (q.z + 1) * 0.7,
            focus
              ? j
                ? colors.teal
                : colors.deep
              : j
                ? "#5b9f9675"
                : "#9990dd85",
          );
        });
    });
  }
  startHero() {
    if (this.frame) return;
    const tick = () => {
      this.frame = null;
      if (!this.heroVisible || document.hidden) return;
      if (!this.reduced) this.phase += 0.0012;
      this.drawHero();
      if (!this.reduced) this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
}
