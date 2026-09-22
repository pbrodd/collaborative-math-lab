# Collaborative Math Lab

**Your questions. Your team. Your math.**

An MIT-licensed learning workspace where students create, remix, solve, and peer-review algebra adventures together. The product name is deliberately provisional: the students get to choose it. The application currently says **untitled**; `collaborative-math-lab` is the repository name.

The starting audience is accelerated eighth-grade math, especially equation manipulation, variable isolation, and absolute values. The larger purpose is student ownership: ask a question, model it, show the work, invite review, and build something another team can explore.

## Extremely serious FAQ

**Is mathbitch vibe coded?**

Yes.

**Is mathbitch free?**

Yes, and you can change it however you like.

**Is mathbitch backed by a proof assistant and functional programming language based on a version of the Calculus of Inductive Constructions?**

Yes.

[Lean 4](https://lean-lang.org/theorem_proving_in_lean4/Introduction/). For eighth-grade algebra.

**Is mathbitch a general-purpose algebra verifier?**

No. The app's automatic checks cover a limited subset of school algebra: linear relationships, exact fractions and decimals, and supported absolute-value equations and inequalities over real numbers. Quadratics, division by variables, trigonometry, calculus, and arbitrary written arguments are outside the current scope. Lean itself is a general-purpose proof assistant; our integration is deliberately limited.

“Lean verified” applies only to the exact displayed claim with its stated conditions and a matching checked receipt. A quick-check result or an exported proof candidate is not a Lean verification. Unsupported input or an unsuccessful proof attempt means **not verified**, not necessarily **incorrect**. See the [verification scope and limits](verification/README.md).

_“mathbitch” is another working name. The students still get to choose. The [MIT license](LICENSE) permits modification and redistribution; retain its copyright and permission notice. “Backed by” means the specific algebra claims checked by our [Lean verification pipeline](verification/README.md), not a proof of the entire app, its prose, or its game models._

## What you can do

- Keep open notebooks with questions, notes, calculations, numerical graphs, and unfinished ideas.
- Play the Brawl Stars damage-threshold and Rainbow Six Siege timing missions, alone or in a team room. Both use explicitly supplied practice data.
- Choose **Build**, **Guide**, or **Notebook** help independently for each task. Build lets students select terms, preview balanced moves, distribute, combine terms, and work on separate absolute-value cases. Guide and Notebook use MathLive for keyboard/touch entry with real fractions and grouping. Steps have undo/redo, and saved drafts include unfinished math entry. See [the algebra editor](docs/algebra-editing.md).
- Assign role subproblems, publish findings with explanations, approve reasoning or request revisions, and connect the findings into a team challenge.
- Create scenarios from a blank template, remix a starter or another student's scenario, or construct equations backwards from intended answers.
- Edit the story, supplied information, data, questions, hints, objectives, constraints, role outputs, and intended solutions. Coauthors can join the same scenario room.
- Audit a puzzle for one solution, several solutions, solution regions, and contradictions. Intentional impossibility is allowed. Test-play creates a separate solver workbook with author answers hidden in the interface.
- Save and reopen work, export a workbook, and retain creator/source attribution on remixes.
- Choose paper or an original mission-briefing appearance for notebooks and scenarios; the saved choice carries into remixes and test-play.
- Siege playthroughs in the briefing appearance open a theatrical mission-control screen with a rotating relay, published timing readouts, and a rehearsal of the predicted arrivals. Switch to quiet view at any time. Try the three opening problems at `/siege`; that standalone preview resets on reload. See [themes and quests](docs/themes-and-quests.md).
- Open **Shared planning board** in any workbook and start **Harbor Relay** or an empty board. The original SVG map supports player/objective markers, route waypoints, call-sign assignments, travel/setup estimates, and up to four objective stages. Drag a marker, use its keyboard controls, or edit coordinates. Changes save for the room; separate objects merge while conflicting edits preserve the local draft.
- Inspect the schedule and solve a route's start-delay interval with Build/Guide/Notebook help and optional proof export. Geometry changes flag affected timing estimates for review. Reviewers can save their reasoning together with the exact plan snapshot; earlier reviews stay visible after edits. The board uses its own supplied timing model, separately from a starter scenario's role equations.
- Prepare **Mission cards** from a saved scenario or playthrough: the whole team or a single role, published findings with review status, and prediction/observation cards. Open the print sheet to print or save as PDF, or download standalone HTML for offline use. Optional experiment prompts are saved in the downloaded artifact, not the workbook; record match results in a notebook or role discussion. Cards exclude author solutions, unpublished work, independent checks, and room invitations.
- Download a **field briefing** with the saved SVG map, each route's start cue/readiness time, source attribution, and artwork license. Scenario mission-card packs also include the planning team's map and route briefs when a board exists. Reviewed plan snapshots and the current board are included in workbook JSON exports; remixes and test-play copy the current plan without inheriting its approvals.
- Open **Overkill mode** to inspect a formal claim, see an exact matching Lean receipt, or export your own proof candidate. Scenario PRs receive independent Lean checks; the hosted app does not run a live Lean server. See [the verification guide](verification/README.md).

## Run locally

**Have a server with Docker?** See the [Docker and Cloudflare hosting guide](deploy/README.md) for a standalone deployment, persistent storage, HTTPS, and backups.

Use Node.js 24 and npm:

```sh
npm ci
export AUTH_SETUP_TOKEN="$(openssl rand -hex 32)"
printf 'Host setup key: %s\n' "$AUTH_SETUP_TOKEN"
npm run dev
```

Keep the printed setup key private. The initial setup form uses it to create the host account. See [accounts and invitations](docs/accounts.md).

Open the Local URL printed by the server (normally `http://localhost:3000`). The vinext/Vite development environment runs the Cloudflare-compatible Worker and a local D1 database. The application creates its tables on first use; the corresponding Drizzle migration is checked in. Local development data stays in ignored `.wrangler/` state.

No AI API key is required. Mathematical checks are deterministic and use exact rational arithmetic. Accounts use invite-only usernames and passwords, with one-use recovery codes. Display names can be nicknames; the app does not ask students for email addresses.

## Checks

```sh
npm test
npm run scenarios:check
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

With a disposable development server running and `TEST_SETUP_TOKEN` set to its `AUTH_SETUP_TOKEN`, `npm run test:integration` checks separate HTTP sessions, room joins, ownership, persistence, mathematical publishing, peer review, revision invalidation, write conflicts, open notebooks, remix attribution, test-play, and both starting missions. These tests create test accounts and workbooks. Browser tests build a standalone app with an isolated temporary database. For an already initialized HTTP test server, supply `TEST_ADMIN_USERNAME` and `TEST_ADMIN_PASSWORD` if you changed the default test host credentials. Use `TEST_BASE_URL` only against an appropriate test environment.

## Add a scenario through a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) and [scenarios/README.md](scenarios/README.md). A scenario is JSON plus an entry in `scenarios/catalog.ts`; the home page reads the catalog automatically. The validation command checks scenario structure and intended mathematics. The application export includes its scenario object in `document`, ready to place in the catalog wrapper.

Forking, modifying, sharing, and submitting PRs are welcome under the [MIT license](LICENSE).

## Architecture and current boundaries

- React components provide the notebook, authoring studio, solver, and review conversation.
- `lib/algebra.ts` checks affine equations and literal affine formulas, plus univariate absolute-value equations and inequalities with constant denominators. It preserves complete solution sets and rejects unsupported expressions. This is a bounded checker, not a general computer algebra system.
- `lib/model.ts` resolves named data/role inputs, authors' intended outputs, and scenario checks. `lib/validation.ts` validates the document format.
- `app/api/books` enforces room membership, role ownership, optimistic revisions, mathematical publication checks, and peer review on the server.
- D1 (Workers) or SQLite on a persistent volume (Docker) stores notebooks, scenario definitions, playthroughs, memberships, contributions, and review history. No student work depends on browser local storage. Account settings and display names are server-backed.
- Invite-only accounts identify students across browsers. HTTP-only session cookies expire after 14 days; signing in restores workbook access. One-use recovery codes reset forgotten passwords and revoke existing sessions. Workbook room codes remain separate from account invitations. See [account setup and recovery](docs/accounts.md). There is no global public scenario directory.
- Shared state polls about every three seconds. Board mutations check individual object revisions and retry independent concurrent saves against the latest plan. Same-object conflicts retain the local draft. Notebook/scenario document edits still use whole-document conflicts. Character-by-character editing and live cursor/drag broadcasts are not implemented.
- `lib/planning.ts` evaluates a small supplied schedule using exact integer milliseconds, pairwise stage spread, deadlines, and earlier-stage prerequisites. The algebra worksheet holds other arrivals fixed; the full schedule must be checked after changing a delay. It does not derive travel times from map geometry, check walls/visibility/player occupancy, or optimize routes. Milsymbol SVG artwork is generated at development time from a pinned MIT-licensed package; see [asset provenance](ASSET_PROVENANCE.md).
- Review feedback remains in history. Editing an input invalidates downstream publications and approvals without deleting their work. A team needs peer-reviewed prerequisites for its combined result; solo players can progress after publishing.
- Graphs are numerical explorations. Written explanations and the realism of a story require human review.

## Hosting

The project supports a [standalone Docker deployment](deploy/README.md), optionally behind Cloudflare Tunnel, and Cloudflare Workers through vinext. Both run the same app and proof receipts. Docker uses SQLite without Cloudflare credentials; Workers uses D1. `.openai/hosting.json` declares the logical D1 binding `DB`; Sites provisions and wires the deployed database. Generated migrations live in `drizzle/` and are included by the build plugin.

If you fork and publish a new Sites instance, remove the original `project_id` from `.openai/hosting.json` while retaining the logical bindings, then create a new site. Do not publish your fork over the original project. Other Cloudflare deployment setups can reuse the Worker output and migrations with their own resource configuration.

Site access and room access are separate. The site's hosting policy determines who can reach the app; room codes then determine which workbook they may join. Creating a public GitHub repository does not change a deployed site's access policy.

See [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for the accepted product direction and [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) for the generated social-preview asset.

See the [planning and experiments design](docs/mission-planning.md) for the implemented original-map pilot and the remaining work: structured match trials, alternative map backgrounds/floors, simulation, and optimization challenges. No Ubisoft blueprint assets are bundled. Third-party artwork retains its own applicable license and notices; downloadable Ubisoft maps are not covered by this repository's MIT license.
