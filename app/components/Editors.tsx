'use client';
import { useState } from 'react';
import { analyze, numberValue } from '../../lib/algebra';
import {
  auditScenario,
  blankTask,
  resolveTask,
  scenarioValues,
  type Book,
  type Cell,
  type Document,
  type Notebook,
  type Scenario,
  type ScenarioTask,
} from '../../lib/model';
import { Graph } from './Graph';
import { ProofPanel } from './ProofPanel';
import { MathLine } from './MathDisplay';
import type { Mutation } from './Solver';
export function DocumentEditor({
  book,
  mutate,
  onDirty,
  onTest,
}: {
  book: Book;
  mutate: Mutation;
  onDirty: (v: boolean) => void;
  onTest: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ document: Document; title: string; base: number } | null>(
    null,
  );
  const document = draft?.document ?? book.document;
  const title = draft?.title ?? book.title;
  const base = draft?.base ?? book.revision;
  const dirty = draft !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function edit(next: Document) {
    setDraft({ document: next, title, base });
    onDirty(true);
    setMessage('');
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await mutate({ action: 'document', document, title, revision: base });
      setDraft(null);
      onDirty(false);
      setMessage('Saved for the whole crew.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`document-layout ${document.appearance === 'briefing' ? 'briefing-workbook' : ''}`}
    >
      <div className="document-title">
        <div>
          <span className="eyebrow">
            {book.kind === 'notebook' ? 'AN OPEN NOTEBOOK' : 'SCENARIO STUDIO'} · BY{' '}
            {book.creator.toUpperCase()}
          </span>
          <input
            className="title-input"
            aria-label="Workbook title"
            value={title}
            maxLength={100}
            onChange={(e) => {
              setDraft({ document, title: e.target.value, base });
              onDirty(true);
            }}
          />
        </div>
        <div className="document-actions">
          <label className="workbook-appearance">
            Workbook style
            <select
              value={document.appearance || 'paper'}
              onChange={(e) =>
                edit({ ...document, appearance: e.target.value as 'paper' | 'briefing' })
              }
            >
              <option value="paper">Paper notebook</option>
              <option value="briefing">Mission briefing</option>
            </select>
          </label>
          <span className={`status ${dirty ? 'draft' : ''}`}>
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <button className="button" disabled={busy || !dirty} onClick={save}>
            {busy ? 'Saving…' : 'Save workbook'}
          </button>
          {document.type === 'scenario' && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (!dirty || (await save())) await onTest();
              }}
            >
              Test-play ↗
            </button>
          )}
        </div>
      </div>
      <div className="collab-strip">
        <div className="mini-avatars">
          {book.members.map((m) => (
            <span title={m.name} className="avatar small-avatar" key={m.id}>
              {m.name[0].toUpperCase()}
            </span>
          ))}
        </div>
        <span>
          {book.members.length === 1
            ? 'Your space to follow a question. Invite the crew whenever you like.'
            : `${book.members.length} collaborators can edit this workbook. Saved changes appear for everyone.`}
        </span>
      </div>
      {book.revision !== base && dirty && (
        <div className="notice">
          A teammate saved a newer version. Your draft is still here.{' '}
          <button
            className="text-button"
            onClick={() => {
              if (window.confirm('Replace your unsaved draft with the shared version?')) {
                setDraft(null);
                onDirty(false);
              }
            }}
          >
            Load shared version
          </button>
        </div>
      )}
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
      {document.type === 'notebook' ? (
        <NotebookEditor document={document} onChange={edit} />
      ) : (
        <ScenarioEditor document={document} onChange={edit} />
      )}
    </div>
  );
}
function NotebookEditor({
  document,
  onChange,
}: {
  document: Notebook;
  onChange: (d: Notebook) => void;
}) {
  const update = (id: string, patch: Partial<Cell>) =>
    onChange({
      ...document,
      cells: document.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  const add = (type: Cell['type']) =>
    onChange({
      ...document,
      cells: [
        ...document.cells,
        {
          id: crypto.randomUUID(),
          type,
          text: '',
          expression: type === 'graph' ? 'y = |x - 4|' : '',
          min: -10,
          max: 10,
        },
      ],
    });
  const move = (index: number, direction: number) => {
    const cells = [...document.cells];
    const target = index + direction;
    if (target < 0 || target >= cells.length) return;
    [cells[index], cells[target]] = [cells[target], cells[index]];
    onChange({ ...document, cells });
  };
  return (
    <div className="notebook-paper">
      <p className="notebook-opening">
        A question, a calculation, a wild hypothesis. You don’t need the ending to start.
      </p>
      {document.cells.map((cell, index) => (
        <article className="notebook-cell" key={cell.id}>
          <div className="cell-top">
            <span className="eyebrow">
              {String(index + 1).padStart(2, '0')} /{' '}
              {cell.type === 'idea' ? 'NOTES & IDEAS' : cell.type.toUpperCase()}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Move cell up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                className="icon-button"
                aria-label="Move cell down"
                disabled={index === document.cells.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                className="icon-button"
                aria-label="Delete cell"
                onClick={() => {
                  if ((cell.text || cell.expression) && !window.confirm('Remove this cell?'))
                    return;
                  onChange({ ...document, cells: document.cells.filter((c) => c.id !== cell.id) });
                }}
              >
                ×
              </button>
            </div>
          </div>
          <textarea
            aria-label={`${cell.type} notes`}
            className={`cell-text ${cell.type === 'question' ? 'question-text' : ''}`}
            value={cell.text}
            rows={cell.type === 'question' ? 2 : 3}
            onChange={(e) => update(cell.id, { text: e.target.value })}
            placeholder={
              cell.type === 'question'
                ? 'What are you curious about?'
                : cell.type === 'idea'
                  ? 'Try an idea. Record an observation. Leave a question for later.'
                  : 'What are you investigating? What did you notice?'
            }
          />
          {(cell.type === 'calculation' || cell.type === 'graph') && (
            <label className="expression-label">
              {cell.type === 'graph' ? 'Graph expression' : 'Expression or equation'}
              <input
                className="math-input"
                value={cell.expression}
                onChange={(e) => update(cell.id, { expression: e.target.value })}
                placeholder={cell.type === 'graph' ? 'y = |x - 4|' : '3(x - 2) = 15'}
              />
            </label>
          )}
          {cell.type === 'calculation' && cell.expression && (
            <Calculation expression={cell.expression} />
          )}
          {cell.type === 'graph' && (
            <>
              <div className="graph-range">
                <label>
                  x minimum
                  <input
                    type="number"
                    value={cell.min ?? -10}
                    onChange={(e) => update(cell.id, { min: +e.target.value })}
                  />
                </label>
                <label>
                  x maximum
                  <input
                    type="number"
                    value={cell.max ?? 10}
                    onChange={(e) => update(cell.id, { max: +e.target.value })}
                  />
                </label>
              </div>
              <Graph expression={cell.expression} min={cell.min} max={cell.max} />
            </>
          )}
        </article>
      ))}
      <div className="add-cell">
        <span>Add to your thinking</span>
        {(['question', 'idea', 'calculation', 'graph'] as Cell['type'][]).map((type) => (
          <button
            className="button secondary small"
            key={type}
            disabled={document.cells.length >= 80}
            onClick={() => add(type)}
          >
            + {type === 'idea' ? 'Notes' : type[0].toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
function Calculation({ expression }: { expression: string }) {
  let result = '';
  try {
    result = /[=<>≤≥]/.test(expression)
      ? analyze(expression).description
      : `= ${numberValue(expression)}`;
  } catch (e) {
    result = e instanceof Error ? e.message : 'Check the expression.';
  }
  return (
    <div>
      <MathLine text={expression} />
      <output className="calculation-output">{result}</output>
    </div>
  );
}
function ScenarioEditor({
  document,
  onChange,
}: {
  document: Scenario;
  onChange: (d: Scenario) => void;
}) {
  const [tab, setTab] = useState<'story' | 'roles' | 'audit'>('story');
  const [selected, setSelected] = useState(document.tasks[0].id);
  const task = document.tasks.find((t) => t.id === selected) || document.tasks[0];
  const editTask = (patch: Partial<ScenarioTask>) =>
    onChange({
      ...document,
      tasks: document.tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
    });
  const audits = auditScenario(document);
  return (
    <>
      <div className="editor-tabs" role="tablist" aria-label="Scenario editing sections">
        {(
          [
            { id: 'story', label: '01  Story & data' },
            { id: 'roles', label: '02  Roles & questions' },
            { id: 'audit', label: '03  Check the puzzle' },
          ] as const
        ).map((t) => (
          <button role="tab" aria-selected={tab === t.id} key={t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'story' && (
        <div className="author-story">
          <div className="author-main">
            <h2>Give the team something to figure out.</h2>
            <label>
              The story
              <textarea
                rows={4}
                value={document.story}
                onChange={(e) => onChange({ ...document, story: e.target.value })}
                placeholder="Who are we? What are we trying to discover? Why does it matter?"
              />
            </label>
            <label>
              Supplied information & assumptions
              <textarea
                rows={4}
                value={document.information}
                onChange={(e) => onChange({ ...document, information: e.target.value })}
                placeholder="What does everyone know? Which rules are real, simplified, or invented?"
              />
            </label>
            <label>
              Starting world
              <select
                value={document.theme}
                onChange={(e) =>
                  onChange({ ...document, theme: e.target.value as Scenario['theme'] })
                }
              >
                <option value="original">Our own world</option>
                <option value="brawl">Brawl Stars-inspired</option>
                <option value="siege">Siege-inspired</option>
              </select>
            </label>
          </div>
          <aside className="author-tip">
            <span className="mini-symbol">✦</span>
            <h3>You’re the author.</h3>
            <p>
              Change the story, invent new rules, leave a mystery. Make the information clear enough
              that another team can test an idea.
            </p>
            <p>Multiple answers and impossible conditions can be part of a good puzzle.</p>
          </aside>
          <div className="data-editor">
            <div className="section-title">
              <h2>Numbers the team can use</h2>
              <p>
                Give a number a key, then insert it into a question with double braces:{' '}
                <code>{'{{health}}'}</code>.
              </p>
            </div>
            {document.data.map((d, i) => (
              <div className="data-row" key={i}>
                <label>
                  Key
                  <input
                    value={d.key}
                    placeholder="health"
                    onChange={(e) =>
                      onChange({
                        ...document,
                        data: document.data.map((x, j) =>
                          j === i ? { ...x, key: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Value
                  <input
                    value={d.value}
                    placeholder="6000"
                    onChange={(e) =>
                      onChange({
                        ...document,
                        data: document.data.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Units
                  <input
                    value={d.unit}
                    placeholder="HP"
                    onChange={(e) =>
                      onChange({
                        ...document,
                        data: document.data.map((x, j) =>
                          j === i ? { ...x, unit: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="Remove data item"
                  onClick={() =>
                    onChange({ ...document, data: document.data.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="button secondary small"
              onClick={() =>
                onChange({
                  ...document,
                  data: [
                    ...document.data,
                    { key: `value_${document.data.length + 1}`, value: '', unit: '' },
                  ],
                })
              }
            >
              + Add supplied data
            </button>
          </div>
        </div>
      )}
      {tab === 'roles' && (
        <div className="role-editor">
          <aside className="role-list">
            {document.tasks.map((t, i) => (
              <button
                className={task.id === t.id ? 'active' : ''}
                key={t.id}
                onClick={() => setSelected(t.id)}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <b>{t.role}</b>
                <small>
                  {t.kind === 'team'
                    ? 'Shared challenge'
                    : t.kind === 'transfer'
                      ? 'Independent check'
                      : 'Team role'}
                </small>
              </button>
            ))}
            <button
              className="button secondary small"
              disabled={document.tasks.length >= 16}
              onClick={() => {
                const next = blankTask(document.tasks.length + 1);
                next.output = `result_${next.id.slice(0, 6)}`;
                onChange({ ...document, tasks: [...document.tasks, next] });
                setSelected(next.id);
              }}
            >
              + Add role or challenge
            </button>
          </aside>
          <div className="role-form">
            <div className="two-fields">
              <label>
                Role name
                <input value={task.role} onChange={(e) => editTask({ role: e.target.value })} />
              </label>
              <label>
                Task type
                <select
                  value={task.kind}
                  onChange={(e) => editTask({ kind: e.target.value as ScenarioTask['kind'] })}
                >
                  <option value="role">Role subproblem</option>
                  <option value="team">Shared team challenge</option>
                  <option value="transfer">Individual transfer check</option>
                </select>
              </label>
            </div>
            <label>
              Question title
              <input value={task.title} onChange={(e) => editTask({ title: e.target.value })} />
            </label>
            <label>
              Information and question
              <textarea
                rows={3}
                value={task.intro}
                onChange={(e) => editTask({ intro: e.target.value })}
                placeholder="Give this role its evidence and a question to answer."
              />
            </label>
            <BackwardBuilder
              onApply={(equation, intended, intent) =>
                editTask({ equation, intended, intent, variable: 'x' })
              }
            />
            <label>
              Starting equation or inequality <span>optional for an open investigation</span>
              <input
                className="math-input"
                value={task.equation}
                onChange={(e) => editTask({ equation: e.target.value })}
                placeholder="3(x - 2) = 15"
              />
            </label>
            <div className="parts">
              {[
                ...document.data.map((d) => d.key),
                ...document.tasks.filter((t) => t.id !== task.id && t.output).map((t) => t.output),
              ].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    const upstream = document.tasks.find((t) => t.output === key);
                    editTask({
                      equation: task.equation + `{{${key}}}`,
                      dependencies:
                        upstream && !task.dependencies.includes(upstream.id)
                          ? [...task.dependencies, upstream.id]
                          : task.dependencies,
                    });
                  }}
                >{`{{${key}}}`}</button>
              ))}
            </div>
            <div className="two-fields">
              <label>
                Variable to isolate
                <input
                  value={task.variable}
                  maxLength={1}
                  onChange={(e) => editTask({ variable: e.target.value.toLowerCase() })}
                />
              </label>
              <label>
                Units of the result
                <input
                  value={task.unit}
                  placeholder="seconds"
                  onChange={(e) => editTask({ unit: e.target.value })}
                />
              </label>
            </div>
            <label>
              Additional constraints <span>one equation or inequality per line</span>
              <textarea
                className="math-input"
                rows={2}
                value={task.constraints.join('\n')}
                onChange={(e) => editTask({ constraints: e.target.value.split('\n') })}
                placeholder={'x >= 0\nx <= 10'}
              />
            </label>
            <div className="connections">
              <h3>Connect this finding to the team</h3>
              <label>
                Publish the result under this name
                <input
                  value={task.output}
                  placeholder="travel_time"
                  onChange={(e) => editTask({ output: e.target.value })}
                />
              </label>
              <p>
                A single isolated result can become an input such as{' '}
                <code>{`{{${task.output || 'travel_time'}}}`}</code> in a later task.
              </p>
              <fieldset>
                <legend>This task uses findings from</legend>
                {document.tasks
                  .filter((t) => t.id !== task.id && t.kind !== 'transfer')
                  .map((t) => (
                    <label className="check-label" key={t.id}>
                      <input
                        type="checkbox"
                        checked={task.dependencies.includes(t.id)}
                        onChange={(e) =>
                          editTask({
                            dependencies: e.target.checked
                              ? [...task.dependencies, t.id]
                              : task.dependencies.filter((id) => id !== t.id),
                          })
                        }
                      />
                      {t.role}
                    </label>
                  ))}
              </fieldset>
            </div>
            <details className="author-details" open>
              <summary>Hints and intended solutions · hidden in solver mode</summary>
              {[0, 1, 2].map((i) => (
                <label key={i}>
                  Hint {i + 1}
                  <textarea
                    rows={2}
                    value={task.hints[i] || ''}
                    onChange={(e) => {
                      const hints = [...task.hints];
                      hints[i] = e.target.value;
                      editTask({ hints });
                    }}
                    placeholder={
                      i === 0
                        ? 'A question that gets them thinking'
                        : i === 1
                          ? 'A structural clue'
                          : 'A more explicit next step'
                    }
                  />
                </label>
              ))}
              <label>
                Intended solution
                <input
                  className="math-input"
                  value={task.intended}
                  onChange={(e) => editTask({ intended: e.target.value })}
                  placeholder="x = 1 or x = 7"
                />
              </label>
              <label>
                What kind of puzzle do you intend?
                <select
                  value={task.intent}
                  onChange={(e) => editTask({ intent: e.target.value as ScenarioTask['intent'] })}
                >
                  <option value="unique">One solution</option>
                  <option value="multiple">Multiple solutions or a region</option>
                  <option value="none">No solution, intentionally</option>
                  <option value="open">Open investigation / not decided</option>
                </select>
              </label>
              <label>
                What might students discover?
                <textarea
                  rows={2}
                  value={task.takeaway}
                  onChange={(e) => editTask({ takeaway: e.target.value })}
                />
              </label>
              {task.answers.map((a, i) => (
                <div className="extra-answer" key={a.key}>
                  <label>
                    Final decision question
                    <input
                      value={a.label}
                      onChange={(e) =>
                        editTask({
                          answers: task.answers.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Expected answer or formula
                    <input
                      value={task.answerExpressions?.[a.key] ?? String(a.expected)}
                      onChange={(e) =>
                        editTask({
                          answerExpressions: { ...task.answerExpressions, [a.key]: e.target.value },
                        })
                      }
                    />
                  </label>
                  <button
                    className="text-button"
                    onClick={() => editTask({ answers: task.answers.filter((_, j) => j !== i) })}
                  >
                    Remove decision field
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                disabled={task.answers.length >= 5}
                onClick={() =>
                  editTask({
                    answers: [
                      ...task.answers,
                      {
                        key: `answer_${crypto.randomUUID().slice(0, 6)}`,
                        label: 'Final decision',
                        unit: '',
                        expected: 0,
                      },
                    ],
                  })
                }
              >
                + Add a final decision field
              </button>
            </details>
            {document.tasks.length > 1 && (
              <button
                className="text-button danger"
                onClick={() => {
                  if (!window.confirm('Remove this role and its connections?')) return;
                  onChange({
                    ...document,
                    tasks: document.tasks
                      .filter((t) => t.id !== task.id)
                      .map((t) => ({
                        ...t,
                        dependencies: t.dependencies.filter((id) => id !== task.id),
                      })),
                  });
                  setSelected(document.tasks.find((t) => t.id !== task.id)!.id);
                }}
              >
                Remove this task
              </button>
            )}
          </div>
        </div>
      )}
      {tab === 'audit' && (
        <div className="audit-pane">
          <h2>Does the puzzle do what you intend?</h2>
          <p>
            The check uses supplied data and your intended role outputs. Test-play creates a
            separate solver workbook, with the answer key hidden.
          </p>
          {audits.map((a) => {
            const task = document.tasks.find((t) => t.id === a.id)!;
            const resolved = resolveTask(task, scenarioValues(document, [], true));
            const mismatch =
              a.kind !== 'literal' &&
              ((task.intent === 'unique' && a.count !== 1) ||
                (task.intent === 'none' && a.count !== 0) ||
                (task.intent === 'multiple' && a.count !== null && (a.count ?? 0) < 2));
            return (
              <article className="audit-card" key={a.id}>
                <div>
                  <span className="eyebrow">{task.role}</span>
                  <span
                    className={`status ${a.kind === 'unsupported' || mismatch ? 'draft' : 'success'}`}
                  >
                    {a.kind === 'points'
                      ? a.count === 1
                        ? 'One solution'
                        : 'Multiple solutions'
                      : a.kind === 'none'
                        ? 'No solution'
                        : a.kind === 'interval'
                          ? 'Solution region'
                          : a.kind === 'open'
                            ? 'Open question'
                            : a.kind === 'literal'
                              ? 'Literal formula'
                              : 'Needs a look'}
                  </span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                {resolved.equation && resolved.intended && (
                  <ProofPanel
                    before={resolved.equation}
                    after={resolved.intended}
                    constraints={resolved.constraints}
                  />
                )}
                {mismatch && (
                  <p className="feedback-error">
                    This differs from the puzzle type you selected. Revise the problem or change
                    your intention.
                  </p>
                )}
                {a.intended && !a.intended.valid && (
                  <p className="feedback-error">
                    Your intended solution does not match the starting relationship.{' '}
                    {a.intended.message}
                  </p>
                )}
                {task.dependencies.length > 0 && (
                  <p className="field-note">
                    Connects:{' '}
                    {task.dependencies
                      .map((id) => document.tasks.find((t) => t.id === id)?.role)
                      .join(' → ')}{' '}
                    → {task.role}
                  </p>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setSelected(a.id);
                    setTab('roles');
                  }}
                >
                  Edit this question →
                </button>
              </article>
            );
          })}
          <p className="field-note">
            This checker covers linear algebra and simple absolute values with constant
            denominators. It does not grade a story’s realism or the quality of a written
            explanation. That’s a job for the crew.
          </p>
        </div>
      )}
    </>
  );
}
function BackwardBuilder({
  onApply,
}: {
  onApply: (equation: string, intended: string, intent: ScenarioTask['intent']) => void;
}) {
  const [mode, setMode] = useState('linear');
  const [answer, setAnswer] = useState('7');
  const [second, setSecond] = useState('1');
  const [factor, setFactor] = useState('3');
  const [offset, setOffset] = useState('2');
  const [error, setError] = useState('');
  return (
    <details className="backward-builder">
      <summary>✧ Start with the answer</summary>
      <p>Choose the destination, then build a relationship that leads there.</p>
      <label>
        Problem type
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="linear">Linear equation</option>
          <option value="absolute">Absolute-value distance</option>
        </select>
      </label>
      <div className="two-fields">
        <label>
          First answer x<input value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
        {mode === 'absolute' ? (
          <label>
            Second answer x<input value={second} onChange={(e) => setSecond(e.target.value)} />
          </label>
        ) : (
          <>
            <label>
              Multiply x by
              <input value={factor} onChange={(e) => setFactor(e.target.value)} />
            </label>
            <label>
              Then add
              <input value={offset} onChange={(e) => setOffset(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <button
        className="button secondary small"
        onClick={() => {
          try {
            const a = numberValue(answer);
            if (!Number.isFinite(a)) throw new Error('Use a finite answer.');
            if (mode === 'absolute') {
              const b = numberValue(second);
              if (!Number.isFinite(b)) throw new Error('Use a finite second answer.');
              const center = (a + b) / 2,
                distance = Math.abs(a - b) / 2;
              onApply(
                `|x - (${center})| = ${distance}`,
                a === b ? `x = ${a}` : `x = ${Math.min(a, b)} or x = ${Math.max(a, b)}`,
                a === b ? 'unique' : 'multiple',
              );
            } else {
              const f = numberValue(factor),
                o = numberValue(offset);
              if (!f || !Number.isFinite(f) || !Number.isFinite(o))
                throw new Error('Use a finite, nonzero multiplier and a finite offset.');
              onApply(`${f}x + (${o}) = ${f * a + o}`, `x = ${a}`, 'unique');
            }
            setError('');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Check the numbers.');
          }
        }}
      >
        Build this problem →
      </button>
      {error && <p className="feedback-error">{error}</p>}
    </details>
  );
}
