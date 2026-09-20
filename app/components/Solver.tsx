'use client';
import { useEffect, useState } from 'react';
import { equivalent, transform } from '../../lib/algebra';
import { emptyWork, type HelpMode, type Work } from '../../lib/missions';
import {
  assessTask,
  resolveTask,
  scenarioValues,
  type Book,
  type ScenarioTask,
  type Contribution,
} from '../../lib/model';
import { MissionExperiment } from './Graph';
export type Mutation = (data: Record<string, unknown>) => Promise<Book>;
export function MathLine({ text }: { text: string }) {
  return (
    <div className="math-line">
      {text.split(/\s+or\s+/).map((part, i) => (
        <span key={i}>
          {i > 0 && <small>or</small>}
          {part.replace(/\*/g, ' × ').replace(/<=/g, '≤').replace(/>=/g, '≥')}
        </span>
      ))}
    </div>
  );
}
function workFor(book: Book, task: ScenarioTask) {
  return book.contributions.find(
    (c) => c.task_id === (task.kind === 'transfer' ? `${task.id}:private:${book.me}` : task.id),
  );
}
export function Solver({
  book,
  mutate,
  onDirty,
}: {
  book: Book;
  mutate: Mutation;
  onDirty: (v: boolean) => void;
}) {
  const scenario = book.document;
  if (scenario.type !== 'scenario') return null;
  return <SolverInner book={book} mutate={mutate} onDirty={onDirty} />;
}
function SolverInner({
  book,
  mutate,
  onDirty,
}: {
  book: Book;
  mutate: Mutation;
  onDirty: (v: boolean) => void;
}) {
  const scenario = book.document as import('../../lib/model').Scenario;
  const [selected, setSelected] = useState(scenario.tasks[0].id);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<'work' | 'team'>('work');
  const task = scenario.tasks.find((t) => t.id === selected) || scenario.tasks[0];
  const contribution = workFor(book, task);
  const values = scenarioValues(scenario, book.contributions, false, book.revision);
  const resolved = resolveTask(task, values);
  const done = scenario.tasks.filter(
    (t) => t.kind !== 'transfer' && workFor(book, t)?.published,
  ).length;
  const roleTasks = scenario.tasks.filter((t) => t.kind !== 'transfer');
  const changeTask = (id: string) => {
    if (dirty && !window.confirm('Leave your unsaved draft? Save it first to keep these changes.'))
      return;
    setSelected(id);
    setDirty(false);
    onDirty(false);
    setPanel('work');
  };
  return (
    <div className="solver-layout">
      <aside className="mission-nav">
        <span className="eyebrow">YOUR MISSION</span>
        <h2>{book.title.replace(' · playthrough', '')}</h2>
        <p>{scenario.story}</p>
        <div className="progress-line">
          <span style={{ width: `${(done / Math.max(1, roleTasks.length)) * 100}%` }} />
        </div>
        <small>
          {done} of {roleTasks.length} findings published
        </small>
        <nav aria-label="Mission tasks">
          {scenario.tasks.map((t, i) => {
            const c = workFor(book, t);
            return (
              <button
                key={t.id}
                className={`task-nav ${task.id === t.id && panel === 'work' ? 'active' : ''}`}
                onClick={() => changeTask(t.id)}
              >
                <span className={`task-number ${c?.published ? 'complete' : ''}`}>
                  {c?.published ? '✓' : String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <b>{t.role}</b>
                  <small>
                    {c?.owner_id
                      ? book.members.find((m) => m.id === c.owner_id)?.name
                      : 'Unassigned'}
                    {c?.reviewer_id ? ' · reviewed' : c?.published ? ' · published' : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </nav>
        <button
          className={`button secondary full ${panel === 'team' ? 'selected' : ''}`}
          onClick={() => {
            if (dirty && !window.confirm('Leave the unsaved draft?')) return;
            setDirty(false);
            onDirty(false);
            setPanel('team');
          }}
        >
          Team planning table ↗
        </button>
        <details className="mission-assumptions">
          <summary>Supplied information</summary>
          <p>{scenario.information}</p>
          {scenario.data.map((d) => (
            <div key={d.key}>
              <code>{d.key}</code> {d.value} {d.unit}
            </div>
          ))}
        </details>
      </aside>
      <div className="solver-main">
        {panel === 'team' ? (
          <TeamTable book={book} onSelect={changeTask} />
        ) : contribution ? (
          <TaskEditor
            key={`${book.id}:${task.id}`}
            book={book}
            task={resolved}
            definition={task}
            contribution={contribution}
            mutate={mutate}
            onDirty={(v) => {
              setDirty(v);
              onDirty(v);
            }}
          />
        ) : (
          <p>Loading this role’s workspace…</p>
        )}
      </div>
      <aside className="crew-panel">
        <span className="eyebrow">THE CREW</span>
        <div className="crew-list">
          {book.members.map((m) => (
            <div className="crew-person" key={m.id}>
              <span className="avatar">{m.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>
                  {m.name}
                  {m.id === book.me ? ' (you)' : ''}
                </b>
                <small>{Date.now() - m.last_seen < 20000 ? 'Here now' : 'Away for now'}</small>
              </span>
              <i className={Date.now() - m.last_seen < 20000 ? 'presence online' : 'presence'} />
            </div>
          ))}
        </div>
        <div className="crew-note">
          <span className="mini-symbol">↗</span>
          <h3>Good teams show their thinking.</h3>
          <p>Make a claim. Show the evidence. Invite another pair of eyes.</p>
        </div>
        <p className="field-note">
          Room changes sync about every 3 seconds. Your independent check belongs to you.
        </p>
      </aside>
    </div>
  );
}
function TaskEditor({
  book,
  task,
  definition,
  contribution,
  mutate,
  onDirty,
}: {
  book: Book;
  task: ScenarioTask;
  definition: ScenarioTask;
  contribution: Contribution;
  mutate: Mutation;
  onDirty: (v: boolean) => void;
}) {
  const [work, setWork] = useState<Work>(() => structuredClone(contribution.work));
  const [base, setBase] = useState(contribution.revision);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [operation, setOperation] = useState('subtract');
  const [amount, setAmount] = useState('');
  const [next, setNext] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const mine = contribution.owner_id === book.me;
  const unresolved = /\{\{/.test(task.equation);
  const current = work.steps.at(-1)?.equation || task.equation;
  const checked = assessTask(task, work);
  const changedRemotely = base !== contribution.revision && dirty;
  useEffect(() => {
    if (!dirty) {
      setWork(structuredClone(contribution.work));
      setBase(contribution.revision);
    }
  }, [contribution, dirty]);
  const edit = (patch: Partial<Work>) => {
    setWork((w) => ({ ...w, ...patch }));
    setDirty(true);
    onDirty(true);
    setMessage('');
    setError('');
  };
  const append = (equation: string, why: string) => {
    if (work.steps.length >= 30) {
      setError('Keep this solution within 30 steps.');
      return;
    }
    edit({ steps: [...work.steps, { equation, reason: why }] });
    setNext('');
    setReason('');
  };
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError('');
    try {
      const updated = await mutate({
        action,
        task: definition.id,
        revision: action === 'save' || action === 'publish' ? base : contribution.revision,
        bookRevision: book.revision,
        ...(action === 'save' || action === 'publish' ? { work } : {}),
        ...extra,
      });
      if (action === 'save' || action === 'publish') {
        setDirty(false);
        onDirty(false);
        const saved = workFor(updated, definition);
        if (saved) {
          setBase(saved.revision);
          setWork(saved.work);
        }
        setMessage(
          action === 'publish' ? 'Published. Your reasoning is ready for review.' : 'Draft saved.',
        );
      }
      if (action === 'review' || action === 'reply') setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const reviews = book.reviews.filter((r) => r.task_id === contribution.task_id);
  const dependencies = definition.dependencies
    .map((id) =>
      (book.document as import('../../lib/model').Scenario).tasks.find((t) => t.id === id),
    )
    .filter(Boolean) as ScenarioTask[];
  return (
    <>
      <div className="task-heading">
        <div>
          <span className="eyebrow">
            {task.kind === 'team'
              ? 'BRING IT ALL TOGETHER'
              : task.kind === 'transfer'
                ? 'ON YOUR OWN'
                : task.role.toUpperCase()}
          </span>
          <h1>{task.title}</h1>
        </div>
        <span className={`status ${dirty ? 'draft' : contribution.published ? 'success' : ''}`}>
          {dirty
            ? 'Unsaved draft'
            : contribution.reviewer_id
              ? 'Peer reviewed'
              : contribution.published
                ? 'Published'
                : 'In progress'}
        </span>
      </div>
      <p className="task-intro">{task.intro}</p>
      <div className="assignment">
        <span>
          {mine
            ? 'You own this task.'
            : contribution.owner_id
              ? `${book.members.find((m) => m.id === contribution.owner_id)?.name} owns this task.`
              : 'This role is ready for someone to take.'}
        </span>
        {!contribution.owner_id ? (
          <button
            className="button small"
            disabled={busy}
            onClick={() => act('assign', { owner: book.me })}
          >
            Take this role
          </button>
        ) : definition.kind !== 'transfer' && (book.isOwner || mine) ? (
          <label className="assignment-select">
            Hand off{' '}
            <select
              aria-label="Assign this role"
              value={contribution.owner_id}
              onChange={(e) => act('assign', { owner: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {book.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {!!dependencies.length && (
        <div className="input-findings">
          {dependencies.map((d) => {
            const c = workFor(book, d);
            return (
              <div key={d.id}>
                <small>{d.role}</small>
                <b>
                  {c?.published
                    ? c.work.steps.at(-1)?.equation || 'Observation published'
                    : 'Awaiting a finding'}
                </b>
                <span>
                  {c?.reviewer_id ? 'Reviewed' : c?.published ? 'Ready for review' : 'In progress'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {task.equation && (
        <section className="equation-stage">
          <span className="eyebrow">THE STARTING RELATIONSHIP</span>
          <MathLine text={task.equation} />
          {unresolved && <p>Named inputs will appear here when the team publishes its findings.</p>}
          {task.constraints.length > 0 && (
            <div className="constraints">Also satisfy: {task.constraints.join(' and ')}</div>
          )}
        </section>
      )}
      <div className="work-toolbar">
        <h2>Your working</h2>
        <div className="segmented" aria-label="Help level">
          {(['build', 'guide', 'notebook'] as HelpMode[]).map((mode) => (
            <button
              key={mode}
              aria-pressed={work.mode === mode}
              disabled={!mine}
              onClick={() => edit({ mode })}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="steps">
        {!work.steps.length && (
          <div className="empty-steps">
            <span>01</span>
            <p>
              {work.mode === 'build'
                ? 'Choose a move. Keep both sides in balance.'
                : 'Write your next equation and what changed.'}
            </p>
          </div>
        )}
        {work.steps.map((s, i) => {
          const result =
            checked.checks[i] ||
            equivalent(i ? work.steps[i - 1].equation : task.equation, s.equation);
          return (
            <div className={`work-step ${result.valid ? 'valid' : 'invalid'}`} key={i}>
              <span className="step-index">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <MathLine text={s.equation} />
                <p>{s.reason || 'No operation note yet.'}</p>
                {!result.valid && <p className="feedback-error">{result.message}</p>}
              </div>
              <span
                className="step-check"
                aria-label={result.valid ? 'Equivalent equation' : 'Check this step'}
              >
                {result.valid ? '✓' : '?'}
              </span>
            </div>
          );
        })}
      </div>
      {mine && !unresolved && task.equation && (
        <div className="step-builder">
          {work.mode === 'build' ? (
            <>
              <p className="builder-label">
                Apply an operation to <strong>both sides</strong>
              </p>
              <div className="build-controls">
                <select
                  aria-label="Operation"
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                >
                  <option value="subtract">Subtract</option>
                  <option value="add">Add</option>
                  <option value="divide">Divide by</option>
                  <option value="multiply">Multiply by</option>
                  <option value="simplify">Simplify each side</option>
                  <option value="split">Open absolute-value paths</option>
                </select>
                {!['simplify', 'split'].includes(operation) && (
                  <input
                    aria-label="Number for the operation"
                    placeholder="number or fraction"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                )}
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    try {
                      const equation = transform(current, operation, amount);
                      append(
                        equation,
                        operation === 'split'
                          ? 'Opened every absolute-value path.'
                          : operation === 'simplify'
                            ? 'Simplified each side without changing its value.'
                            : `${operation[0].toUpperCase() + operation.slice(1)} ${amount} on both sides.`,
                      );
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Check the operation.');
                    }
                  }}
                >
                  Apply move →
                </button>
              </div>
              {!['simplify', 'split'].includes(operation) && (
                <div className="parts" aria-label="Number tiles">
                  {['2', '3', '4', '6', '8', '14', '200', '1500', '1800'].map((n) => (
                    <button key={n} onClick={() => setAmount(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <label>
                Next equation
                <input
                  className="math-input"
                  placeholder={`Example: ${task.variable} = …`}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && next.trim()) append(next, reason);
                  }}
                />
              </label>
              {work.mode === 'guide' && (
                <div className="parts" aria-label="Equation parts">
                  {[task.variable, '+', '-', '×', '/', '=', '(', ')', '|', 'or'].map((part) => (
                    <button
                      key={part}
                      onClick={() => setNext((v) => `${v}${part === 'or' ? ' or ' : part}`)}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              )}
              <label>
                What did you change?
                <input
                  placeholder="I divided both sides by…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={240}
                />
              </label>
              <button
                className="button"
                disabled={!next.trim() || busy}
                onClick={() => append(next, reason)}
              >
                Check and add step →
              </button>
            </>
          )}
          {work.steps.length > 0 && (
            <button
              className="text-button"
              onClick={() => edit({ steps: work.steps.slice(0, -1) })}
            >
              Undo last step
            </button>
          )}
        </div>
      )}
      {mine && (
        <div className="hint-area">
          <button
            className="text-button"
            disabled={work.hints >= task.hints.filter(Boolean).length}
            onClick={() => edit({ hints: work.hints + 1 })}
          >
            ✧ {work.hints ? 'Another hint' : 'A little help'}{' '}
            <span>
              {Math.min(work.hints, task.hints.filter(Boolean).length)}/
              {task.hints.filter(Boolean).length}
            </span>
          </button>
          {task.hints
            .filter(Boolean)
            .slice(0, work.hints)
            .map((h, i) => (
              <p key={i}>{h}</p>
            ))}
        </div>
      )}
      {!!task.answers.length && (
        <div className="decision-fields">
          {task.answers.map((a) => (
            <label key={a.key}>
              {a.label} <span>{a.unit}</span>
              <input
                disabled={!mine}
                value={work.answers[a.key] || ''}
                onChange={(e) => edit({ answers: { ...work.answers, [a.key]: e.target.value } })}
                placeholder="Your decision"
              />
            </label>
          ))}
        </div>
      )}
      <label className="explanation-label">
        What does your result tell the team?
        <textarea
          disabled={!mine}
          value={work.explanation}
          onChange={(e) => edit({ explanation: e.target.value })}
          maxLength={3000}
          placeholder="Explain your result, its units, and any assumptions someone should check."
          rows={3}
        />
      </label>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice good" role="status">
          {message}
        </div>
      )}
      {changedRemotely && (
        <div className="notice">
          A teammate updated this task. Your draft is preserved.{' '}
          <button
            className="text-button"
            onClick={() => {
              setDirty(false);
              onDirty(false);
              setBase(contribution.revision);
              setWork(structuredClone(contribution.work));
            }}
          >
            Load saved version
          </button>
        </div>
      )}
      {mine && (
        <div className="save-row">
          <button
            className="button secondary"
            disabled={busy || !dirty}
            onClick={() => act('save')}
          >
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          <button className="button" disabled={busy || unresolved} onClick={() => act('publish')}>
            Publish for review ↗
          </button>
          <span>{!checked.checked && checked.message}</span>
        </div>
      )}
      {task.kind === 'team' && (
        <details className="experiment-panel">
          <summary>Test your prediction</summary>
          <MissionExperiment book={book} />
        </details>
      )}
      <section className="review-section">
        <div className="section-title">
          <span className="eyebrow">ANOTHER PAIR OF EYES</span>
          <h2>Peer review</h2>
        </div>
        <p className="review-prompts">
          Check the operations. Check the assumptions and units. Check that the conclusion follows.
        </p>
        {reviews.map((r) => (
          <article className="review-note" key={r.id}>
            <div>
              <b>{book.members.find((m) => m.id === r.member_id)?.name || 'Teammate'}</b>
              <span>
                {r.verdict === 'approve'
                  ? 'Approved the reasoning'
                  : r.verdict === 'changes'
                    ? 'Requested a revision'
                    : 'Replied'}
                {r.work_revision !== contribution.revision ? ' · earlier draft' : ''}
              </span>
            </div>
            <p>{r.note}</p>
          </article>
        ))}
        <label>
          {mine && book.members.length > 1
            ? 'Respond to your reviewers'
            : 'Explain what you checked'}
          <textarea
            rows={2}
            placeholder={mine ? 'What did you revisit or clarify?' : 'I checked… My question is…'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1500}
          />
        </label>
        <div className="review-actions">
          {(!mine || book.members.length === 1) && contribution.published && (
            <>
              <button
                className="button secondary small"
                disabled={busy || note.trim().length < 12}
                onClick={() => act('review', { note, verdict: 'approve' })}
              >
                {book.members.length === 1 ? 'Record self-check' : 'Approve reasoning'}
              </button>
              {!mine && (
                <button
                  className="button secondary small"
                  disabled={busy || note.trim().length < 12}
                  onClick={() => act('review', { note, verdict: 'changes' })}
                >
                  Request revision
                </button>
              )}
            </>
          )}
          <button
            className="text-button"
            disabled={busy || note.trim().length < 12}
            onClick={() => act('reply', { note })}
          >
            Add a reply
          </button>
        </div>
      </section>
    </>
  );
}
function TeamTable({ book, onSelect }: { book: Book; onSelect: (id: string) => void }) {
  const scenario = book.document as import('../../lib/model').Scenario;
  return (
    <>
      <span className="eyebrow">CONNECT THE FINDINGS</span>
      <h1>The team planning table</h1>
      <p className="task-intro">
        Every result has an owner, a reason, and a connection to the bigger question.
      </p>
      <div className="team-findings">
        {scenario.tasks
          .filter((t) => t.kind !== 'transfer')
          .map((t) => {
            const c = workFor(book, t);
            return (
              <article className="finding" key={t.id}>
                <div className="finding-top">
                  <span className="eyebrow">{t.role}</span>
                  <span className={`status ${c?.reviewer_id ? 'success' : ''}`}>
                    {c?.reviewer_id ? 'Reviewed' : c?.published ? 'Awaiting review' : 'In progress'}
                  </span>
                </div>
                <h3>{t.title}</h3>
                {c?.published ? (
                  <>
                    <MathLine text={c.work.steps.at(-1)?.equation || 'Open observation'} />
                    <p>{c.work.explanation}</p>
                  </>
                ) : (
                  <p>This finding hasn’t been published yet.</p>
                )}
                {t.dependencies.length > 0 && (
                  <p className="field-note">
                    Uses:{' '}
                    {t.dependencies
                      .map((id) => scenario.tasks.find((x) => x.id === id)?.role)
                      .join(' + ')}
                  </p>
                )}
                <div className="finding-footer">
                  <span>
                    {book.members.find((m) => m.id === c?.owner_id)?.name || 'Unassigned'}
                  </span>
                  <button className="text-button" onClick={() => onSelect(t.id)}>
                    {c?.published ? 'Read & review' : 'Open workspace'} →
                  </button>
                </div>
              </article>
            );
          })}
      </div>
    </>
  );
}
