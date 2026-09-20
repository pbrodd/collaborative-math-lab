import { ProofPlayground } from '../components/ProofPanel';
export default function VerificationPage() {
  return (
    <main className="verification-page">
      <a className="text-button" href="/">
        ← Back to the lab
      </a>
      <span className="eyebrow">THE DEPARTMENT OF COMPLETELY NECESSARY OVERKILL</span>
      <h1>
        Trust the work.
        <br />
        Inspect the proof.
      </h1>
      <p className="verification-intro">
        Yes, we brought a research proof assistant to an eighth-grade algebra problem.
      </p>
      <div className="verification-levels">
        <article>
          <span>01</span>
          <h2>Quick checks</h2>
          <p>
            Exact fractions and a bounded algebra engine check your steps immediately. No AI grades
            the equations. This code can still have bugs.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Lean receipts</h2>
          <p>
            An independent translator writes a claim over the real numbers. Lean builds and
            kernel-checks its proof. A badge appears only for an exact match to a checked receipt.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>People thinking</h2>
          <p>
            Your teammates check the interpretation, units, assumptions, and explanation. A correct
            equation can describe the wrong thing. Formal verification makes peer review more
            focused.
          </p>
        </article>
      </div>
      <ProofPlayground />
      <section className="verification-notes">
        <h2>What does “verified” actually mean?</h2>
        <p>
          For every real value of the displayed variables, the starting relationship and its
          complete solution are equivalent. Both directions are proved. Extra conditions appear
          explicitly in the statement. An intentionally impossible puzzle can be proved to have no
          solutions.
        </p>
        <p>
          The current translator handles linear relationships, exact rational constants, constant
          division, absolute values, inequalities, and “and/or” branches. Unsupported expressions,
          timeouts, and unfinished proofs never earn a verification badge. A failed proof attempt
          means “not verified”; it does not by itself mean “false.”
        </p>
        <p>
          Lean runs in our public contribution checks or on your own computer. The hosted lab looks
          up checked receipts and exports new proof candidates; it does not send your workbook to a
          proof service. A receipt applies to one exact claim, not every step or the entire app.
        </p>
        <p>
          We pin Lean and Mathlib, reject unfinished proofs and additional axioms, and deliberately
          test wrong answers. There is still a trust boundary: the parser, the translation to Lean,
          the proof assistant, its mathematical foundations, and the software delivering the
          receipt. The visible formal statement makes that boundary inspectable.
        </p>
        <p>
          <a
            href="https://github.com/pbrodd/collaborative-math-lab/tree/main/verification"
            target="_blank"
            rel="noreferrer"
          >
            Reproduce the checks and learn Lean ↗
          </a>{' '}
          ·{' '}
          <a
            href="https://lean-lang.org/doc/reference/latest/Elaboration-and-Compilation/"
            target="_blank"
            rel="noreferrer"
          >
            How Lean checks proofs ↗
          </a>
        </p>
      </section>
    </main>
  );
}
