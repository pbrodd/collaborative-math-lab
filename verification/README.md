# The department of completely necessary overkill

**The lab is not a general-purpose algebra verifier.** Lean is a general-purpose proof assistant, but our input language and automated proof pipeline support only a deliberately limited subset of school algebra over the real numbers.

This is real Lean 4 verification of specific supported claims. A verified claim does not certify a whole workbook, the application, the TypeScript checker, an English explanation, or the game statistics. It does not establish that every correct claim in the supported subset will be proved automatically.

The supported input includes linear relationships, exact fractions and decimals, division by nonzero constants, non-nested absolute values, inequalities, and bounded combinations of conditions and alternatives. Quadratics and other nonlinear products, division by variables, roots, trigonometry, calculus, and arbitrary prose proofs are outside the current input language. Unsupported expressions, resource limits, and failed proof attempts mean **not verified**, not necessarily **incorrect**.

The lab keeps three distinct kinds of evidence:

1. **Quick algebra check:** the existing exact-rational TypeScript solver gives immediate feedback.
2. **Lean-verified claim:** an independently parsed statement has a kernel-checked proof and passes our axiom audit. A bundled receipt matches the SHA-256 of that exact generated proof file and its displayed statement.
3. **Human review:** people assess explanations, units, realism, and whether the equations model the intended question.

The app's **Overkill mode** appears in solver workspaces and scenario audits. The [verification playground](https://collaborative-math-lab.pbrodd.chatgpt.site/verification) has checked examples to edit. A changed or new claim has no Lean badge until its exact proof is checked. It can still be downloaded as a candidate; generating that file is not verification. Neither the Workers nor Docker deployment executes Lean or uploads student work to GitHub or an external proof service.

## Reproduce a proof

Install [Lean through elan](https://lean-lang.org/install/). The repository pins Lean **4.19.0** and Mathlib commit `c44e0c8ee63ca166450922a373c7409c5d26b00b`, including its transitive dependencies. Node.js 24 is used for the surrounding scripts.

From the repository root:

```sh
npm ci
cd verification
lake exe cache get
cd ..
npm run proofs:check
```

Mathlib's compiled cache is a substantial optional developer download. Students do not need it to use the hosted lab. Ordinary app development still works without Lean installed.

The command generates real-number equivalences for every catalog task with an equation and intended solution, plus the teaching examples. It runs Lean, inspects each theorem's axioms, and checks that deliberately wrong candidates fail. Open investigations without an equation are explicitly skipped, never certified. No proof receipt is issued if a required proof fails or times out.

To verify your own work, use **Download check request** in the app, then run:

```sh
npm run proofs:check -- --input /path/to/algebra-claim.json
```

The request contains only the displayed mathematical claim and conditions. The script parses it and generates Lean itself; it does not accept arbitrary Lean source. Read the resulting statement and audit in `verification/generated/`.

Alternatively, **Download Lean proof** gives an editable, standalone file for this pinned Mathlib environment:

```sh
cd verification
lake env lean /path/to/AlgebraClaim.lean
```

When editing Lean by hand, a zero exit status alone is insufficient: Lean permits unfinished `sorry` proofs with a warning. Our request-based runner additionally audits the theorem and allows only `propext`, `Classical.choice`, and `Quot.sound`. It rejects `sorryAx`, `Lean.ofReduceBool` (used by `native_decide`), and any additional axiom. For manually edited files, inspect the `#print axioms` output yourself.

## What exactly is proved?

For a complete solution, Lean proves:

```text
for every real assignment of the variables:
  (starting relationship AND supplied conditions) ↔ proposed solution
```

For an intermediate step under assumptions, it proves:

```text
for every real assignment of the variables:
  (previous line AND supplied conditions) ↔ (next line AND supplied conditions)
```

These are different claims. The second does not by itself establish the complete solution. Contradictory conditions can make both sides of a step impossible; the interface calls that out. A final `no solution` is represented by `False`, and `all real numbers` by `True`.

The independent translator in `lib/formal.ts` supports bounded affine expressions, single-letter real variables, exact decimal/fraction constants, constant nonzero denominators, non-nested absolute values, inequalities, chains, conjunctions, and disjunctions. It rejects variable denominators and nonlinear products. In particular, it rejects division by zero **before** translation: Lean's field division is totalized, while classroom division by zero is undefined.

The translator emits the original parsed relationships, not the TypeScript solver's computed answer. `aesop`, case splitting, and `linarith` construct proof terms that Lean's kernel checks. No language model produces a grading verdict. A failed attempt is “not verified,” not necessarily “false.”

## Contribution checks and receipts

The **Lean proof checks** GitHub workflow runs on pushes and PRs, including forks, with read-only repository permissions and no secrets. It verifies all catalog equations against their intended solutions after substituting explicitly supplied data and upstream intended outputs. It does not certify the rounding/decision fields or the prose. The ordinary scenario checks still validate structure and the declared solution intent.

The workflow publishes `Claims.lean`, the axiom report, and `receipts.json` as a downloadable artifact. Existing bundled receipts must be reproducible. New claims can pass CI before their receipts are bundled into the app. To refresh the app's receipt catalog locally:

```sh
npm run proofs:check -- --write-receipts
```

Alternatively, a maintainer can copy the receipt file from a successful run of the exact current source, then rerun CI. Receipts are reproducible evidence in the source repository, not signed security attestations. CI must check receipt changes. The app validates the proof digest, statement, toolchain versions, and allowed axioms before displaying a badge.

## What remains trusted?

The input parser and translation, Lean's kernel and foundations, imported library/toolchain artifacts, the CI environment, receipt generation and delivery, and the browser/app displaying the result. The displayed formal statement and downloadable proof make these boundaries inspectable; they do not eliminate them.

The checked domain is **real numbers**. If a question needs whole upgrades, nonnegative time, or unit consistency, those requirements must be modeled and separately reviewed. Numerical graphs are not proofs. A correct algebraic answer can still be a poor model of a game.

## Where students can take this

Use the visible `↔` as a first encounter with “if and only if.” Compare a claim with its converse, preserve both absolute-value cases, and construct a counterexample to a broken step. Later, students can edit the exported file to replace automation with named lemmas and their own proof steps. A future isolated Lean service could check new claims on demand; that is not running in this release.

References: [Lean's kernel and elaboration](https://lean-lang.org/doc/reference/latest/Elaboration-and-Compilation/), [Mathematics in Lean](https://leanprover-community.github.io/mathematics_in_lean/), [Theorem Proving in Lean](https://lean-lang.org/theorem_proving_in_lean4/), and [Mathlib's linarith tactic](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/Linarith/Frontend.html).
