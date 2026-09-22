# Shared plans, field experiments, and mission artifacts

Students make a plan they care about, calculate what must be true for it to work, ask a teammate to review it, and test it in a game. A result that challenges the plan is useful work. Preserve the original prediction alongside the next revision.

## Implementation boundary

Available now: saved paper/mission-briefing workbook appearances, existing cooperative scenario authoring and role solving, peer review, and printable/offline mission cards. Cards use the saved scenario and current published findings, omit author answers and independent checks, and carry source attribution, scenario/work revisions, and a snapshot timestamp. Optional question/prediction/falsifier prompts live in the exported card file. A team can record its results in existing notebooks or role discussions.

The **original-map pilot is implemented**. Every workbook can create a Harbor Relay practice board or start without markers/routes on the same original floorplan. Players and objectives can be dragged or moved with keyboard/coordinate controls. Routes have editable waypoints, call-sign assignments, travel/setup estimates, delays, and prerequisites in earlier objective stages. Saves use object revisions; independent changes merge through server retries while conflicting changes retain the local draft. Shared saves poll about every three seconds; drag previews remain local.

The saved schedule checks pairwise readiness spread within each stage and a final deadline. A timing worksheet asks for the complete local delay interval, with Build/Guide/Notebook help and optional Lean candidate export. It holds other arrivals fixed and explicitly asks students to recheck later stages after a change. Times are supplied decimals with millisecond precision, calculated as integers. Geometry does not determine travel time or verify a traversable route. Moving a marker or changing route geometry flags affected timing estimates for review and advances their object revisions. Students acknowledge a rechecked estimate explicitly.

Reviews retain their exact plan snapshot, and earlier reviews remain inspectable after revisions. The current board and archived reviews are included in workbook exports. Remix/test-play copy the current board with reset revisions and no inherited approvals. A separate plan revision avoids invalidating unrelated algebra role work. The board has its own supplied data; it does not automatically substitute existing scenario role outputs into route estimates.

Offline field briefings now include the SVG map, route start cues and readiness times, creator/source attribution, and the Milsymbol license. Existing scenario mission-card packs include these planning-team pages as well. The map is an original design; the friendly-unit SVG comes from a pinned open-source generator.

Alternative map attachments, multiple floors, live cursor/drag broadcasts, graphical waypoint dragging, reviews anchored to individual objects, structured trial records, simulation, and automatic connection from card observations back into a trial are **planned**. Call-sign assignment is an organizational label: any room member can edit a board object, with conflicts checked at save time.

## The shared planning board

- Keep background, student annotations, and timing model as separate layers. Start with an independently designed, original practice floor plan. Track floors, named entrances, obstacles, and explicit floor transitions.
- Place player markers, objectives, meeting points, and route waypoints. Connect them with directed paths; label each route with its owner and its measured or supplied duration. Support touch, keyboard movement, and a form/table alternative to dragging. Color supplements names and line patterns.
- Group 1A, 1B, and 1C into a stage. Two players may rendezvous at 1A while others take positions at 1B and 1C. Define whether timing means arrival at a location or readiness after setup. Define a shared zero and explicit units.
- Assign measurement, equation solving, synchronization, and review as meaningful roles. One student's output is another's input. Give the team a larger constraint that requires combining their results.
- Let objectives depend on earlier objectives. A timeline can replay the mathematical schedule, with a visible distinction between predicted movement and actual gameplay. Never imply that a line animation simulates game mechanics.
- Attach review comments to routes, equations, assumptions, and measurements. A route or timing change marks affected calculations and schedule approvals as needing review. Keep old plans and trials rather than rewriting their history.

The pilot uses stable IDs and server-checked revisions for individual map objects, existing room authorization, and durable saves for completed moves. Future live previews should extend that contract. The desired broader board experience above includes capabilities beyond the pilot; refer to the implementation boundary for what is available.

## The algebra underneath

Use measured route times first. Blueprint pixels are not meters, and a direct line between markers is not necessarily a traversable path. Travel can include turns, stairs, doors, setup, or other conditions students must name and measure.

For a route with supplied duration `t` and setup duration `u`, readiness is `a = s + t + u`. Students isolate the start time: `s = a - t - u`. If a meaningful distance and constant speed are supplied, `a = s + d/v + u` offers another linear problem in `s`; do not claim that arbitrary variable denominators are supported by the current checker.

Example using invented practice times, all measured from a common zero:

| Player | Route      | Start | Ready at |
| ------ | ---------- | ----- | -------- |
| A      | 6 seconds  | `s`   | `s + 6`  |
| B      | 11 seconds | 0     | 11       |
| C      | 9 seconds  | 2     | 11       |

The crew must be ready within **two seconds of one another**:

`|(s + 6) - 11| <= 2`, so `3 <= s <= 7`.

