'use client';
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import type { Book } from '../../lib/model';
import { analyze } from '../../lib/algebra';
import {
  schedule,
  seconds,
  timingQuestion,
  type Plan,
  type PlanMarker,
  type PlanObject,
  type PlanRoute,
  type PlanSettings,
} from '../../lib/planning';
import { planningSvg, planningDocument } from '../../lib/planning-art';
import { ProofPanel } from './ProofPanel';
import type { Mutation } from './Solver';
import { MathLine } from './MathDisplay';

type Draft = { kind: 'marker' | 'route' | 'settings'; value: PlanObject; base: number | null };
function saveFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PlanningBoard({
  book,
  mutate,
  onDirty,
}: {
  book: Book;
  mutate: Mutation;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Plan | null>(null);
  const [note, setNote] = useState('');
  const [reviewBase, setReviewBase] = useState<number | null>(null);
  const [selectedRoute, setSelectedRoute] = useState('route-a');
  const [answer, setAnswer] = useState('');
  const [mathHelp, setMathHelp] = useState<'build' | 'guide' | 'notebook'>('build');
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ draft: Draft; moved: boolean } | null>(null);
  const saved = book.planning?.plan;
  const plan = history || saved;
  useEffect(() => {
    onDirty(dirty || note.trim().length > 0 || answer.trim().length > 0);
  }, [dirty, note, answer, onDirty]);
  const replaceDraft = (value: PlanObject) => {
    setDraft((d) => (d ? { ...d, value } : null));
    setDirty(true);
    setError('');
    setMessage('');
  };
  function select(kind: Draft['kind'], value: PlanObject, fresh = false) {
    if (dirty && !window.confirm('Discard the unsaved board object before selecting another?'))
      return false;
    setDraft({ kind, value: structuredClone(value), base: fresh ? null : value.revision });
    setDirty(fresh);
    setError('');
    setMessage('');
    return true;
  }
  async function act(data: Record<string, unknown>, success: string) {
    setBusy(true);
    setError('');
    try {
      const b = await mutate(data);
      setMessage(success);
      return b;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plan could not be saved.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function save(d = draft) {
    if (!d || busy || history) return;
    const result = await act(
      { action: 'plan-edit', kind: d.kind, id: d.value.id, revision: d.base, object: d.value },
      'Saved. The crew will see this change.',
    );
    if (result) {
      setDraft(null);
      setDirty(false);
    }
  }
  function point(e: PointerEvent<HTMLDivElement>) {
    const svg = surface.current?.querySelector('svg');
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const local = p.matrixTransform(matrix.inverse());
    return {
      x: Math.min(780, Math.max(20, Math.round(local.x))),
      y: Math.min(475, Math.max(30, Math.round(local.y))),
    };
  }
  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    if (busy || history || !plan || e.button !== 0) return;
    const id = (e.target as Element).closest('[data-marker]')?.getAttribute('data-marker');
    const marker = plan.markers.find((m) => m.id === id);
    if (!marker) return;
    const current = draft?.kind === 'marker' && draft.value.id === id ? draft : null;
    if (!current && !select('marker', marker)) return;
    const d: Draft = current || {
      kind: 'marker',
      value: structuredClone(marker),
      base: marker.revision,
    };
    drag.current = { draft: d, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const p = point(e);
    if (!p) return;
    const d = { ...drag.current.draft, value: { ...drag.current.draft.value, ...p } };
    drag.current = { draft: d, moved: true };
    setDraft(d);
    setDirty(true);
    e.preventDefault();
  }
  function pointerUp(e: PointerEvent<HTMLDivElement>) {
    const move = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (move?.moved) void save(move.draft);
  }
  function keyboard(e: KeyboardEvent<HTMLDivElement>) {
    if (busy || history || !plan) return;
    const id = (e.target as Element).closest('[data-marker]')?.getAttribute('data-marker');
    const marker = plan.markers.find((m) => m.id === id);
    if (!marker) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (draft?.value.id === id && dirty) void save();
      else select('marker', marker);
      return;
    }
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-5, 0],
      ArrowRight: [5, 0],
      ArrowUp: [0, -5],
      ArrowDown: [0, 5],
    };
    const delta = deltas[e.key];
    if (!delta) return;
    e.preventDefault();
    if (draft?.value.id !== id && !select('marker', marker)) return;
    const value = draft && draft.value.id === id ? (draft.value as PlanMarker) : marker;
    setDraft({
      kind: 'marker',
      base: draft && draft.value.id === id ? draft.base : marker.revision,
      value: {
        ...value,
        x: Math.min(780, Math.max(20, value.x + delta[0])),
        y: Math.min(475, Math.max(30, value.y + delta[1])),
      },
    });
    setDirty(true);
    requestAnimationFrame(() => {
      [...(surface.current?.querySelectorAll<SVGGElement>('[data-marker]') || [])]
        .find((el) => el.getAttribute('data-marker') === id)
        ?.focus();
    });
  }
  let drawing = plan;
  if (plan && draft && !history) {
    drawing = { ...plan, markers: [...plan.markers], routes: [...plan.routes] };
    if (draft.kind === 'marker')
      drawing.markers = [
        ...plan.markers.filter((m) => m.id !== draft.value.id),
        draft.value as PlanMarker,
      ];
    if (draft.kind === 'route')
      drawing.routes = [
        ...plan.routes.filter((r) => r.id !== draft.value.id),
        draft.value as PlanRoute,
      ];
  }
  const timeline = plan ? schedule(plan) : null;
  const question = plan ? timingQuestion(plan, selectedRoute) : null;
  const solution = question ? analyze(question.equation, question.constraints) : null;
  const submitted = answer.trim() ? analyze(answer) : null;
  const correct =
    solution?.kind !== 'unsupported' &&
    submitted?.kind !== 'unsupported' &&
    solution?.description === submitted?.description;
  const reviews = book.planning?.reviews || [];
  return (
    <details className="planning-panel">
      <summary>
        <span>Shared planning board</span>
        <small>
          {saved
            ? `${saved.settings.title} · Plan ${saved.revision}`
            : 'Build a plan the crew can test'}
        </small>
      </summary>
      <div className="planning-body">
        {!plan ? (
          <div className="planning-welcome">
            <span className="eyebrow">ORIGINAL MAP / REAL QUESTIONS</span>
            <h2>Four routes. One window.</h2>
            <p>
              Create a shared board for this workbook. Move markers, set objectives, sketch routes,
              and work out when everyone should start.
            </p>
            <div className="card-downloads">
              <button
                className="button"
                disabled={busy}
                onClick={() => act({ action: 'plan-create' }, 'Practice board created.')}
              >
                Start Harbor Relay →
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  act({ action: 'plan-create', template: 'blank' }, 'Empty board created.')
                }
              >
                Start with an empty board
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="planning-heading">
              <div>
                <span className="eyebrow">RELAY STATION · ORIGINAL PRACTICE MAP</span>
                <h2>{plan.settings.title}</h2>
                <p>
                  {history
                    ? `Reviewed snapshot · Plan ${history.revision}`
                    : `Plan ${plan.revision} · Last changed by ${plan.updatedBy}`}
                </p>
              </div>
              <div className="card-downloads">
                {history ? (
                  <button className="button secondary" onClick={() => setHistory(null)}>
                    Return to current plan
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => select('settings', plan.settings)}
                  >
                    Briefing & conditions
                  </button>
                )}
                <button
                  className="button"
                  disabled={dirty || !book.planning || !!history}
                  onClick={() =>
                    saveFile(
                      planningDocument(
                        book.planning!,
                        book.title,
                        book.creator,
                        book.source ? `${book.source.title} by ${book.source.creator}` : '',
                      ),
                      'field-briefing.html',
                      'text/html',
                    )
                  }
                >
                  Download field briefing ↓
                </button>
              </div>
            </div>
            <p className="field-note">
              This board has its own supplied practice measurements. Dragging changes the sketch;
              update travel time after measuring the new route. Saved moves appear for teammates
              about every three seconds.
            </p>
            <div className="planning-grid">
              <div>
                <div
                  ref={surface}
                  className="planning-map"
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  onKeyDown={keyboard}
                  dangerouslySetInnerHTML={{
                    __html: planningSvg(drawing!, draft?.value.id || '', !history),
                  }}
                />
                <p className="field-note">
                  Drag a marker to save its position. Keyboard: focus a marker, move with arrow
                  keys, press Enter to save. You can also use the coordinate fields. Arrows show
                  direction; route times include separately entered setup.
                </p>
                {!history && (
                  <div className="board-tools">
                    <button
                      className="button secondary small"
                      disabled={busy || plan.markers.length >= 24}
                      onClick={() =>
                        select(
                          'marker',
                          {
                            id: crypto.randomUUID(),
                            revision: 0,
                            kind: 'player',
                            label: `Player ${plan.markers.filter((m) => m.kind === 'player').length + 1}`,
                            x: 400,
                            y: 465,
                            stage: 1,
                          },
                          true,
                        )
                      }
                    >
                      + Player
                    </button>
                    <button
                      className="button secondary small"
                      disabled={busy || plan.markers.length >= 24}
                      onClick={() =>
                        select(
                          'marker',
                          {
                            id: crypto.randomUUID(),
                            revision: 0,
                            kind: 'objective',
                            label: 'New objective',
                            x: 410,
                            y: 335,
                            stage: 1,
                          },
                          true,
                        )
                      }
                    >
                      + Objective
                    </button>
                    <button
                      className="button secondary small"
                      disabled={
                        busy ||
                        plan.routes.length >= 24 ||
                        plan.markers.length < 2 ||
                        !plan.markers.some((m) => m.kind === 'objective')
                      }
                      onClick={() => {
                        const to = plan.markers.find((m) => m.kind === 'objective')!;
                        const from = plan.markers.find((m) => m.id !== to.id)!;
                        select(
                          'route',
                          {
                            id: crypto.randomUUID(),
                            revision: 0,
                            label: 'New route',
                            owner: '',
                            from: from.id,
                            to: to.id,
                            via: [],
                            travel: '6',
                            setup: '0',
                            delay: '0',
                            after: [],
                          },
                          true,
                        );
                      }}
                    >
                      + Route
                    </button>
                  </div>
                )}
              </div>
              <aside className="board-inspector">
                <h3>
                  {history
                    ? 'Archived plan'
                    : draft
                      ? 'Edit the selected object'
                      : 'Your planning pieces'}
                </h3>
                {!history && draft ? (
                  <>
                    <fieldset disabled={busy}>
                      <ObjectEditor
                        draft={draft}
                        plan={plan}
                        names={book.members.map((m) => m.name)}
                        change={replaceDraft}
                      />
                      <div className="card-downloads">
                        <button className="button" disabled={!dirty} onClick={() => save()}>
                          Save object
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setDraft(null);
                            setDirty(false);
                            setError('');
                          }}
                        >
                          Load saved version
                        </button>
                      </div>
                      {draft.kind !== 'settings' && draft.base !== null && (
                        <button
                          className="text-button danger"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                'Remove this object? Connected routes must be removed or updated first.',
                              )
                            )
                              return;
                            const result = await act(
                              {
                                action: 'plan-edit',
                                kind: draft.kind,
                                id: draft.value.id,
                                revision: draft.base,
                                remove: true,
                              },
                              'Object removed.',
                            );
                            if (result) {
                              setDraft(null);
                              setDirty(false);
                            }
                          }}
                        >
                          Remove object
                        </button>
                      )}
                    </fieldset>
                  </>
                ) : (
                  <>
                    <p>Select a marker on the map, or choose an object here.</p>
                    {plan.markers.map((m) => (
                      <button
                        key={m.id}
                        className="board-object"
                        disabled={!!history || busy}
                        onClick={() => select('marker', m)}
                      >
                        <span>{m.kind === 'player' ? '▣' : '◆'}</span>
                        {m.label}
                        <small>{m.kind === 'objective' ? `Stage ${m.stage}` : 'Player'}</small>
                      </button>
                    ))}
                    {plan.routes.map((r) => (
                      <button
                        key={r.id}
                        className="board-object"
                        disabled={!!history || busy}
                        onClick={() => select('route', r)}
                      >
                        <span>↗</span>
                        {r.label}
                        <small>{r.owner || 'Unassigned'}</small>
                      </button>
                    ))}
                  </>
                )}
              </aside>
            </div>
            {timeline && (
              <section className="board-timing">
                <div className="planning-heading">
                  <h3>Saved schedule</h3>
                  <span className={`status ${timeline.feasible ? 'success' : 'draft'}`}>
                    {timeline.feasible
                      ? 'Meets modeled timing conditions'
                      : 'Plan needs another look'}
                  </span>
                </div>
                <p>
                  Stage window: every pair of ready times must be within {plan.settings.tolerance}{' '}
                  sec. Final deadline: {plan.settings.deadline} sec.
                </p>
                <div className="board-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Route / owner</th>
                        <th>Stage</th>
                        <th>Starts</th>
                        <th>Ready</th>
                        <th>Schedule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.results.map((r, i) => (
                        <tr key={r.route.id}>
                          <th>
                            <button
                              className="text-button"
                              disabled={busy || !!history}
                              onClick={() => select('route', r.route)}
                            >
                              {r.route.label}
                            </button>
                            <small>{r.route.owner || 'Unassigned'}</small>
                          </th>
                          <td>{r.stage}</td>
                          <td>{seconds(r.start)} s</td>
                          <td>{seconds(r.ready)} s</td>
                          <td>
                            <div className={`board-timeline color-${i % 4}`}>
                              <span
                                style={{
                                  left: `${(100 * r.start) / Math.max(1, timeline.finish)}%`,
                                  width: `${Math.max(0.5, (100 * (r.ready - r.start)) / Math.max(1, timeline.finish))}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="board-stage-results">
                  {timeline.stages.map((stage) => (
                    <p key={stage.stage}>
                      Stage {stage.stage}: <b>{seconds(stage.spread)} sec spread</b> ·{' '}
                      {stage.fits ? 'inside window' : 'outside window'}
                    </p>
                  ))}
                  <p>
                    Last route ready: <b>{seconds(timeline.finish)} sec</b> ·{' '}
                    {timeline.meetsDeadline ? 'before or at deadline' : 'misses deadline'}
                  </p>
                  {timeline.unassigned.length > 0 && (
                    <p>
                      Objectives without routes:{' '}
                      {timeline.unassigned.map((m) => m.label).join(', ')}
                    </p>
                  )}
                  {timeline.unmeasured.length > 0 && (
                    <p>
                      Timing estimates to recheck after a route change:{' '}
                      {timeline.unmeasured.map((r) => r.label).join(', ')}
                    </p>
                  )}
                </div>
                <p className="field-note">
                  This checks the supplied timing model. Your team checks whether paths,
                  measurements, role assignments, and game assumptions make sense.
                </p>
              </section>
            )}
            {plan.routes.length > 0 && (
              <section className="board-math">
                <span className="eyebrow">MAKE THE PLAN EXPLAIN ITSELF</span>
                <h3>Find every workable start delay.</h3>
                <label>
                  Investigate a route
                  <select
                    value={selectedRoute}
                    onChange={(e) => {
                      if (
                        answer.trim() &&
                        !window.confirm(
                          'Discard this unsaved timing answer before changing routes?',
                        )
                      )
                        return;
                      setSelectedRoute(e.target.value);
                      setAnswer('');
                    }}
                  >
                    {!plan.routes.some((r) => r.id === selectedRoute) && (
                      <option value="">Choose a route</option>
                    )}
                    {plan.routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                {question && (
                  <>
                    <div className="help-tabs" role="group" aria-label="Timing help mode">
                      {(['build', 'guide', 'notebook'] as const).map((mode) => (
                        <button
                          key={mode}
                          className={mathHelp === mode ? 'active' : ''}
                          onClick={() => setMathHelp(mode)}
                        >
                          {mode[0].toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                    {mathHelp === 'build' && (
                      <div className="timing-parts">
                        <span>Earlier stages: {question.base} s</span>
                        <span>+</span>
                        <span>Your start delay: s</span>
                        <span>+</span>
                        <span>Travel + setup</span>
                        <span>= ready time</span>
                        <p>
                          Readiness is s + {question.offset}. The absolute value measures the gap
                          from another route’s ready time.
                        </p>
                        <div
                          className="parts"
                          role="group"
                          aria-label="Build an interval with parts"
                        >
                          {[
                            's',
                            '<=',
                            '>=',
                            'and',
                            '0',
                            '1',
                            '2',
                            '3',
                            '4',
                            '5',
                            '6',
                            '7',
                            '8',
                            '9',
                          ].map((part) => (
                            <button
                              key={part}
                              className="button secondary small"
                              onClick={() =>
                                setAnswer(
                                  (a) =>
                                    `${a}${a && !(/\d$/.test(a) && /^\d$/.test(part)) ? ' ' : ''}${part}`,
                                )
                              }
                            >
                              {part}
                            </button>
                          ))}
                          <button className="text-button" onClick={() => setAnswer('')}>
                            Clear answer
                          </button>
                        </div>
                      </div>
                    )}
                    {mathHelp === 'guide' && (
                      <p>
                        Turn “within” into two bounds. Isolate s in each one, then intersect the
                        intervals with s ≥ 0 and the deadline.
                      </p>
                    )}
                    <div className="board-equations">
                      <MathLine text={question.equation} />
                      {question.constraints.map((c) => (
                        <MathLine key={c} text={c} />
                      ))}
                    </div>
                    <label>
                      Your complete interval
                      <input
                        value={answer}
                        maxLength={240}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Write bounds: s >= … and s <= …"
                      />
                    </label>
                    {answer.trim() && (
                      <p className={correct ? 'feedback-success' : 'feedback-error'} role="status">
                        {correct
                          ? 'Your interval matches all of these conditions.'
                          : submitted?.kind === 'unsupported' || solution?.kind === 'unsupported'
                            ? 'This notation is outside the checker’s supported subset.'
                            : 'Check both endpoints and every listed condition.'}
                      </p>
                    )}
                    <p className="field-note">
                      This holds the other saved arrivals fixed. Later stages may change when this
                      delay changes; save the new delay and check the whole schedule. This answer is
                      scratch work until you record it below or in the workbook.
                    </p>
                    <button
                      className="button secondary small"
                      disabled={!answer.trim() || !!history || busy}
                      onClick={() => {
                        setNote(
                          (n) =>
                            `${n}${n ? '\n' : ''}Timing check for ${plan.routes.find((r) => r.id === selectedRoute)?.label}: ${answer}. `,
                        );
                        setReviewBase(plan.revision);
                        setAnswer('');
                      }}
                    >
                      Carry answer into review notes ↓
                    </button>
                    {answer.trim() && (
                      <ProofPanel
                        before={question.equation}
                        after={answer}
                        constraints={question.constraints}
                      />
                    )}
                  </>
                )}
              </section>
            )}
            {!history && (
              <section className="board-review">
                <span className="eyebrow">ANOTHER PAIR OF EYES</span>
                <h3>Review this plan.</h3>
                <p>
                  Check the route assumptions, units, start cues, and every timing condition. A
                  review records your judgment about this plan; it does not certify a real-game
                  strategy.
                </p>
                <label>
                  Your reasoning
                  <textarea
                    rows={3}
                    maxLength={1500}
                    value={note}
                    onChange={(e) => {
                      if (!note) setReviewBase(plan.revision);
                      setNote(e.target.value);
                    }}
                    placeholder="I checked… The assumption I would test in a match is…"
                  />
                </label>
                {reviewBase !== null && reviewBase !== plan.revision && note && (
                  <p className="feedback-error">
                    The plan changed while you were writing. Recheck it, then use “Review current
                    plan” to attach this note to the new version.
                  </p>
                )}
                <div className="card-downloads">
                  {reviewBase !== null && reviewBase !== plan.revision && note && (
                    <button
                      className="button secondary"
                      onClick={() => setReviewBase(plan.revision)}
                    >
                      Review current plan
                    </button>
                  )}
                  {(['approve', 'changes'] as const).map((verdict) => (
                    <button
                      key={verdict}
                      className="button secondary"
                      disabled={
                        busy || dirty || note.trim().length < 12 || reviewBase !== plan.revision
                      }
                      onClick={async () => {
                        const result = await act(
                          { action: 'plan-review', revision: reviewBase, verdict, note },
                          'Review and exact plan snapshot saved.',
                        );
                        if (result) {
                          setNote('');
                          setReviewBase(null);
                        }
                      }}
                    >
                      {verdict === 'approve' ? 'Record review' : 'Request a revision'}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {reviews.length > 0 && (
              <details className="board-review-history">
                <summary>Review history · {reviews.length} saved snapshots</summary>
                {[...reviews].reverse().map((review) => (
                  <article key={review.id}>
                    <b>{review.author}</b> ·{' '}
                    {review.verdict === 'approve' ? 'reviewed' : 'requested changes'} · Plan{' '}
                    {review.revision}
                    {review.revision !== saved?.revision && <span> · earlier plan</span>}
                    <p>{review.note}</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          dirty &&
                          !window.confirm(
                            'Discard this unsaved object before opening the reviewed snapshot?',
                          )
                        )
                          return;
                        setDraft(null);
                        setDirty(false);
                        setHistory(review.plan);
                      }}
                    >
                      View the plan they reviewed →
                    </button>
                  </article>
                ))}
              </details>
            )}
            <p className="field-note">
              Friendly-unit SVG: Milsymbol, MIT.{' '}
              <a href="/maps/LICENSE.milsymbol.txt" target="_blank" rel="noreferrer">
                Artwork license ↗
              </a>
            </p>
          </>
        )}
        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="feedback-success" role="status">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
function ObjectEditor({
  draft,
  plan,
  names,
  change,
}: {
  draft: Draft;
  plan: Plan;
  names: string[];
  change: (value: PlanObject) => void;
}) {
  if (draft.kind === 'settings') {
    const s = draft.value as PlanSettings;
    return (
      <>
        <label>
          Operation title
          <input
            value={s.title}
            maxLength={100}
            onChange={(e) => change({ ...s, title: e.target.value })}
          />
        </label>
        <label>
          Maximum spread within each stage (seconds)
          <input
            value={s.tolerance}
            inputMode="decimal"
            onChange={(e) => change({ ...s, tolerance: e.target.value })}
          />
        </label>
        <label>
          Final deadline from shared zero (seconds)
          <input
            value={s.deadline}
            inputMode="decimal"
            onChange={(e) => change({ ...s, deadline: e.target.value })}
          />
        </label>
        <label>
          Briefing / measurement assumptions
          <textarea
            value={s.notes}
            maxLength={2000}
            rows={5}
            onChange={(e) => change({ ...s, notes: e.target.value })}
          />
        </label>
      </>
    );
  }
  if (draft.kind === 'marker') {
    const m = draft.value as PlanMarker;
    return (
      <>
        <label>
          Marker name
          <input
            value={m.label}
            maxLength={50}
            onChange={(e) => change({ ...m, label: e.target.value })}
          />
        </label>
        <div className="board-coordinate-fields">
          <label>
            X
            <input
              type="number"
              min={20}
              max={780}
              value={m.x}
              onChange={(e) => change({ ...m, x: Number(e.target.value) })}
            />
          </label>
          <label>
            Y
            <input
              type="number"
              min={30}
              max={475}
              value={m.y}
              onChange={(e) => change({ ...m, y: Number(e.target.value) })}
            />
          </label>
        </div>
        {m.kind === 'objective' && (
          <label>
            Objective stage
            <select
              value={m.stage}
              onChange={(e) => change({ ...m, stage: Number(e.target.value) })}
            >
              {[1, 2, 3, 4].map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
        )}
        <p className="field-note">
          Coordinates locate artwork; they do not measure game distance. Check connected route times
          after moving this marker.
        </p>
      </>
    );
  }
  const r = draft.value as PlanRoute;
  const stage = plan.markers.find((m) => m.id === r.to)?.stage || 1;
  return (
    <>
      <label>
        Route name
        <input
          value={r.label}
          maxLength={70}
          onChange={(e) => change({ ...r, label: e.target.value })}
        />
      </label>
      <label>
        Assigned to
        <input
          value={r.owner}
          maxLength={40}
          list="board-crew-names"
          placeholder="Choose a teammate or call sign"
          onChange={(e) => change({ ...r, owner: e.target.value })}
        />
        <datalist id="board-crew-names">
          {names.map((name, i) => (
            <option key={i} value={name} />
          ))}
        </datalist>
      </label>
      <label>
        Start marker
        <select value={r.from} onChange={(e) => change({ ...r, from: e.target.value })}>
          {plan.markers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Objective
        <select value={r.to} onChange={(e) => change({ ...r, to: e.target.value })}>
          {plan.markers
            .filter((m) => m.kind === 'objective')
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · Stage {m.stage}
              </option>
            ))}
        </select>
      </label>
      {(['travel', 'setup', 'delay'] as const).map((key) => (
        <label key={key}>
          {key === 'travel'
            ? 'Measured travel time'
            : key === 'setup'
              ? 'Setup after arrival'
              : 'Delay after prerequisites / shared zero'}{' '}
          (seconds)
          <input
            inputMode="decimal"
            value={r[key]}
            maxLength={8}
            onChange={(e) => change({ ...r, [key]: e.target.value })}
          />
        </label>
      ))}
      <p className="field-note">
        Seconds, up to three decimal places. A delay starts after all selected prerequisite routes
        are ready; with none selected, it starts at shared zero.
      </p>
      <fieldset className="board-dependencies">
        <legend>Timing assumptions and prerequisites</legend>
        <label>
          <input
            type="checkbox"
            checked={!r.needsMeasurement}
            onChange={(e) => change({ ...r, needsMeasurement: !e.target.checked })}
          />
          Travel/setup estimate checked for this saved sketch
        </label>
        {r.needsMeasurement && (
          <p className="field-note">
            The route changed. Measure or review its estimate, then check the box and save. This
            records your modeling assumption.
          </p>
        )}
        <p className="field-note">Wait for these earlier-stage routes:</p>
        {plan.routes
          .filter(
            (other) =>
              other.id !== r.id && plan.markers.find((m) => m.id === other.to)!.stage < stage,
          )
          .map((other) => (
            <label key={other.id}>
              <input
                type="checkbox"
                checked={r.after.includes(other.id)}
                onChange={(e) =>
                  change({
                    ...r,
                    after: e.target.checked
                      ? [...r.after, other.id]
                      : r.after.filter((id) => id !== other.id),
                  })
                }
              />
              {other.label}
            </label>
          ))}
        {r.after.some(
          (id) =>
            !plan.routes.some(
              (other) =>
                other.id === id && plan.markers.find((m) => m.id === other.to)!.stage < stage,
            ),
        ) && (
          <button className="text-button" onClick={() => change({ ...r, after: [] })}>
            Clear prerequisites from the old stage
          </button>
        )}
      </fieldset>
      <fieldset>
        <legend>Route waypoints (diagram coordinates)</legend>
        {r.via.map((p, i) => (
          <div className="board-waypoint" key={i}>
            <label>
              X {i + 1}
              <input
                type="number"
                min={20}
                max={780}
                value={p.x}
                onChange={(e) =>
                  change({
                    ...r,
                    via: r.via.map((v, n) => (n === i ? { ...v, x: Number(e.target.value) } : v)),
                  })
                }
              />
            </label>
            <label>
              Y {i + 1}
              <input
                type="number"
                min={30}
                max={475}
                value={p.y}
                onChange={(e) =>
                  change({
                    ...r,
                    via: r.via.map((v, n) => (n === i ? { ...v, y: Number(e.target.value) } : v)),
                  })
                }
              />
            </label>
            <button
              className="icon-button"
              aria-label={`Remove waypoint ${i + 1}`}
              onClick={() => change({ ...r, via: r.via.filter((_, n) => n !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="text-button"
          disabled={r.via.length >= 8}
          onClick={() => change({ ...r, via: [...r.via, { x: 400, y: 330 }] })}
        >
          + Waypoint
        </button>
      </fieldset>
    </>
  );
}
