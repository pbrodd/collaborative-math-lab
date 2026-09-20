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

_“mathbitch” is another working name. The students still get to choose. The [MIT license](LICENSE) permits modification and redistribution; retain its copyright and permission notice. “Backed by” means the specific algebra claims checked by our [Lean verification pipeline](verification/README.md), not a proof of the entire app, its prose, or its game models._

## What you can do

- Keep open notebooks with questions, notes, calculations, numerical graphs, and unfinished ideas.
- Play the Brawl Stars damage-threshold and Rainbow Six Siege timing missions, alone or in a team room. Both use explicitly supplied practice data.
- Choose **Build**, **Guide**, or **Notebook** help independently for each task. Build applies student-selected operations to both sides; Guide offers parts and hints; Notebook accepts freely written steps.
- Assign role subproblems, publish findings with explanations, approve reasoning or request revisions, and connect the findings into a team challenge.
- Create scenarios from a blank template, remix a starter or another student's scenario, or construct equations backwards from intended answers.
- Edit the story, supplied information, data, questions, hints, objectives, constraints, role outputs, and intended solutions. Coauthors can join the same scenario room.
- Audit a puzzle for one solution, several solutions, solution regions, and contradictions. Intentional impossibility is allowed. Test-play creates a separate solver workbook with author answers hidden in the interface.
- Save and reopen work, export a workbook, and retain creator/source attribution on remixes.
- Open **Overkill mode** to inspect a formal claim, see an exact matching Lean receipt, or export your own proof candidate. Scenario PRs receive independent Lean checks; the hosted app does not run a live Lean server. See [the verification guide](verification/README.md).

## Run locally

**Have a server with Docker?** See the [Docker and Cloudflare hosting guide](deploy/README.md) for a standalone deployment, persistent storage, HTTPS, and backups.

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open the Local URL printed by the server (normally `http://localhost:3000`). The vinext/Vite development environment runs the Cloudflare-compatible Worker and a local D1 database. The application creates its tables on first use; the corresponding Drizzle migration is checked in. Local development data stays in ignored `.wrangler/` state.

No AI API key is required. Mathematical checks are deterministic and use exact rational arithmetic. Display names are nicknames; the app does not ask students for email addresses.

## Checks

```sh
npm test
npm run scenarios:check
npm run typecheck
npm run build
```

With the development server running, `npm run test:integration` checks separate HTTP sessions, room joins, ownership, persistence, mathematical publishing, peer review, revision invalidation, write conflicts, open notebooks, remix attribution, test-play, and both starting missions. These tests create local development workbooks. Use `TEST_BASE_URL` only against an appropriate test environment.

## Add a scenario through a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) and [scenarios/README.md](scenarios/README.md). A scenario is JSON plus an entry in `scenarios/catalog.ts`; the home page reads the catalog automatically. The validation command checks scenario structure and intended mathematics. The application export includes its scenario object in `document`, ready to place in the catalog wrapper.

Forking, modifying, sharing, and submitting PRs are welcome under the [MIT license](LICENSE).

## Architecture and current boundaries

- React components provide the notebook, authoring studio, solver, and review conversation.
- `lib/algebra.ts` checks affine equations and literal affine formulas, plus univariate absolute-value equations and inequalities with constant denominators. It preserves complete solution sets and rejects unsupported expressions. This is a bounded checker, not a general computer algebra system.
- `lib/model.ts` resolves named data/role inputs, authors' intended outputs, and scenario checks. `lib/validation.ts` validates the document format.
- `app/api/books` enforces room membership, role ownership, optimistic revisions, mathematical publication checks, and peer review on the server.
- D1 (Workers) or SQLite on a persistent volume (Docker) stores notebooks, scenario definitions, playthroughs, memberships, contributions, and review history. No student work depends on browser local storage. A display-name preference is device-local.
- An HTTP-only, random session cookie identifies the browser. A room code invites another browser into a specific workbook. Keep the cookie to resume your own memberships; use a room invitation when moving devices. This first release has no account recovery or global public scenario directory.
- Shared state polls about every three seconds. Concurrent edits produce an explicit conflict and retain the local draft; character-by-character collaborative editing is not implemented.
- Review feedback remains in history. Editing an input invalidates downstream publications and approvals without deleting their work. A team needs peer-reviewed prerequisites for its combined result; solo players can progress after publishing.
- Graphs are numerical explorations. Written explanations and the realism of a story require human review.

## Hosting

The project supports a [standalone Docker deployment](deploy/README.md), optionally behind Cloudflare Tunnel, and Cloudflare Workers through vinext. Both run the same app and proof receipts. Docker uses SQLite without Cloudflare credentials; Workers uses D1. `.openai/hosting.json` declares the logical D1 binding `DB`; Sites provisions and wires the deployed database. Generated migrations live in `drizzle/` and are included by the build plugin.

If you fork and publish a new Sites instance, remove the original `project_id` from `.openai/hosting.json` while retaining the logical bindings, then create a new site. Do not publish your fork over the original project. Other Cloudflare deployment setups can reuse the Worker output and migrations with their own resource configuration.

Site access and room access are separate. The site's hosting policy determines who can reach the app; room codes then determine which workbook they may join. Creating a public GitHub repository does not change a deployed site's access policy.

See [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for the accepted product direction and [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) for the generated social-preview asset.
