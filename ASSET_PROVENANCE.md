# Asset provenance

## Mission briefing appearance

The workbook and printable-card briefing styles use original CSS, system monospace typography, olive colors, and document borders. They contain no Ubisoft blueprints, game logos, extracted icons, or game interface artwork. The game titles identify the inspiration for practice scenarios, not an affiliation or endorsement.

Actual game-map backgrounds are a planned optional capability. Before bundling an asset, record its source, creator, revision, applicable license/permission, attribution, and redistribution conditions separately from the application code. A public download link is not an MIT license. See [the map design and source review](docs/mission-planning.md#blueprints-and-permissions).

## Original practice floorplan and tactical symbol

`lib/planning-art.ts` defines **Relay Station v1**, an original schematic floorplan created for this project, released under the repository's MIT license. Its rooms and routes are fictional and its coordinates are diagram units, not game distances. No Ubisoft layout or imagery was traced or copied. The SVG is shared by the interactive board and offline field briefings.

The friendly-unit artwork in `public/maps/friendly-unit.svg` and the embedded export in `lib/tactical-symbol.ts` are generated with **milsymbol 3.0.4**, pinned as a development dependency. Source: [spatialillusions/milsymbol](https://github.com/spatialillusions/milsymbol); author: Måns Beckman. Its [MIT license](public/maps/LICENSE.milsymbol.txt) is retained in the repository, served with the app, and included in exported field briefings and mission-card packs. The generator uses SIDC `130310001412110000000000000000`; game player labels are our overlay, not a claim that individual game players are military platoons.

Regenerate the checked-in artwork with `npm run assets:generate`. The application embeds the generated SVG; it does not need the generator at runtime. No closed-source extensions from the author's separate unit-generator website are used.

## Social-preview asset

`public/og.png` was generated with the built-in image-generation tool for this project, then copied into the repository. It is not a screenshot of the interface. No generated game logos or character art are used.

Prompt: Create one complete landscape social-preview card for a student-owned collaborative algebra discovery web app whose name is intentionally undecided. Exact text: “Your questions.” “Your team.” “Your math.” and small “A student discovery lab”. Bold editorial typography, deep ink navy #152d35 and warm paper #f6f3eb, persimmon orange #f16b42, and sage accents. Motif: graph paper and three folded paper tabs joining one shared notebook. Landscape approximately 1200:630, generous margins, legible in link unfurls, text left and notebook motif right. Do not invent a product name or logo. No game imagery, game logos, or people. No extra equations or words.