They must also all be ready by second 12. A adds `s + 6 <= 12`, giving the final window **`3 <= s <= 6`**. B and C already meet the deadline. Each student can own a route measurement, then the team intersects its timing constraints.

Do not confuse pairwise spread with distance from a target time. Everyone within two seconds of a target can still be four seconds apart. For more players, the full spread is `max(arrivals) - min(arrivals)`; checking the appropriate pairwise bounds is one way to express the requirement. General scheduling and arbitrary multi-variable optimization are outside the current bounded checker. Translate only supported statements, and leave unsupported questions explicitly open.

Chained objectives introduce a natural optional extension: the next stage cannot start until its prerequisites finish. Students can discover why speeding up a shorter branch sometimes changes nothing, and why the longest prerequisite chain controls the earliest finish. Introduce the term **critical path** after they encounter that behavior. Do not label the whole schedule Lean verified merely because one arrival equation has a receipt.

## Workbook ownership and presentation

Keep the current paper style and original briefing style as choices. The September 21 feedback establishes a more theatrical next direction: a full operations-room experience with a luminous map, animated mission objects, squad readouts, and readiness lights that respond to the student's calculations. Add student-authored operation titles, call signs, and original squad emblems. Other worlds should have their own visual language and interactions, including an arena, stadium, creature expedition, lemonade stand, or bracelet workshop. See [the theme and younger-student quest direction](themes-and-quests.md) for the feedback, proposed experiences, and implementation boundary.

Style travels with the workbook through save, edit, remix, export, and test-play. Maintain a readable print style, adequate contrast, visible focus, and a plain presentation option. All Build/Guide/Notebook help modes remain available regardless of theme. A presentation change should eventually have its own revision so it does not invalidate mathematical reviews unnecessarily; the current document revision mechanism remains conservative.

## A match as an experiment

1. Write a specific question and freeze a prediction before the trial. Name the measurement, units, tolerance, and evidence that would challenge it.
2. Save the plan revision, background/map/floor revision, game version if known, route conditions, and roles. Distinguish a supplied practice number, a student measurement, and a fact drawn from a cited source.
3. Run repeated trials where practical. Record actual arrival/readiness times and relevant conditions, including interruptions and failed attempts. Mark exclusions with a reason; retain the original record.
4. Compare `observed - predicted` and absolute error with the chosen tolerance. A small table of repeated trials can lead to ranges, medians, and an optional introduction to measurement uncertainty.
5. Ask a reviewer whether the evidence supports, challenges, or leaves the hypothesis unresolved. A win is not evidence that every timing prediction was right. One mismatch may expose a poor model, a changed condition, or measurement uncertainty; students should explain which interpretation they defend.
6. Remix or revise the plan, linking it to the previous version and its evidence. Keep the prediction made before each trial distinct from later explanations.

Structured trials need durable records and append-only prediction snapshots. They should not be a single mutable “success” counter. Reuse workbook permissions and exportable attribution. The later Glyph bridge could query these explicit observations and their provenance; it must not convert missing evidence into a universal claim or imply that a provenance record guarantees truth.

## Artifacts for actual use

The next card version should extract a deliberately short, student-editable action brief from the plan:

| Field                | Example for the invented timing model                      |
| -------------------- | ---------------------------------------------------------- |
| Objective / owner    | 1A / Player A                                              |
| Route                | Named spawn → two annotated waypoints → meeting point      |
| Start cue            | Shared zero plus 3–6 seconds                               |
| Expected readiness   | Seconds 9–12; B and C ready at 11                          |
| Condition            | At most 2 seconds between any pair; all ready by 12        |
| If the route changes | Announce the change; this timing prediction needs revision |
| Record               | Actual start, readiness, interruption, and arrival spread  |

Offer a whole-team sheet, individual role cards, a sequenced objective strip, and a trial/debrief card. Include a small annotated map only when the background's permissions allow that export. A phone-friendly offline artifact and ink-friendly print/PDF output should show the same plan. Keep essential conditions readable rather than truncating them to fit a decorative card.

Keep source attribution, plan revision, capture time, and review state on the artifact. Stale cards stay historical; regenerate after the team changes its plan. An optional return link must respect existing workbook access, and must never embed a room invitation by default. Card generation cannot confer formal verification: a claim needs its own exact matching checked receipt.

## Blueprints and permissions

Source review on September 20, 2026: Ubisoft's [official House page](https://www.ubisoft.com/en-us/game/rainbow-six/siege/game-info/maps/house) offers downloadable blueprints. That fact alone does not establish a license to embed or redistribute them in this application.

