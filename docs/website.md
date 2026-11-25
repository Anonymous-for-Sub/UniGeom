# UniGeom project page

The project page is a static site served from `docs/` on the `main` branch through GitHub Pages. Open `index.html` through a local HTTP server when developing, for example `python3 -m http.server 8000 --directory docs` from the repository root.

The dark presentation has eight pages: overview, shared geometry, framework, interface, results, recorded experiments, paper figures and paper. It includes shared-neighborhood exploration, a perception-to-dynamics connection diagram, a computed spatial-resampling illustration, full-cohort result comparisons and five recorded matched-task videos.

The header contains chapter navigation, without a brand mark. Previous/next buttons, keyboard navigation and horizontal touch gestures switch pages. Auto play runs a silent 4 minute 33 second tour; its shared timeline advances method steps, interface stages, evaluation cohorts and all five original videos. The footer supports pause, replay and seeking. Interacting with a figure pauses the tour. Video loading pauses its clock, recordings play at their original speed, and switching tabs stops playback. Mobile diagrams have separate vertical layouts.

## Evidence and interaction

- `assets/data/geometry.json` contains all 606 observations for each of three independent LeWM pairs. Nearest-neighbor sets come from the original 192-dimensional features. Separate t-SNE projections and a rigid display registration for B provide the 3D layout. Display rotations and per-cloud display scaling do not alter neighbor sets or metrics.
- `assets/images/observations.webp` is a 32-column sprite containing the same observations in order. The final row contains unused blank slots.
- `assets/data/results.json` contains complete-cohort means for the displayed studies. Native-success retention counts paired successes. The chart includes each available method for its selected study. The paper supplies uncertainty estimates and full protocol details.
- `assets/videos/` contains the recorded examples and posters. Video clips retain their original frames and time windows. The video text identifies selected cases and the development Reacher cohort.
- The resampling animation uses deterministic illustrative scalar features and normalized spatial attention weights. It shows the operator structure and shapes, with queries formed from the resampled target grid. These teaching values are separate from trained model activations.
- `assets/UniGeom.pdf` is the anonymous main manuscript.

The anonymous website omits author identities and affiliations. Its paper and social preview are independently prepared anonymous assets.

## Credits

The explanatory interaction was inspired by [Shared Geometry as a Rosetta Stone](https://dominik-schnaus.github.io/unpaired-rosetta/). This site has its own implementation, visual identity and UniGeom data. Manrope is distributed under the SIL Open Font License in `assets/fonts/OFL.txt`.

Keyboard controls include arrow navigation within tab lists, observation browsing on the geometry canvas and target-token selection in the spatial illustration. The page respects reduced-motion preferences. Switching pages pauses the local connection sequence. Videos pause when leaving the viewport or hiding the page.

## Original manuscript figures

`assets/paper-figures/manifest.json` identifies eight original figures or panels from the current manuscript, with the original experimental scopes. Framework and schematic assets are exported directly from the paper PDFs as SVG with outlined glyphs. They are not redrawn interpretations. Raster observations embedded in those PDFs retain their original pixels. The framework page offers the exact original figure and a separate animated explanation. All eight figures can be enlarged, zoomed and saved.

Shared geometry now has three stages: independent coordinate spaces, common nearest neighbors and the distribution across model pairs. Its autoplay segment lasts 42 seconds. Enlarged point clouds and swept correspondence curves use the unchanged observation IDs; their appearance and camera motion do not change the measured neighborhoods. The figure gallery adds navigation, Reacher, driving, Granular and RoboTwin evidence. RoboTwin image readouts remain explicitly identified as post-hoc retrievals, not executed rollouts.
