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
    this.explorationStep = 0;
    this.explorerTime = 0;
    this.enteredAt = -10;
    this.hover = null;
    this.bin = null;
    this.chartRows = [];
    // Each bin retains its real observation IDs, in the order they were measured.
    this.histograms = data.pairs.map((pair) => {
      const bins = Array.from({ length: 11 }, () => []);
      pair.shared.forEach((count, id) => bins[count].push(id));
      return bins;
    });
    this.chartMax =
      Math.ceil(Math.max(...this.histograms.flat().map((b) => b.length)) / 25) *
      25;
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
      if (this.explorationStep === 0) {
        this.drag = {
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
        };
        this.canvas.setPointerCapture(e.pointerId);
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
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
        if (this.explorationStep === 2 && this.hover) this.enteredAt = -10;
      }
      this.render(false);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hover = null;
      this.render(false);
    });
    this.canvas.addEventListener("pointerup", (e) => {
      const moved =
        this.drag &&
        Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) >
          5;
      this.drag = null;
      if (moved) return;
      const target = this.hitTest(e);
      if (!target) return;
      if (this.explorationStep === 2) this.inspectBin(target);
      else this.select(target.id);
    });
    this.canvas.addEventListener("pointercancel", () => {
      this.drag = null;
      this.hover = null;
    });
    this.canvas.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const direction = e.key === "ArrowRight" ? 1 : -1;
      if (this.explorationStep === 2) {
        const current =
          this.bin?.index ?? this.data.pairs[this.pair].shared[this.query];
        this.inspectBin({
          pair: this.pair,
          index: (current + direction + 11) % 11,
        });
      } else this.select(this.query + direction);
    });
    document.querySelector("#geometry-pair").addEventListener("change", (e) => {
      this.pair = +e.target.value;
      this.bin = null;
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
    if (this.explorationStep === 1 && !this.reduced && !this.explorerPaused)
      this.enteredAt = this.explorerTime;
    this.hover = null;
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
    const next = Math.max(0, Math.min(2, Math.trunc(Number(step) || 0)));
    if (next !== this.explorationStep) {
      if (!this.reduced && !this.explorerPaused && this.canvas.clientWidth) {
        this.previousFrame = document.createElement("canvas");
        this.previousFrame.width = this.canvas.width;
        this.previousFrame.height = this.canvas.height;
        this.previousFrame.getContext("2d").drawImage(this.canvas, 0, 0);
      } else this.previousFrame = null;
      this.enteredAt =
        this.reduced || this.explorerPaused ? -10 : this.explorerTime;
      this.explorationStep = next;
      this.hover = this.drag = this.bin = null;
    }
    this.canvas.dataset.explorationStep = String(next);
    this.canvas.setAttribute(
      "aria-label",
      [
        "Two 3D projections of the same observations. Drag to rotate or select an observation.",
        "Two ordered lists of the ten nearest neighbors. Lines join matching observation IDs. Select a neighbor or use the arrow keys to change the query.",
        "Overlap distributions for three model pairs. Each histogram counts all 606 observations by how many of their ten neighbors agree. Select a bar or use the arrow keys to inspect its count.",
      ][next],
    );
    this.canvas.style.cursor = next === 0 ? "grab" : "default";
    this.render();
    this.startHero();
  }
  hitTest(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    if (this.explorationStep === 2) {
      const row = this.chartRows.find((r) => y >= r.top && y < r.bottom);
      if (!row || x < row.x || x >= row.x + row.width) return null;
      return {
        pair: row.pair,
        index: Math.floor(((x - row.x) * 11) / row.width),
      };
    }
    let best = null,
      distance = 13;
    for (const point of this.points) {
      if (
        point.left !== undefined &&
        x >= point.left &&
        x <= point.right &&
        Math.abs(y - point.y) < point.h / 2
      )
        return point;
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < distance) {
        best = point;
        distance = d;
      }
    }
    return best;
  }
  inspectBin(target) {
    if (target.pair !== this.pair) {
      const select = document.querySelector("#geometry-pair");
      select.value = String(target.pair);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    this.bin = target;
    this.hover = null;
    this.enteredAt = -10;
    const count = this.histograms[target.pair][target.index].length;
    this.canvas.setAttribute(
      "aria-label",
      `Pair ${target.pair + 1}, ${target.index} shared neighbors, ${count} of 606 observations. Use the arrow keys to inspect other bins.`,
    );
    this.render(false);
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
  render(refreshSprites = true) {
    const setup = this.setup(this.canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;
    this.points = [];
    this.chartRows = [];
    const elapsed = this.reduced ? 10 : this.explorerTime - this.enteredAt;
    if (this.explorationStep === 0) this.drawSpaces(ctx, w, h);
    if (this.explorationStep === 1) this.drawRanks(ctx, w, h, elapsed);
    if (this.explorationStep === 2) this.drawDistributions(ctx, w, h, elapsed);
    if (this.previousFrame && elapsed < 0.36) {
      ctx.globalAlpha = (1 - elapsed / 0.36) ** 2;
      ctx.drawImage(this.previousFrame, 0, 0, w, h);
      ctx.globalAlpha = 1;
    } else this.previousFrame = null;
    this.canvas.style.cursor = this.hover
      ? "pointer"
      : this.explorationStep === 0
        ? "grab"
        : "default";
    if (refreshSprites) {
      const ids = this.data.pairs[this.pair].neighborsA[this.query];
      document
        .querySelectorAll("#neighbor-strip button")
        .forEach((el, i) => this.sprite(el, ids[i]));
    }
  }
  drawSpaces(ctx, w, h) {
    const pair = this.data.pairs[this.pair];
    ["a", "b"].forEach((side, j) => {
      const base = j ? colors.teal : colors.purple;
      const cx = w * (j ? 0.755 : 0.245),
        cy = h * 0.5;
      const pts = this.fitCloud(this.normalize(pair[side]), {
        x: cx,
        y: cy,
        w: Math.max(20, w * 0.46 - 12),
        h: Math.max(20, h - 48),
      });
      this.points.push(...pts);
      this.glow(ctx, cx, cy, Math.min(w * 0.3, h * 0.6), base);
      pts
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((point) => {
          const depth = Math.max(0, Math.min(1, (point.z + 1) / 2));
          ctx.globalAlpha = 0.53 + depth * 0.4;
          this.dot(ctx, point, (w < 500 ? 1.5 : 2) + depth * 1.2, base);
        });
      ctx.globalAlpha = 1;
      this.queryMarker(ctx, pts[this.query], colors.ink, w < 500 ? 8 : 11);
      if (this.hover) {
        const point = pts[this.hover.id];
        this.queryMarker(ctx, point, base, 7);
        const text = `#${this.data.episodes[point.id]}`;
        const x = Math.min(w - 63, Math.max(2, point.x - 28));
        const y = Math.max(1, point.y - 32);
        ctx.fillStyle = "#1e1d2a";
        ctx.fillRect(x, y, 61, 20);
        this.label(ctx, text, x + 30, y + 10, 11, colors.ink, "center");
      }
    });
  }
  drawRanks(ctx, w, h, elapsed) {
    const pair = this.data.pairs[this.pair];
    const lists = [pair.neighborsA[this.query], pair.neighborsB[this.query]];
    const compact = w < 460;
    const rowHeight = Math.min(34, (h - 57) / 10);
    const top = (h - rowHeight * 10 - 48) / 2;
    const left = Math.max(10, w * 0.065),
      right = w - left;
    const pins = [w * 0.36, w * 0.64];
    const shared = new Set(lists[0].filter((id) => lists[1].includes(id)));
    const font = Math.min(compact ? 12 : 15, Math.max(10, rowHeight * 0.63));
    const rowY = (rank) => top + 48 + (rank + 0.5) * rowHeight;
    this.label(
      ctx,
      `Query #${this.data.episodes[this.query]}   ·   ${shared.size} / 10 shared`,
      w / 2,
      top + 9,
      compact ? 13 : 15,
      colors.ink,
      "center",
      700,
    );
    this.label(
      ctx,
      "Encoder A",
      left,
      top + 35,
      font,
      colors.deep,
      "left",
      700,
    );
    this.label(
      ctx,
      "Encoder B",
      right,
      top + 35,
      font,
      colors.teal,
      "right",
      700,
    );
    // Rank determines row position; each bridge joins exactly the same observation.
    // The original 192D neighbor order comes directly from the exported lists.
    const mid = w / 2;
    for (const id of shared) {
      const a = lists[0].indexOf(id),
        b = lists[1].indexOf(id);
      const y0 = rowY(a),
        y1 = rowY(b);
      const muted = this.hover && this.hover.id !== id;
      const selected = this.hover?.id === id;
      const t = Math.min(1, Math.max(0, (elapsed - a * 0.048) / 0.75));
      ctx.save();
      ctx.beginPath();
      ctx.rect(pins[0] - 2, 0, (pins[1] - pins[0] + 4) * t, h);
      ctx.clip();
      ctx.strokeStyle = muted
        ? "#8278ae42"
        : selected
          ? "#f1eaff"
          : "#aba0f5ae";
      ctx.lineWidth = selected ? 2.9 : compact ? 1.5 : 2;
      ctx.beginPath();
      ctx.moveTo(pins[0], y0);
      ctx.bezierCurveTo(mid, y0, mid, y1, pins[1], y1);
      ctx.stroke();
      if (!this.reduced && !muted) {
        const u = (this.explorerTime * 0.36 + a * 0.081) % 1;
        const v = 1 - u;
        this.dot(
          ctx,
          {
            x: v ** 3 * pins[0] + 3 * v * u * mid + u ** 3 * pins[1],
            y: (v ** 3 + 3 * v ** 2 * u) * y0 + (3 * v * u ** 2 + u ** 3) * y1,
          },
          compact ? 1.8 : 2.2,
          "#f0ebff",
        );
      }
      ctx.restore();
    }
    lists.forEach((ids, side) => {
      ids.forEach((id, rank) => {
        const y = rowY(rank);
        const x = pins[side];
        const isShared = shared.has(id);
        const color = isShared
          ? colors.purple
          : side
            ? colors.teal
            : colors.sand;
        const minX = side ? x : left,
          maxX = side ? right : x;
        const point = {
          x,
          y,
          id,
          left: minX - 7,
          right: maxX + 7,
          h: rowHeight,
        };
        this.points.push(point);
        const selected = this.hover?.id === id;
        ctx.fillStyle = selected
          ? "#9789ef40"
          : isShared
            ? "#a29cff10"
            : "#acb1c00a";
        ctx.fillRect(
          minX - 5,
          y - rowHeight * 0.42,
          maxX - minX + 10,
          rowHeight * 0.84,
        );
        const position = side ? right : left;
        this.label(
          ctx,
          String(rank + 1).padStart(2, "0"),
          position,
          y,
          font - 1,
          "#b8b2c9",
          side ? "right" : "left",
        );
        const align = side ? "right" : "left";
        this.label(
          ctx,
          `#${this.data.episodes[id]}`,
          position + (side ? -1 : 1) * (compact ? 18 : 30),
          y,
          font,
          selected ? "#fff" : colors.ink,
          align,
          selected ? 750 : 550,
        );
        this.dot(ctx, point, Math.min(4.6, rowHeight * 0.2), color, !isShared);
      });
    });
  }
  drawDistributions(ctx, w, h, elapsed) {
    const compact = w < 470;
    const pad = compact ? 6 : Math.max(16, w * 0.025);
    const x = pad + (compact ? 65 : 91);
    const width = w - x - pad - (compact ? 22 : 27);
    const slot = width / 11;
    const top = 30;
    const bottom = h - 41;
    const rowHeight = (bottom - top) / this.histograms.length;
    const n = this.data.episodes.length;
    const fraction = Math.min(1, Math.max(0, elapsed / 1.65));
    const included = Math.round(n * (1 - (1 - fraction) ** 2));
    const active = this.hover ?? this.bin;
    const heading = active
      ? `Pair ${active.pair + 1}  ·  ${active.index} shared  ·  ${this.histograms[active.pair][active.index].length} observations`
      : `${included === n ? n : `${included} / ${n}`} observations per pair`;
    this.label(
      ctx,
      heading,
      pad + 2,
      13,
      compact ? 11 : 14,
      colors.ink,
      "left",
      650,
    );
    this.histograms.forEach((bins, pair) => {
      const selected = pair === this.pair;
      const y = top + pair * rowHeight;
      const baseline = y + rowHeight - 4;
      const plotHeight = rowHeight - 14;
      this.chartRows.push({ pair, x, width, top: y, bottom: y + rowHeight });
      ctx.fillStyle = selected ? "#a29cff0f" : "#a29cff05";
      ctx.fillRect(pad, y + 1, w - 2 * pad, rowHeight - 2);
      ctx.fillStyle = selected ? colors.purple : "#575367";
      ctx.fillRect(pad, y + 4, selected ? 3 : 1, rowHeight - 8);
      this.label(
        ctx,
        this.data.pairs[pair].name,
        pad + 8,
        y + rowHeight * 0.37,
        compact ? 11 : 14,
        colors.ink,
        "left",
        650,
      );
      this.label(
        ctx,
        `${(this.data.pairs[pair].mean * 100).toFixed(1)}% mean`,
        pad + 8,
        y + rowHeight * 0.65,
        compact ? 10 : 12,
        selected ? colors.deep : colors.teal,
      );
      // Identical count scales allow direct comparisons between all three pairs.
      [50, 100, 150].forEach((value) => {
        const gridY = baseline - (value * plotHeight) / this.chartMax;
        ctx.fillStyle = "#454152";
        ctx.fillRect(x, gridY, width, 0.6);
        if (plotHeight > 70 || value === 100)
          this.label(
            ctx,
            String(value),
            x + width + 3,
            gridY,
            compact ? 9 : 10,
            "#b3adc1",
          );
      });
      ctx.fillStyle = "#77738a";
      ctx.fillRect(x, baseline, width, 1);
      bins.forEach((ids, index) => {
        let count = ids.length;
        // The entry animation accumulates actual observations in dataset order.
        if (included < n) count = ids.filter((id) => id < included).length;
        const height = (count * plotHeight) / this.chartMax;
        const highlight = active?.pair === pair && active.index === index;
        const barWidth = Math.min(48, slot * 0.69);
        const barX = x + (index + 0.5) * slot - barWidth / 2;
        ctx.fillStyle = highlight
          ? "#f3edff"
          : selected
            ? colors.purple
            : colors.teal;
        ctx.fillRect(barX, baseline - height, barWidth, height);
        if (
          !compact &&
          plotHeight > 43 &&
          (highlight ||
            (included === n &&
              count === Math.max(...bins.map((b) => b.length))))
        ) {
          this.label(
            ctx,
            String(count),
            barX + barWidth / 2,
            baseline - height - 7,
            11,
            colors.ink,
            "center",
          );
        }
      });
    });
    for (let i = 0; i <= 10; i++)
      this.label(
        ctx,
        String(i),
        x + (i + 0.5) * slot,
        bottom + 10,
        compact ? 10 : 12,
        colors.ink,
        "center",
      );
    this.label(
      ctx,
      "Shared neighbors out of 10",
      x + width / 2,
      bottom + 29,
      compact ? 11 : 13,
      "#ccc7df",
      "center",
    );
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
    const animating = () =>
      !this.reduced &&
      ((this.heroVisible && !this.heroPaused) ||
        (this.explorerVisible &&
          !this.explorerPaused &&
          (this.explorationStep !== 2 ||
            this.explorerTime - this.enteredAt < 1.7)));
    if (!animating()) return;
    this.lastHeroFrame = null;
    const tick = (time) => {
      this.frame = null;
      if (!active() || !animating()) return;
      if (this.lastHeroFrame === null) this.lastHeroFrame = time;
      const elapsed = time - this.lastHeroFrame;
      // Thirty drawn frames per second is sufficient for the slow camera drift.
      if (elapsed >= 1000 / 30) {
        const seconds = Math.min(elapsed, 100) / 1000;
        if (this.heroVisible && !this.heroPaused) this.phase += seconds * 0.11;
        if (this.explorerVisible && !this.explorerPaused) {
          this.explorerTime += seconds;
          if (this.explorationStep === 0 && !this.drag && !this.hover)
            this.yaw += seconds * 0.14;
        }
        this.lastHeroFrame = time;
        draw();
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}
