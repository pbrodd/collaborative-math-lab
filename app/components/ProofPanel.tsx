'use client';
import { useEffect, useMemo, useState } from 'react';
import { analyze, equivalent } from '../../lib/algebra';
import {
  buildProof,
  proofDigest,
  LEAN_VERSION,
  type ProofClaim,
  type ProofRequest,
} from '../../lib/formal';
import { findReceipt, type ProofReceipt } from '../../lib/proof-receipts';
import examples from '../../verification/examples.json';

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProofPanel({
  before,
  after,
  constraints = [],
  kind = 'solution',
  expanded = false,
}: ProofRequest & { expanded?: boolean }) {
  const encoded = JSON.stringify({ before, after, constraints, kind });
  const parsed = useMemo((): { claim?: ProofClaim; error?: string } => {
    try {
      return { claim: buildProof(JSON.parse(encoded)) };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'This claim cannot be translated yet.',
      };
    }
  }, [encoded]);
  const [evidence, setEvidence] = useState<{
    source: string;
    digest: string;
    receipt?: ProofReceipt;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (parsed.claim) {
      const claim = parsed.claim;
      proofDigest(claim)
        .then((digest) => {
          if (active)
            setEvidence({ source: claim.source, digest, receipt: findReceipt(claim, digest) });
        })
        .catch(() => {
          if (active) setEvidence(null);
        });
    }
    return () => {
      active = false;
    };
  }, [parsed]);
  // Never show a previous claim's badge while a new digest is still computing.
  const current = evidence?.source === parsed.claim?.source ? evidence : null;
  const receipt = current?.receipt;
  const constrained = constraints.some((c) => c.trim());
  const original = analyze(before, constraints);
  const proposed = analyze(after, kind === 'step' ? constraints : []);
  const quick = constrained
    ? original.kind === 'unsupported' || proposed.kind === 'unsupported'
      ? null
      : original.description === proposed.description
    : equivalent(before, after).valid;
  return (
    <details className="proof-panel" open={expanded || undefined}>
      <summary>
        <span>
          Overkill mode <small>Bring receipts.</small>
        </span>
        <span className={`status ${receipt ? 'success' : ''}`}>
          {receipt ? 'Lean verified' : 'Inspect the proof'}
        </span>
      </summary>
      <div className="proof-body">
        <p className="proof-lede">Eighth-grade algebra. A rather serious proof assistant.</p>
        <p className="field-note">
          This is not a general-purpose algebra verifier. We check supported linear and
          absolute-value problems; “Lean verified” covers only the exact displayed claim and its
          stated conditions.
        </p>
        <p>
          Check that <strong>every solution is preserved</strong>, in both directions, over the real
          numbers. A solution that works is only half the story.
        </p>
        <div className="proof-claim">
          <div>
            <small>Starting relationship</small>
            <code>{before || 'No relationship yet'}</code>
          </div>
          <span aria-label="if and only if">↔</span>
          <div>
            <small>{kind === 'step' ? 'Proposed step' : 'Complete solution'}</small>
            <code>{after || 'Add a result to inspect'}</code>
          </div>
        </div>
        {constrained && (
          <p className="field-note">
            Conditions: {constraints.filter(Boolean).join('; ')}.{' '}
            {kind === 'step'
              ? 'Applied to both lines: this is a step under these assumptions.'
              : 'Applied to the starting relationship. The result must describe the complete remaining solution set.'}
          </p>
        )}
        {parsed.error ? (
          <p className="notice" role="status">
            Not translated: {parsed.error}
          </p>
        ) : (
          <>
            <dl className="proof-checks">
              <div>
                <dt>Quick algebra check</dt>
                <dd>
                  {quick === null
                    ? 'Outside the quick checker’s scope'
                    : quick
                      ? 'Same solution set'
                      : 'Does not match, or is outside the quick checker’s scope'}
                </dd>
              </div>
              <div>
                <dt>Lean kernel check</dt>
                <dd>
                  {receipt
                    ? `Verified · Lean ${LEAN_VERSION} · saved receipt`
                    : 'Not yet run for this exact claim'}
                </dd>
              </div>
            </dl>
            <p>
              {receipt
                ? 'A bundled receipt records a successful Lean check of this exact generated claim. Changing the mathematics requires a matching receipt.'
                : 'This is a proof candidate, not a certificate. Download it to run Lean, or contribute the scenario for automatic verification in GitHub. The hosted app does not run a live Lean server.'}
            </p>
            {original.kind === 'none' && (
              <p className="notice">
                The starting conditions have no solutions. An equivalence can certify impossibility;
                it does not show that the scenario is achievable.
              </p>
            )}
            {!!receipt && quick === false && (
              <p className="notice">
                The two checkers disagree. Inspect the exact statement and flag this for human
                review.
              </p>
            )}
            <div className="proof-actions">
              <button
                type="button"
                className="button small"
                onClick={() => download(parsed.claim!.source, 'AlgebraClaim.lean', 'text/plain')}
              >
                Download Lean proof
              </button>
              <button
                type="button"
                className="button small secondary"
                onClick={() =>
                  download(
                    JSON.stringify(parsed.claim!.request, null, 2) + '\n',
                    'algebra-claim.json',
                    'application/json',
                  )
                }
              >
                Download check request
              </button>
            </div>
            <details className="formal-source">
              <summary>Read the formal statement and proof</summary>
              <p>
                Each <code>v_x</code> is the variable <code>x</code>; <code>ℝ</code> means real
                numbers and <code>↔</code> means “if and only if.” Lean must prove both directions.
              </p>
              <pre>
                <code>{parsed.claim!.source}</code>
              </pre>
            </details>
            {current && (
              <details className="formal-source">
                <summary>Receipt details</summary>
                <p>SHA-256 of the generated proof file:</p>
                <code className="proof-hash">{current.digest}</code>
                {receipt && (
                  <p>
                    Allowed axioms used: {receipt.axioms.join(', ') || 'none'}. This check covers
                    this statement, not other workbook steps.
                  </p>
                )}
                <a
                  href="https://github.com/pbrodd/collaborative-math-lab/actions/workflows/lean.yml"
                  target="_blank"
                  rel="noreferrer"
                >
                  Inspect the public verification runs ↗
                </a>
              </details>
            )}
          </>
        )}
        <p className="field-note">
          A proof checks the equation we wrote. People still check the story, supplied data, units,
          and reasoning.{' '}
          <a href="/verification" target="_blank" rel="noreferrer">
            How verification works ↗
          </a>
        </p>
      </div>
    </details>
  );
}

