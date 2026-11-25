# UniGeom project page

The project page is a static site served from `docs/` on the `main` branch through GitHub Pages. Open `index.html` through a local HTTP server when developing, for example `python3 -m http.server 8000 --directory docs` from the repository root.

The interactive page includes shared-neighborhood exploration, a perception-to-dynamics connection diagram, a computed spatial-resampling illustration, full-cohort result comparisons and five recorded matched-task videos.

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

Keyboard controls include arrow navigation within tab lists, observation browsing on the geometry canvas and target-token selection in the spatial illustration. The page respects reduced-motion preferences. Switching chapters pauses the connection sequence. Videos pause when leaving the viewport or hiding the page.
