# Working title: discovery notebook

The students choose the eventual product name. Algebraica and mathchud are provisional candidates. CHUD (Collaborative Hub for Unhinged Discovery) belongs only in a small optional Easter egg.

## Product commitments

- Students own the questions: create, persist, reopen, edit, remix, and share open notebooks and authored scenarios.
- Open notebooks support questions, notes, calculations, graphs, experiments, and unfinished work without requiring a correct answer.
- Scenario authors can start from a Brawl Stars or Siege template, a blank scenario, or an intended answer. They control story, supplied data, questions, hints, intended solutions, objectives, roles, output connections, and constraints.
- A remix keeps attribution and a link to its immediate source. Test-play creates a separate solver workbook and preserves the author’s draft.
- Cooperative authoring and solving use shared rooms, durable server storage, participant names, role assignments, and conflict-aware writes. Equations, reasons, and revisions remain visible.
- Build, Guide, and Notebook are help levels, not fixed student ability labels. Preserve multiple valid methods and every absolute-value branch.
- Author checks distinguish unique solutions, multiple solutions, no solution, and solution regions. Contradictions may be intentional. Unsupported mathematics must be identified rather than guessed.
- Published role outputs can feed later questions through explicit named references; a changed scenario makes old solver work require review.
- The two complete introductory missions remain Brawl Stars damage thresholds and Siege arrival timing, using clearly labeled practice data.
- Optional Overkill mode makes mathematical trust inspectable: preserve complete solution sets, display precise real-number claims, export reproducible Lean proofs, and verify catalog contributions automatically with pinned Lean/Mathlib. Distinguish the quick checker, a kernel-checked exact claim, and human peer review. Unchecked or unsupported claims never receive a formal badge.
- The hosted release bundles receipts from successful Lean runs. Arbitrary new student work is exported for verification; live native Lean execution is a future isolated-service capability. Formal checks do not certify prose, game data, rounding decisions, or the application itself.
- The README has a deliberately deadpan FAQ using “mathbitch” as another provisional name. The students retain final naming rights.
- Students customize the presentation of their work. Paper and an original mission-briefing appearance are implemented and saved with notebooks/scenarios, including remixes and test-play. Further covers, call signs, colors, and original squad emblems remain planned.
- Saved scenarios/playthroughs produce printable, offline mission cards: team or role objectives, published findings, review state, and space to predict and observe. Cards keep source attribution and the snapshot time/revisions; hidden author solutions, private independent checks, and room invitations are omitted. Optional prediction prompts are stored in the downloaded artifact, not the workbook. Students can keep findings in existing notebooks or role discussions.
- Extend student ownership to collaborative map planning and real-game experiments. Students assign objectives, routes, roles, start cues, rendezvous windows, and later stages; connect timing subproblems; test predictions in matches; retain observations that challenge their model; and peer-review a revision. Use original practice maps first, with actual game backgrounds dependent on applicable permission. See the [detailed design and implementation boundary](docs/mission-planning.md).
- The original-map pilot is implemented: Harbor Relay or an empty board in any workbook, editable markers/routes, named assignments, four stages with earlier-stage prerequisites, individual-object conflict checks, a numeric schedule, bounded algebra questions, exact reviewed plan snapshots, and offline SVG field briefings. A changed sketch requires affected timing estimates to be rechecked. Boards survive save/reopen, remix, test-play, JSON export, and shared-room access; their revisions are separate from scenario role work. Simultaneous drag previews, structured match trials, alternative floorplans, automatic pathfinding, and optimization remain future work.
- V2 can add opt-in strategy ladders: designers keep several benchmark plans, students improve routes and schedules through familiar algebra or small extensions, and evidence reveals tradeoffs. Distinguish a feasible plan, the best tested candidate, and an optimum established within an explicit model. Benchmarks must not exclude valid novel strategies or leak through solver artifacts. See [the V2 optimization design](docs/mission-planning.md#v2-strategy-ladders-and-optimization).

## First release boundaries

The mathematical step checker covers exact rational affine equations, literal affine formulas, and univariate absolute-value equations and inequalities with constant denominators. It is not a general computer algebra system. Freeform prose is saved, not automatically certified. Graphs are numerical explorations. Shared rooms synchronize by polling. Invite-only username/password accounts identify participants across devices without collecting student email addresses. One-use recovery codes restore access and revoke existing sessions. Site access policy controls who can reach the application; room codes then control access to each shared workbook.

## Validation

Exercise the checker with equivalent strategies, malformed and nonlinear expressions, negative coefficients, zero divisors, branch loss, contradictory and overlapping constraints, and exact fractions. Exercise persistence and collaboration through separate HTTP sessions: create, join, save, claim, assign, conflict, publish, review, remix, test-play, and access denial. Build for the Sites runtime and inspect the generated migration before publishing.

## Self-hosting

Self-hosting is available as a Docker Compose deployment for a single server, using a persistent SQLite volume and the existing vinext standalone runtime. Hosts may use their own HTTPS reverse proxy or the optional Cloudflare Tunnel overlay. The Workers/D1 build remains supported. The hosting guide covers updates, backups, restoration, room access, and account setup, invitations, and recovery; automated container checks cover collaboration, replacement persistence, proxy behavior, and backup restoration.

## Future direction: Glyph as a medium for discovery

The user wants Glyph to serve both a functional role in the application and a didactic role for students. The intention is to let students encounter programming through useful mathematical work before introducing programming vocabulary. The owner identified their local Glyph repository; an initial read-only review of checkout `1618e6c` covered its README, tag algebra, embedding proposal, runtime tiers, lexer, and Atlas/Mosaic Wasm hosts. No Glyph source was copied or changed.

Glyph is currently a logic-flavored query and inference engine with emoji terms, source/author provenance, and existing Rust-to-Wasm host examples. The strongest first integration is a scenario-fact exploration cell: choose tiles → combine conditions → inspect matching cases and their sources → reveal/edit the actual Glyph query → save and remix the investigation. This teaches set logic, composition, scope, counting, and the difference between evidence and inference. Ordinary equation manipulation remains the job of the algebra/proof engines; no general numerical-programming capability is assumed for Glyph.

| Student action                           | Candidate Glyph integration                                                                          | Learning opportunity                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Find cases with both selected properties | Compose actual query text with `∧`                                                                   | Intersection and conjunction                                   |
| Include either set of cases              | Compose with `∨`                                                                                     | Union, alternatives, and overlapping sets                      |
| Ask which source supports a result       | Expose provenance and source-qualified queries                                                       | Scope, assumptions, and evidence                               |
| Count matching cases                     | Use the supported full-query reduction surface                                                       | Cardinality and distinctness                                   |
| Inspect an inferred suggestion           | Preserve Member/Candidate/absence distinctions                                                       | Observation versus inference; absence is not universal falsity |
| Remix and share an exploration           | Save query text, declared vocabulary/lens, input-fact snapshot, and engine version with the workbook | Reproducibility, authorship, and peer review                   |

Implementation should follow Glyph's existing embedded-engine contract: pass Glyph text to the engine and consume shared wire-shaped results, rather than rebuilding its tag algebra in JavaScript. Atlas's `fromFacts`, `query`, and `queryFull` Wasm surfaces are concrete precedents, not an assertion that its application-specific fixture adapter is a stable general SDK. A Math Lab host needs its own bounded workbook-fact bridge, an explicit method subset, and a declared reach. Supply only facts the current room member may read; browser execution is not a replacement for server authorization. Save authored content through the lab's durable storage and replay it into the ephemeral engine.

Keep tile and text representations visibly connected. Do not promise arbitrary text-to-tiles round trips before specifying their supported grammar. Use built syntax: the reviewed lexer supports `∧ ∨ ¬`; the separate `& | !` operator-alias proposal is ratified but explicitly unimplemented in the reviewed tree. Pin a tested upstream version before shipping, since the project describes its interfaces as experimental.

Preserve student authorship, version history, attribution, peer review, and the existing Build/Guide/Notebook modes. Treat executable workbook content as untrusted and design bounded, isolated execution once the runtime is known. Lean should certify explicit mathematical claims within a documented supported subset; a verified algebra statement must never be presented as proof that an arbitrary Glyph program is correct. A future language-to-proof bridge needs its own semantics, tests, and visible trust boundary.

This is a planned direction, not an implemented Glyph runtime or a decision to replace the current algebra notation.

## V2: Self Service

Evaluate Glyph's **Mosaic** and **Skirmish** machinery for student-authored game simulations. The owner identifies existing wargame-simulation capabilities in these projects as especially relevant. Review the current implementations in `~/source/repos/glyph` before designing a new simulation engine; the earlier Glyph survey is not a completed audit of their simulation capabilities.

The intended student workflow is to create or remix a playable world, define roles and objectives, supply rules and data, run experiments, compare strategies, and share the scenario with its sources and authorship intact. Explore whether Mosaic/Skirmish can support that workflow and the [strategy ladders](docs/mission-planning.md#v2-strategy-ladders-and-optimization). This is a discovery item for V2, not a commitment to specific unreviewed APIs or a shipped integration.

Before implementation, map the actual supported simulation primitives, embedding/runtime interface, scenario format, replay behavior, provenance, and licensing. Check which capabilities fit student-authored scenarios and what execution limits are needed. Keep simulation results, mathematical checks, empirical match observations, and formal proof claims visibly distinct. Students should be able to reach the underlying Glyph as an optional learning step after using the authoring tools.
