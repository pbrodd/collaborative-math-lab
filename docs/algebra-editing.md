# Algebra display and editing

The lesson workspace uses MathLive 0.110.0 for formatted keyboard and touch input. The application serves its JavaScript and fonts locally. The input component loads the editor on demand; it does not load a remote compute engine or use MathLive to grade work.

## Working through a lesson

- In **Build**, select a displayed term to see relevant moves. A coefficient offers division; a signed term offers addition or subtraction; a group offers distribution. The operation controls also accept a number, fraction, or affine expression. Multiplication and division require nonzero constants.
- **Preview move** shows the balanced operation and the result before **Keep this step** records it. Parentheses and term order survive ordinary moves. Distribution and combining like terms are explicit choices. Multiplying or dividing an inequality by a negative constant reverses the sign and explains why.
- Opening an isolated absolute value preserves all cases. Equality and outside inequalities produce separate cases; inside inequalities produce simultaneous bounds. Zero and negative distances receive the appropriate single solution, empty set, or full set. After branching, choose one case or all cases for the next move.
- **Guide** and **Notebook** support direct math entry, fraction/group templates at the cursor, and typing undo/redo. Enter submits a written step. Unsupported notation and incomplete placeholders stay in the entry with feedback. A complete but mathematically incorrect attempt stays visible in the working so the student can inspect or undo it.
- **Undo last step** and **Redo step** operate on the written steps. New steps clear the redo path; an unrelated remote sequence cannot reuse it.
- **Save draft** includes unfinished equation and operation fields. These edits trigger the existing navigation/reload warnings and participate in revision conflict checks. Saving and reopening restores the pending entry; polling cannot replace a locally edited draft.

The shared display also renders notebook calculations, planning questions, and proof-panel claims. Scenario authoring still exposes the source notation, including named parameter placeholders. The numerical graph and independent Lean translator retain their existing mathematical boundaries.

## Implementation boundaries

| Layer                                        | Responsibility                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/math-notation.ts`                       | Retain grouping and term order; serialize the supported notation to LaTeX; translate a bounded subset of MathLive LaTeX back to the existing checker grammar; provide spoken labels. |
| `lib/algebra-moves.ts`                       | Construct deliberate written moves with exact rational arithmetic, preserve unexpanded groups, and verify the resulting complete solution set with the existing checker.             |
| `lib/algebra.ts`                             | Continue checking exact rational affine and supported univariate absolute-value relationships.                                                                                       |
| `MathInput`, `MathDisplay`, `EquationEditor` | Manage the math field, selectable terms, previews, case scope, and accessible controls.                                                                                              |
| `Work.entry`                                 | Store bounded, unfinished LaTeX separately from the plain-text equations in accepted or attempted steps. Older saved work remains compatible without this optional field.            |
| `lib/formal.ts`                              | Independently translate written claims for Lean verification. An editor preview does not confer a formal verification badge.                                                         |

Unknown LaTeX commands are rejected rather than stripped. Rendered saved equations pass through the bounded serializer, and unsupported or unfinished source is displayed as escaped text. Typed powers, roots, variable denominators, and a general CAS are outside the checked lesson subset. Freeform methods remain possible within the existing supported algebra.

## Verification

`tests/math-editing.test.ts` covers notation round trips, fractions, group preservation, variable-term moves, negative inequality operations, all absolute-value cases, invalid operations, and varied signed rational equations. Existing checker and proof tests remain in place.

`tests/browser/algebra.spec.ts` exercises a complete variables-on-both-sides solution, selectable terms through keyboard input, previews, undo/redo, actual MathLive typing, an unfinished fraction saved and reopened, conflicting remote work, individual absolute-value cases, local asset loading, and the touch keyboard with the input visible above it.

Upstream references: [MathLive](https://mathlive.io/mathfield/), [React integration](https://mathlive.io/mathfield/guides/react/), [custom keyboards](https://mathlive.io/mathfield/guides/virtual-keyboard/), [source and MIT license](https://github.com/arnog/mathlive).
