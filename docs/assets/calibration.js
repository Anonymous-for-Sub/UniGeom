const $ = (s) => document.querySelector(s);
const purple = "#a29cff",
  teal = "#68c5b4",
  sand = "#d4b590",
  muted = "#b6b4c8";
const budgets = [4, 16, 64, 747];
const txt = (x, y, t, extra = "") =>
  `<text x="${x}" y="${y}" ${extra}>${t}</text>`;
const line = (x1, y1, x2, y2, color, extra = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
const dot = (x, y, color, r = 5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const svg = (title, body) =>
  `<svg viewBox="0 0 410 285" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
export function initCalibration() {
  let data,
    budget = 64,
    pair = 0,
    method = "residual_mlp";
  const host = document.createElement("div");
  host.id = "calibration-evidence";
  host.hidden = true;
  host.innerHTML = `<div class="calibration-toolbar"><span>Calibration trajectories</span><div class="budget-options" aria-label="Calibration trajectories">${budgets.map((b) => `<button data-budget="${b}" aria-pressed="${b === budget}">${b}</button>`).join("")}</div><button class="text-link" id="budget-original">Paper figure</button></div>
  <div class="calibration-grid"><section><h3>Does the source representation matter?</h3><p>Both source encoders use a residual interface and the same data budget.</p><div class="chart-legend"><span style="--series:${purple}">Learned source</span><span style="--series:${sand}">Random source</span></div><div id="source-budget-chart"></div><div class="budget-readout" id="source-budget-readout" aria-live="polite"></div><p class="calibration-scope">Four-step MSE · lower is better. Intervals: conditional 95% bootstrap over 606 evaluation parents; means over three repeats.</p></section>
  <section><h3>Does the correspondence matter?</h3><p>Keep the source learned; compare correct and shuffled training pairs.</p><div class="calibration-selectors"><label>Model pair <select id="budget-pair"><option value="0">Pair 1</option><option value="1">Pair 2</option></select></label><label>Interface <select id="budget-method"><option value="residual_mlp">Residual</option><option value="paired_ridge_refit">Ridge</option></select></label></div><div id="pair-budget-chart"></div><div class="budget-readout" id="pair-budget-readout" aria-live="polite"></div><p class="calibration-scope">Four-step MSE normalized by native-state persistence. Whiskers span three repeats, not confidence intervals.</p></section></div>`;
  $("#results-evidence").after(host);
  const gains = document.createElement("div");
  gains.id = "prediction-gains";
  gains.hidden = true;
  host.after(gains);
  const pause = () => window.deck?.pause();
  host.querySelectorAll("[data-budget]").forEach(
    (b) =>
      (b.onclick = () => {
        pause();
        budget = +b.dataset.budget;
        render();
      }),
  );
  $("#budget-pair").onchange = (e) => {
    pause();
    pair = +e.target.value;
    render();
  };
  $("#budget-method").onchange = (e) => {
    pause();
    method = e.target.value;
    render();
  };
  $("#budget-original").onclick = () =>
    window.paperViews.openFigure("learned-source");
  function render() {
    if (!data) return;
    host
      .querySelectorAll("[data-budget]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", +b.dataset.budget === budget),
      );
    const x = (v) => 68 + (v / 1.8) * 310,
      y = (i) => 43 + i * 53;
    let a = "";
    budgets.forEach((b, i) => {
      const l = data.source.find(
          (r) => r.budget === b && r.source === "learned_cpu",
        ),
        r = data.source.find(
          (r) => r.budget === b && r.source === "random_cpu",
        );
      a += `<g opacity="${b === budget ? 1 : 0.67}"><rect x="5" y="${y(i) - 23}" width="400" height="48" rx="7" fill="${b === budget ? "#232130" : "none"}"/>`;
      a +=
        txt(53, y(i) + 5, b, 'text-anchor="end"') +
        line(
          x(l.h4_mse),
          y(i),
          x(r.h4_mse),
          y(i),
          "#777082",
          'stroke-width="2"',
        );
      [l, r].forEach((p, j) => {
        const c = j ? sand : purple;
        a +=
          line(
            x(p.low),
            y(i) + 12,
            x(p.high),
            y(i) + 12,
            c,
            'stroke-width="2"',
          ) + dot(x(p.h4_mse), y(i), c, 5);
      });
      a +=
        txt(
          (x(l.h4_mse) + x(r.h4_mse)) / 2,
          y(i) - 9,
          `${l.random_over_learned.toFixed(1)}×`,
          'text-anchor="middle" fill="#e8e3ff"',
        ) + "</g>";
    });
    [0, 0.5, 1, 1.5].forEach((v) => {
      a +=
        line(x(v), 231, x(v), 237, muted) +
        txt(x(v), 254, v, 'text-anchor="middle"');
    });
    a +=
      line(x(0), 231, x(1.8), 231, muted) +
      txt(223, 278, "Four-step feature MSE", 'text-anchor="middle"');
    $("#source-budget-chart").innerHTML = svg(
      "Learned versus random source at four measured calibration budgets. The labels show random divided by learned error.",
      a,
    );
    const source = data.source.filter((r) => r.budget === budget),
      l = source.find((r) => r.source === "learned_cpu"),
      r = source.find((r) => r.source === "random_cpu");
    $("#source-budget-readout").innerHTML =
      `<strong>${l.random_over_learned.toFixed(2)}×</strong><span>random-to-learned error ratio at ${budget} trajectories<br><b>${l.h4_mse.toFixed(3)}</b> learned · <b>${r.h4_mse.toFixed(3)}</b> random</span>`;
    const xx = (b) => 62 + (Math.log(b / 4) / Math.log(747 / 4)) * 307,
      yy = (v) =>
        223 -
        ((Math.log(v) - Math.log(0.04)) / (Math.log(2) - Math.log(0.04))) * 180;
    let c = "";
    [0.05, 0.1, 0.5, 1, 2].forEach((v) => {
      c +=
        line(
          62,
          yy(v),
          379,
          yy(v),
          v === 1 ? "#8a869f" : "#2d2b39",
          v === 1 ? 'stroke-dasharray="3 4"' : "",
        ) + txt(51, yy(v) + 5, v, 'text-anchor="end"');
    });
    c += line(
      xx(budget),
      40,
      xx(budget),
      226,
      "#777082",
      'stroke-dasharray="2 5"',
    );
    ["paired", "shuffled_training"].forEach((k, j) => {
      const rows = data.pairs[pair]
          .filter((r) => r.method === method && r.pairing === k)
          .sort((a, b) => a.budget - b.budget),
        color = j ? sand : purple;
      c += `<polyline points="${rows.map((r) => `${xx(r.budget)},${yy(r.mean)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" ${j ? 'stroke-dasharray="5 4"' : ""}/>`;
      rows.forEach((r) => {
        c +=
          line(
            xx(r.budget),
            yy(Math.min(...r.repeats)),
            xx(r.budget),
            yy(Math.max(...r.repeats)),
            color,
            'stroke-width="2"',
          ) + dot(xx(r.budget), yy(r.mean), color, r.budget === budget ? 6 : 4);
      });
    });
    budgets.forEach((b) => (c += txt(xx(b), 251, b, 'text-anchor="middle"')));
    c += txt(
      215,
      278,
      "Calibration trajectories · log scale",
      'text-anchor="middle"',
    );
    c += line(62, 224, 379, 224, muted) + line(62, 40, 62, 224, muted);
    c +=
      dot(73, 16, purple, 4) +
      txt(85, 21, "Correct pairs") +
      line(226, 16, 244, 16, sand, 'stroke-width="2" stroke-dasharray="4 3"') +
      txt(252, 21, "Shuffled pairs");
    $("#pair-budget-chart").innerHTML = svg(
      `Pair ${pair + 1}, ${method === "residual_mlp" ? "residual" : "ridge"} interface: four-step error relative to native-state persistence, logarithmic axes.`,
      c,
    );
    const pr = data.pairs[pair].find(
        (r) =>
          r.method === method && r.pairing === "paired" && r.budget === budget,
      ),
      sr = data.pairs[pair].find(
        (r) =>
          r.method === method &&
          r.pairing === "shuffled_training" &&
          r.budget === budget,
      );
    $("#pair-budget-readout").innerHTML =
      `<strong>${pr.mean.toFixed(3)}</strong><span>correct-pair error relative to persistence<br><b>${sr.mean.toFixed(3)}</b> with shuffled pairs · Pair ${pair + 1}</span>`;
    gains.innerHTML =
      '<p>Residual interfaces reduce one-step error relative to ridge in all four directions.</p><div class="prediction-gain-grid">' +
      [...new Set(data.prediction.map((r) => r.pair))]
        .flatMap((p, i) =>
          ["AB", "BA"].map((dir) => {
            const rows = data.prediction.filter(
                (r) => r.pair === p && r.direction === dir,
              ),
              v = (k) => rows.find((r) => r.method === k).mse;
            return `<div><span>Pair ${i + 1} · ${dir === "AB" ? "A → B" : "B → A"}</span><strong>${(100 * (1 - v("residual") / v("ridge"))).toFixed(1)}% <small>lower</small></strong><i style="--gain:${100 * (1 - v("residual") / v("ridge"))}%"></i></div>`;
          }),
        )
        .join("") +
      "</div>";
  }
  fetch("assets/data/calibration.json")
    .then((r) => {
      if (!r.ok) throw Error("Calibration data unavailable");
      return r.json();
    })
    .then((d) => {
      data = d;
      render();
      host.dataset.ready = "true";
    })
    .catch(() => {
      host.textContent =
        "Calibration data could not be loaded. Reload the page to try again.";
    });
  return {
    setView(id) {
      host.hidden = id !== "learned-source";
      gains.hidden = id !== "prediction-controls";
    },
    get data() {
      return data;
    },
  };
}
