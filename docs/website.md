# UniGeom project page

A static six-chapter presentation, served from `docs/`: Overview, Shared geometry, Framework, Interface, Experiments and Results. Develop with `python3 -m http.server 8000 --directory docs` from the repository root. The downloadable review package includes a separately bundled offline entry.

## A continuous explanation

Shared geometry keeps the same two measured point clouds visible throughout all three stages. The first stage introduces their independent coordinates. The second highlights the selected observation and its actual ten-neighbor sets, with cross-space links for shared observation IDs. The third progressively adds a small set of shared anchor neighborhoods in those same clouds. Camera gestures, point selection and observation thumbnails remain available; changing the model pair interpolates the displayed positions while keeping observation identities. Full-cohort means are shown beside the spaces. No ranked-list or histogram replacement interrupts the spatial explanation.

The framework is one native SVG, drawn with web text, paths, grids and flow animation. Its topology follows the manuscript: source history and goal, the shared learned interface, frozen dynamics, goal cost, residual spatial resampling and the paired-state calibration inset. Four stages highlight calibration, the bilinear base, residual correction and frozen rollout. Shape labels use 256 source tokens × 192 channels, consistent with the method equation. The separate interface chapter computes a teaching example of the spatial operation.

Manuscript evidence appears where it supports the explanation. Prediction controls and calibration budgets sit within Results. Matched task comparisons, Granular/RoboTwin readouts and driving scenarios sit within Experiments beside the recorded executions. Experiments precedes Results so recorded behavior introduces the complete-cohort comparisons. There is no separate figure catalog or manuscript chapter.

## Evidence

- `assets/data/geometry.json`: 606 observations per independent LeWM pair; three pairs. Retrieval uses original 192D features. Separate t-SNE projections and a rigid display registration provide the rotating 3D layouts. Display motion does not alter measured neighbors. Local and cross-space links use actual observation IDs and original-space neighbor sets. Anchor neighborhoods are a sparse illustration; pair means include all 606 observations.
- `assets/images/observations.webp`: sprite of those observations; 32 columns with unused slots in the last row.
- `assets/data/calibration.json`: measured source-control, paired/shuffled budget and four-direction prediction data. Two linked calibration charts share a trajectory-budget selector; the correspondence chart switches between two independent pairs and residual/ridge interfaces. Source-control intervals are conditional parent-bootstrap 95% intervals; the correspondence chart shows three-repeat ranges with native-state persistence normalization. The four prediction reductions compare residual against ridge within each receiver.
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
