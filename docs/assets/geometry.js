const colors = {
  purple: "#a29cff",
  deep: "#c6c3ff",
  teal: "#68c5b4",
  sand: "#d4b590",
  ink: "#f2f0ff",
};
const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;

const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function hull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list) => {
    const result = [];
    for (const p of list) {
      while (result.length > 1) {
        const [a, b] = result.slice(-2);
        if ((b.x - a.x) * (p.y - a.y) > (b.y - a.y) * (p.x - a.x)) break;
        result.pop();
      }
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

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
    this.explorationStep = 0;
    this.explorerTime = 0;
    this.transitionTime = 0;
    this.animateSelection = false;
    this.stageFrom = [0, 0];
    this.stageStart = -10;
    this.pairFrom = data.pairs.map((_, i) => Number(i === 0));
    this.pairStart = -10;
    this.queryStart = -10;
    this.hover = null;
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
      this.stageStart = this.pairStart = this.queryStart = -10;
      this.previousNeighborhoods = null;
      this.animateSelection = false;
      this.render(false);
      this.drawHero();
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
      if (e.button !== 0 || !e.isPrimary) return;
      this.drag = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!e.isPrimary) return;
      if (this.drag) {
        this.yaw += (e.clientX - this.drag.x) * 0.008;
        this.pitch = Math.max(
          -1.2,
          Math.min(1.2, this.pitch + (e.clientY - this.drag.y) * 0.008),
        );
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        this.hover = null;
      } else {
        this.hover = this.hitTest(e);
      }
      this.render(false);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hover = null;
      this.render(false);
    });
    this.canvas.addEventListener("pointerup", (e) => {
      if (e.pointerId !== this.drag?.pointerId) return;
      const moved =
        Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) >
        5;
      this.drag = null;
      if (moved) {
        this.render(false);
        return;
      }
      const target = this.hitTest(e);
      if (!target) return;
      this.select(target.id);
    });
    this.canvas.addEventListener("pointercancel", (e) => {
      if (e.pointerId !== this.drag?.pointerId) return;
      this.drag = null;
      this.hover = null;
      this.render(false);
    });
    this.canvas.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const direction = e.key === "ArrowRight" ? 1 : -1;
      this.select(this.query + direction);
    });
    document.querySelector("#geometry-pair").addEventListener("change", (e) => {
      const next = +e.target.value;
      if (next === this.pair || !this.data.pairs[next]) return;
      this.pairFrom = this.pairWeights();
      this.pairStart = this.transitionTime;
      this.pair = next;
      this.select(this.query);
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
    this.hover = null;
    this.query =
      (index + this.data.episodes.length) % this.data.episodes.length;
    const p = this.data.pairs[this.pair];
    this.previousNeighborhoods = this.neighborhoods;
    this.neighborhoods = this.chooseNeighborhoods(p, this.query);
    this.queryStart = this.previousNeighborhoods ? this.transitionTime : -10;
    this.animateSelection = !this.reduced;
    const shared = this.neighborhoods[0].shared;
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
    this.startHero();
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
  fraction(start, duration) {
    return this.reduced ? 1 : smooth((this.transitionTime - start) / duration);
  }
  stageWeights() {
    const t = this.fraction(this.stageStart, 1.5);
    return this.stageFrom.map((value, i) =>
      mix(value, Number(this.explorationStep > i), t),
    );
  }
  pairWeights() {
    const t = this.fraction(this.pairStart, 1.5);
    return this.pairFrom.map((value, i) =>
      mix(value, Number(this.pair === i), t),
    );
  }
  setExplorationStep(step) {
    const next = Math.max(0, Math.min(2, Math.trunc(Number(step) || 0)));
    if (next !== this.explorationStep) {
      this.stageFrom = this.stageWeights();
      this.stageStart = this.transitionTime;
      this.explorationStep = next;
      this.animateSelection = !this.reduced;
      this.hover = null;
    }
    this.canvas.dataset.explorationStep = String(next);
    this.canvas.setAttribute(
      "aria-label",
      [
        "Two projections of the same observations.",
        "The same two spaces show both ten-neighbor sets for the selected observation. Curves join shared neighbor IDs.",
        "The two spaces show the selected neighborhood and additional measured neighborhoods in the current model pair.",
      ][next] +
        " Drag to rotate, select a point to inspect, or use left and right arrow keys.",
    );
    this.render();
    this.startHero();
  }
  hitTest(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    let best = null,
      distance = 10;
    for (const point of this.points) {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < distance) {
        best = point;
        distance = d;
      }
    }
    return best;
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
  label(ctx, text, x, y, size, color, align = "left", weight = 500) {
    ctx.font = `${weight} ${size}px Manrope, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  chooseNeighborhoods(pair, query) {
    // Choose three separated example centers in a fixed display view. Keeping
    // their IDs fixed across pairs also keeps the comparison on the same inputs.
    // Agreement scores never enter the choice of example centers.
    if (!this.referenceLayout) {
      const first = this.data.pairs[0];
      this.referenceLayout = [first.a, first.b].map((rows) =>
        this.normalize(rows).map((p) => this.project(p, 0, 0, 1, -0.45, 0.28)),
      );
    }
    const centers = [query];
    for (let i = 0; i < 3; i++) {
      let best = 0,
        separation = -1;
      this.referenceLayout[0].forEach((_, id) => {
        let nearest = Infinity;
        for (const layout of this.referenceLayout) {
          for (const other of centers) {
            nearest = Math.min(
              nearest,
              Math.hypot(
                layout[other].x - layout[id].x,
                layout[other].y - layout[id].y,
              ),
            );
          }
        }
        if (nearest > separation) {
          separation = nearest;
          best = id;
        }
      });
      centers.push(best);
    }
    return centers.map((id) => {
      const lists = [pair.neighborsA[id], pair.neighborsB[id]];
      const shared = new Set(lists[0].filter((n) => lists[1].includes(n)));
      return { id, lists, shared };
    });
  }
  render(refreshSprites = true) {
    const setup = this.setup(this.canvas);
    if (!setup || !this.neighborhoods) return;
    const { ctx, w, h } = setup;
    const weights = this.pairWeights();
    const positions = ["a", "b"].map((side, j) => {
      const box = {
        x: w * (j ? 0.755 : 0.245),
        y: h * 0.5,
        w: Math.max(20, w * 0.46 - 12),
        h: Math.max(20, h - 48),
      };
      let blended;
      // Display-only interpolation joins corresponding observation IDs between
      // measured t-SNE snapshots. Membership always comes from the 192D lists.
      weights.forEach((weight, i) => {
        if (weight <= 0) return;
        const points = this.fitCloud(
          this.normalize(this.data.pairs[i][side]),
          box,
        );
        if (weight === 1) {
          blended = points;
          return;
        }
        if (!blended)
          blended = points.map((p) => ({ id: p.id, x: 0, y: 0, z: 0 }));
        points.forEach((p, k) => {
          blended[k].x += weight * p.x;
          blended[k].y += weight * p.y;
          blended[k].z += weight * p.z;
        });
      });
      return blended;
    });
    this.points = positions.flat();
    const [focus, field] = this.stageWeights();
    positions.forEach((points, j) => {
      const base = j ? colors.teal : colors.purple;
      this.glow(
        ctx,
        w * (j ? 0.755 : 0.245),
        h * 0.5,
        Math.min(w * 0.3, h * 0.6),
        base,
      );
      [...points]
        .sort((a, b) => a.z - b.z)
        .forEach((p) => {
          const depth = clamp((p.z + 1) / 2);
          ctx.globalAlpha = (0.53 + depth * 0.4) * (1 - 0.53 * focus);
          this.dot(ctx, p, (w < 500 ? 1.5 : 2) + depth * 1.2, base);
        });
      ctx.globalAlpha = 1;
    });
    const t = this.fraction(this.queryStart, 0.9);
    const layers = [
      [this.previousNeighborhoods, 1 - t],
      [this.neighborhoods, t],
    ];
    for (const [groups, opacity] of layers) {
      if (!groups || opacity <= 0) continue;
      groups.slice(1).forEach((group, i) => {
        const reveal = smooth((field - i * 0.23) / 0.54);
        if (reveal > 0)
          this.drawNeighborhood(
            ctx,
            positions,
            group,
            opacity * reveal,
            false,
            w,
          );
      });
    }
    for (const [groups, opacity] of layers) {
      if (groups && opacity * focus > 0)
        this.drawNeighborhood(
          ctx,
          positions,
          groups[0],
          opacity * focus,
          true,
          w,
        );
    }
    positions.forEach((points) => {
      for (const [groups, opacity] of layers) {
        if (!groups || opacity <= 0) continue;
        ctx.globalAlpha = opacity;
        this.queryMarker(
          ctx,
          points[groups[0].id],
          colors.ink,
          w < 500 ? 8 : 11,
        );
      }
      ctx.globalAlpha = 1;
      if (!this.hover) return;
      const p = points[this.hover.id];
      this.queryMarker(ctx, p, colors.deep, 7);
      const text = "#" + this.data.episodes[p.id];
      const x = Math.min(w - 63, Math.max(2, p.x - 28));
      const y = Math.max(1, p.y - 32);
      ctx.fillStyle = "#1e1d2a";
      ctx.fillRect(x, y, 61, 20);
      this.label(ctx, text, x + 30, y + 10, 11, colors.ink, "center");
    });
    this.canvas.style.cursor = this.drag
      ? "grabbing"
      : this.hover
        ? "pointer"
        : "grab";
    if (refreshSprites) {
      const ids = this.neighborhoods[0].lists[0];
      document
        .querySelectorAll("#neighbor-strip button")
        .forEach((el, i) => this.sprite(el, ids[i]));
    }
  }
  drawNeighborhood(ctx, positions, group, opacity, primary, w) {
    const compact = w < 500;
    const sharedColor = primary ? "#c0adff" : "#93b7c8";
    const shared = [...group.shared];
    // All ten memberships are drawn for the selected query. Background
    // examples use three representative shared spokes and two identity links.
    const bridges = primary ? shared : shared.slice(0, 2);
    bridges.forEach((id, i) => {
      const a = positions[0][id],
        b = positions[1][id];
      const offset = (i - (bridges.length - 1) / 2) * (primary ? 5 : 3);
      const dx = (b.x - a.x) * 0.43;
      ctx.globalAlpha = opacity * (primary ? 0.61 : 0.47);
      ctx.strokeStyle = sharedColor;
      ctx.lineWidth = primary ? 1.35 : 1.05;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(
        a.x + dx,
        a.y + offset,
        b.x - dx,
        b.y + offset,
        b.x,
        b.y,
      );
      ctx.stroke();
    });
    positions.forEach((points, side) => {
      const q = points[group.id],
        ids = group.lists[side];
      const outline = hull([q, ...ids.map((id) => points[id])]);
      if (outline.length > 2) {
        const ink = primary
          ? side
            ? colors.teal
            : colors.purple
          : sharedColor;
        ctx.fillStyle = ink;
        ctx.strokeStyle = ink;
        ctx.lineWidth = primary ? 1.15 : 0.9;
        ctx.beginPath();
        outline.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.globalAlpha = opacity * (primary ? 0.135 : 0.1);
        ctx.fill();
        ctx.globalAlpha = opacity * (primary ? 0.64 : 0.48);
        ctx.stroke();
      }
      const links = primary ? ids : shared.slice(0, 3);
      for (const id of links) {
        const p = points[id],
          common = group.shared.has(id);
        const color = common ? sharedColor : side ? colors.teal : colors.sand;
        ctx.globalAlpha = opacity * (primary ? 0.78 : 0.62);
        ctx.strokeStyle = color;
        ctx.lineWidth = primary ? 1.4 : 1.05;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      for (const id of links) {
        const p = points[id],
          common = group.shared.has(id);
        const color = common ? sharedColor : side ? colors.teal : colors.sand;
        ctx.globalAlpha = opacity;
        this.dot(
          ctx,
          p,
          primary ? (compact ? 3.6 : 4.8) : compact ? 2.7 : 3.6,
          color,
          !common,
        );
        ctx.strokeStyle = "#201e2e";
        ctx.lineWidth = primary ? 1.1 : 0.75;
        ctx.stroke();
      }
      if (!primary) {
        ctx.globalAlpha = opacity * 0.88;
        ctx.strokeStyle = sharedColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(q.x, q.y, compact ? 4.7 : 6.1, 0, 2 * Math.PI);
        ctx.stroke();
        this.dot(ctx, q, 2.1, sharedColor);
      }
    });
    ctx.globalAlpha = 1;
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
      ctx.globalAlpha = focus ? 0.41 : 0.14;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = focus ? 1.35 : 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      ctx.stroke();
      if (focus && !this.reduced) {
        const t = (this.phase * 0.3 + i * 0.13) % 1,
          u = 1 - t;
        const light = {
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
        };
        ctx.globalAlpha = 0.17;
        this.dot(ctx, light, compact ? 3.3 : 4.2, "#c3d6ff");
        ctx.globalAlpha = 0.87;
        this.dot(ctx, light, compact ? 1.5 : 2.1, "#e8efff");
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
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.62;
        ctx.beginPath();
        ctx.arc(point.x, point.y, compact ? 5.4 : 6.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
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
    this.animateSelection = false;
    this.stopHero();
    this.startHero();
  }
  transitionsPending() {
    return (
      this.transitionTime <
      Math.max(
        this.stageStart + 1.5,
        this.pairStart + 1.5,
        this.queryStart + 0.9,
      )
    );
  }
  resumeExploration() {
    this.explorerPaused = false;
    this.animateSelection = !this.reduced && this.transitionsPending();
    this.startHero();
  }
  startHero() {
    const explorerActive = () =>
      this.explorerVisible &&
      (this.animateSelection ||
        (!this.explorerPaused && this.explorationStep === 0));
    const active = () =>
      !document.hidden &&
      ((this.heroVisible && !this.heroPaused) || explorerActive());
    if (this.frame !== null || !active()) return;
    const draw = () => {
      if (this.heroVisible && !this.heroPaused) this.drawHero();
      if (explorerActive()) this.render(false);
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
        const seconds = Math.min(elapsed, 100) / 1000;
        if (this.heroVisible && !this.heroPaused) this.phase += seconds * 0.11;
        if (explorerActive()) {
          this.transitionTime += seconds;
        }
        if (this.explorerVisible && !this.explorerPaused) {
          this.explorerTime += seconds;
          if (this.explorationStep === 0 && !this.drag && !this.hover)
            this.yaw += seconds * 0.075;
        }
        this.lastHeroFrame = time;
        draw();
        if (!this.transitionsPending()) {
          this.animateSelection = false;
          this.previousNeighborhoods = null;
        }
      }
      if (active()) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
