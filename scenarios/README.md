# Scenario format

Each catalog file has `formatVersion: 1`, a unique short `id`, a `title`, `creator`, `license: "MIT"`, and a `scenario` object. Copy `brawl.json` or `siege.json` for a complete example. The app's JSON export contains its authoring object in `document`; place that object in the catalog wrapper's `scenario` field. Solver work and reviews do not belong in a reusable template.

The scenario contains:

| Field         | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| `type`        | Always `scenario`                                            |
| `theme`       | `original`, `brawl`, or `siege`                              |
| `story`       | The premise and larger objective                             |
| `information` | Supplied facts, assumptions, and data provenance             |
| `data`        | Objects with unique `key`, string `value`, and `unit`        |
| `tasks`       | 1–16 role problems, shared challenges, or independent checks |

Each task includes `id`, `role`, `title`, `intro` (question and role-specific information), `equation`, `variable` (one lower-case letter), `unit`, `hints` (up to five), `intended` (author-only solution), `intent` (`unique`, `multiple`, `none`, or `open`), `kind` (`role`, `team`, or `transfer`), `output`, `dependencies` (task IDs), `constraints` (additional relations), `takeaway`, `facts`, and `answers`. Empty arrays are valid for optional collections. An empty `equation` creates an open investigation whose written observations can be published without automatic correctness certification.

`answers` optionally adds final decision fields: `{ key, label, unit, expected }`. Each numeric `expected` can be overridden by `answerExpressions[key]`, an arithmetic expression, optionally wrapped in `ceil(...)` or `min(...,...)`. These are useful for whole-upgrade decisions and combined timing constraints.

## Connect findings

Use `{{key}}` to refer to supplied data or a task's named output. The solver resolves task outputs only after publication. The author checker uses intended outputs to preview the puzzle. A named output must be a single isolated result, such as `t = 6`, or an isolated formula. A multi-answer result cannot be silently collapsed into one number. Let the next task reason about those branches explicitly.

Declare each upstream task in `dependencies`. A team must publish and peer-review prerequisites before publishing a dependent result; solo play only requires publication. Circular dependency graphs are rejected. Revisions invalidate downstream publications and approvals while retaining the work.

## Mathematical scope

Use single-letter variables, integers, decimals, fractions, parentheses, `+ - * /`, and `| |`. Multiplication can be implicit (`3x`). Separate complete solution branches with `or`. Relations support `=`, `<`, `>`, `<=`, and `>=`. Constant denominators must be nonzero. Nonlinear products, variable denominators, and nested absolute values are outside the exact checker. Graph cells are numerical explorations and have a broader arithmetic evaluator.

Examples: `3(x-2)=15`, `d=1800+200u`, `3|x-4|+2=11`, `x=1 or x=7`, `no solution`, `all real numbers`. Supply additional constraints separately, e.g. `x>=0`.

## Validate and register

Add an import and entry in `catalog.ts`, then run `npm run scenarios:check`. The check validates document structure, output keys, dependency graphs, intended solutions, and puzzle intent. Intentional ambiguity and impossibility pass when correctly labeled. A PR should also explain how a student can solve the scenario and interpret the result.
