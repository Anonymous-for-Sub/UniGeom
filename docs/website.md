# UniGeom project page

A static six-chapter presentation, served from `docs/`: Overview, Shared geometry, Framework, Interface, Results and Experiments. Develop with `python3 -m http.server 8000 --directory docs` from the repository root. The downloadable review package includes a separately bundled offline entry.

## A continuous explanation

Shared geometry changes its actual visual representation across three stages. Two independently trained encoders first display their separate projected spaces. The next stage shows ranked nearest-neighbor lists, connecting the same observations across encoders. Finally, three animated histograms count all observations in each independent model pair. These use measured data, not synthetic point arrangements presented as measurements.

The framework is one native SVG, drawn with web text, paths, grids and flow animation. Its topology follows the manuscript: source history and goal, the shared learned interface, frozen dynamics, goal cost, residual spatial resampling and the paired-state calibration inset. Four stages highlight calibration, the bilinear base, residual correction and frozen rollout. Shape labels use 256 source tokens × 192 channels, consistent with the method equation. The separate interface chapter computes a teaching example of the spatial operation.

Manuscript evidence appears where it supports the explanation. Prediction controls and calibration budgets sit within Results. Matched task comparisons, Granular/RoboTwin readouts and driving scenarios sit within Experiments beside the recorded executions. There is no separate figure catalog or manuscript chapter.

## Evidence

- `assets/data/geometry.json`: 606 observations per independent LeWM pair; three pairs. Retrieval uses original 192D features. Separate t-SNE projections and a rigid display registration provide the rotating 3D layouts. Display motion does not alter measured neighbors. Ranked-list links match actual observation IDs. Histograms count all 606 measured overlaps per pair.
- `assets/images/observations.webp`: sprite of those observations; 32 columns with unused slots in the last row.
- `assets/data/results.json`: complete-cohort means and paired native-success retention. Available method comparisons remain intact.
- `assets/videos/`: five original recorded comparisons and posters, preserving all frames, native speed and original time windows. Selected cases are distinguished from cohort statistics.
- `assets/paper-figures/`: original exports plus dark display variants. Photographic and error-map image pixels are unchanged. The prediction-control matrix is redrawn using the exact four-direction values in the detailed manuscript table; color normalizes error within each receiver. `manifest.json` records experimental scopes.
- RoboTwin RGB readouts are post-hoc retrievals from a common observed-frame bank containing true futures; they are not generated images or executed trajectories. Driving panels preserve their selected simulated replay scope.
- The interface animation uses deterministic illustrative scalar features and spatial attention weights, distinct from trained activations. The framework grid sweeps illustrate data flow rather than measured attention.
- `assets/UniGeom.pdf` is the anonymous main manuscript.

## Controls

The shared tour lasts 4 minutes 7 seconds. Chapter buttons, previous/next, keyboard navigation and horizontal touch gestures navigate the presentation. Auto play, pause, replay and seek share one timeline; recordings pause its clock while buffering. Manual inspection pauses automatic progression. Enlarging a result keeps its caption and scope visible. A reduced-motion preference suppresses decorative motion while preserving meaningful state changes. On small screens, dense architecture detail scrolls within its own canvas.

The anonymous website omits author identities and affiliations. Its paper and social preview are independently prepared anonymous assets.

## Credits

Interaction inspired by [Shared Geometry as a Rosetta Stone](https://dominik-schnaus.github.io/unpaired-rosetta/). This site uses its own implementation and UniGeom evidence. Manrope is distributed under the SIL Open Font License in `assets/fonts/OFL.txt`.