export function WorkProof({
  before,
  constraints,
  steps,
}: {
  before: string;
  constraints: string[];
  steps: { equation: string }[];
}) {
  const [selected, setSelected] = useState('solution');
  const index = Number(selected);
  const step =
    selected !== 'solution' && Number.isInteger(index) && index >= 0 && index < steps.length;
  return (
    <section className="work-proof">
      <label>
        Claim to inspect
        <select
          aria-label="Claim to inspect with Lean"
          value={step ? selected : 'solution'}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="solution">Starting problem ↔ my complete solution</option>
          {steps.map((_, i) => (
            <option key={i} value={i}>
              Step {i + 1} preserves the previous line
            </option>
          ))}
        </select>
      </label>
      <ProofPanel
        before={step && index ? steps[index - 1].equation : before}
        after={step ? steps[index].equation : steps.at(-1)?.equation || ''}
        constraints={constraints}
        kind={step ? 'step' : 'solution'}
      />
    </section>
  );
}

export function ProofPlayground() {
  const [before, setBefore] = useState(examples[1].before);
  const [after, setAfter] = useState(examples[1].after);
  const [constraints, setConstraints] = useState('');
  return (
    <section className="proof-playground">
      <h2>Try the overkill</h2>
      <p>Start with a checked example. Then try deleting one absolute-value branch.</p>
      <div className="parts">
        {examples.map((example) => (
          <button
            key={example.id}
            onClick={() => {
              setBefore(example.before);
              setAfter(example.after);
              setConstraints(example.constraints?.join('\n') || '');
            }}
          >
            {example.label}
          </button>
        ))}
      </div>
      <div className="proof-inputs">
        <label>
          Starting relationship
          <input value={before} onChange={(e) => setBefore(e.target.value)} maxLength={1200} />
        </label>
        <label>
          Proposed complete solution
          <input value={after} onChange={(e) => setAfter(e.target.value)} maxLength={1200} />
        </label>
      </div>
      <label>
        Extra conditions · one per line
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={2}
          maxLength={2400}
        />
      </label>
      <ProofPanel
        before={before}
        after={after}
        constraints={constraints.split('\n').filter(Boolean)}
        expanded
      />
      <p className="field-note">
        This scratchpad is not saved. Keep your longer investigations in a workbook.
      </p>
    </section>
  );
}