Ubisoft's [Terms of Use](https://www.ubisoft.com/legal/documents/termsofuse/en-US), updated January 26, 2026, include maps and diagrams in “Content” and describe a personal, limited, non-sublicensable license. Sections 9 and 10 address intellectual property and user-generated content. The reviewed pages did not establish clear authorization for distributing these images with an MIT app. The downloadable archive's contents and any asset-specific terms have not been reviewed. Resolve applicable permission before bundling real map backgrounds; legal review of a specific proposed use may be appropriate.

In the United States, educational purpose is one consideration in a case-specific fair-use analysis, not an automatic exemption. See the [U.S. Copyright Office's explanation](https://www.copyright.gov/fair-use/). This source review is a product design constraint, not a legal opinion covering every use or jurisdiction.

Ship original practice artwork under the project license. Link to Ubisoft's official pages while redistribution permission remains unresolved. If licensed third-party maps are later supported, record the creator, original URL, asset version/hash, applicable permission, attribution, and conditions separately from student annotations and the code license. Workbook exports and scenario PRs must honor those conditions. A user upload, a redraw, or an educational label does not by itself settle the rights question.

## V2: strategy ladders and optimization

Optional stretch invitations should grow out of a question the team already cares about: “Can everyone be ready sooner?”, “Can this plan survive a one-second delay?”, or “Can we remove one setup step?” More advanced mathematics is an invitation, not a gate to finishing the grade-level mission. Some improvements need only more careful use of familiar algebra.

The scenario designer can construct several plausible routes and strategies from a common measured model, with one or more useful benchmark solutions. Generate timing data backwards from intended rendezvous windows when useful. The current app can author answers backwards; generation and evaluation of route/schedule benchmarks are future features.

| Invitation                          | Student technique                                                           | Designer's benchmark                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Make this plan work                 | Isolate starts in linear equations; intersect absolute-value timing windows | A feasible schedule with complete conditions                                |
| Which route is quicker?             | Compare `time = travel + setup`; solve a break-even equation or inequality  | Routes whose ordering changes with a supplied delay                         |
| Save the team a second              | Tabulate alternative starts and route choices; follow prerequisites         | A faster feasible schedule and an explanation of its bottleneck             |
| Find the earliest possible finish   | Discover a critical path or enumerate a small set of routes                 | An attained lower bound or exhaustive comparison within the declared model  |
| Keep the plan working after a delay | Use intervals and inequalities to budget slack                              | A schedule robust to the specified bounded delays                           |
| Balance speed and another goal      | Compare tradeoffs on a scatter plot; optionally introduce a Pareto frontier | Several nondominated plans, without pretending one is best in every respect |

Keep models small enough that students can inspect the candidate table themselves. A later graph-search or linear-programming engine may help designers create or check puzzles, but a solver's output alone is not a Lean proof. Any certificate bridge needs explicit semantics, independent checking, bounded resource use, and an honest account of which assumptions it covers. Route choice plus timing may require a different engine from the current algebra checker.

Useful designer-only records include each strategy's route IDs, objective sequence, role assignments, start times, objective value, constraint checks, stated assumptions, and the reasoning/hint ladder. Separate **feasible**, **best among these tested candidates**, and **optimal within this model**. Reserve the last label for a matching lower bound, complete finite enumeration, or another justified certificate. Do not assert universal optimal play against changing opponents. Measurements should carry map/game versions and their source; invented model data stay labeled as practice data.

Keep hidden benchmark records separate from solver responses and exported mission cards. The current authoring format hides intended solutions in the solver interface; that alone is not a sufficient secrecy boundary for a future challenge catalog. V2 needs server-side projection of designer-only data. Reveal benchmarks on an explicit debrief or hint action rather than treating them as the only acceptable answers. Students should be able to beat a designer's candidate, expose a missing constraint, or defend a different tradeoff.

Scenario generation should validate constraints and candidate plans, test deliberate contradictions, and include human/game-player review of plausibility. A map does not provide movement speed, setup overhead, visibility, or opponent behavior by itself. Record calibration trials before calling a scenario game-realistic, and make later contradictory observations an opportunity to revise the model. A formally optimal schedule remains conditional on those modeling choices.

## Suggested delivery order

1. **Completed foundation:** original briefing appearance and printable/offline mission cards using existing saved work, with a paper path for predictions and observations.
2. **Implemented original-map pilot:** shared markers, waypoint routes, supplied duration estimates, supported timing equations, stage dependencies, exact plan review snapshots, and individual-object concurrency. Live drag broadcasts and review anchors on individual objects remain extensions.
3. **Recorded trials:** prediction snapshots, structured observations, reviewer response, revision comparisons, and cards generated from the actual action plan.
4. **Optional game backgrounds and extensions:** assets with established permissions, floor transitions, conditional plans, richer scheduling experiments, and a bounded Glyph fact/provenance bridge.
5. **V2 strategy ladders:** designer benchmark libraries, opt-in optimization prompts, checked feasible plans, model-specific optimality evidence where available, and student strategies that can challenge the benchmarks.
