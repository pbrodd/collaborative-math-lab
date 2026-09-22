'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SiegeBriefing } from './SiegeBriefing';
import { EquationEditor } from './EquationEditor';
import { MathLine } from './MathDisplay';
import { emptyWork, emptyEntry, type Work } from '../../lib/missions';
import { assessTask, resolveTask, starterScenario } from '../../lib/model';
import { siegeSignals } from '../../lib/siege-briefing';
import { outputExpression } from '../../lib/model';

const scenario = starterScenario('siege');
const tasks = scenario.tasks.filter((task) => task.kind === 'role');
const supplied = Object.fromEntries(scenario.data.map((datum) => [datum.key, datum.value]));

export function SiegePreview() {
  const [values, setValues] = useState<Record<string, string>>(supplied);
  const [selected, setSelected] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Work>>({});
  const [message, setMessage] = useState('');
  const definition = tasks[selected];
  const task = resolveTask(definition, values);
  const work = drafts[task.id] ?? emptyWork();
  const assessment = assessTask(task, work);
  const current = work.steps.at(-1)?.equation || task.equation;
  const published = tasks.filter((item) => values[item.output] !== undefined).length;
  const edit = (patch: Partial<Work>) => {
    setDrafts((previous) => ({
      ...previous,
      [task.id]: { ...(previous[task.id] ?? emptyWork()), ...patch },
    }));
    setMessage('');
  };
  return (
    <main className="siege-preview siege-world">
      <header className="siege-preview-header">
        <Link href="/" className="siege-preview-brand">
          u<span>·</span> / FIELD OPERATIONS
        </Link>
        <span>
          PLAYABLE PREVIEW <i /> PROGRESS RESETS ON RELOAD
        </span>
        <Link href="/" className="siege-small-button">
          Sign in for saved missions ↗
        </Link>
      </header>
      <SiegeBriefing
        title="Every second counts"
        signals={siegeSignals(values)}
        published={published}
        total={tasks.length}
      />
      <section className="siege-preview-workspace" id="siege-workspace">
        <nav className="siege-preview-tasks" aria-label="Preview mission tasks">
          <span className="siege-kicker">INTELLIGENCE CHAIN</span>
          {tasks.map((item, index) => (
            <button
              key={item.id}
              aria-pressed={selected === index}
              onClick={() => {
                setSelected(index);
                setMessage('');
              }}
            >
              <span>{values[item.output] !== undefined ? '✓' : `0${index + 1}`}</span>
              <div>
                <b>{item.role}</b>
                <small>
                  {values[item.output] !== undefined
                    ? 'FINDING TRANSMITTED'
                    : 'AWAITING YOUR FINDING'}
                </small>
              </div>
              <span>↗</span>
            </button>
          ))}
          <p>
            Find the missing intel. Transmit each result. Then test your timing in the tactical
            rehearsal above.
          </p>
          <Link href="/">Open the full workbook experience ↗</Link>
        </nav>
        <div className="solver-main siege-preview-console">
          <div className="task-heading">
            <div>
              <span className="siege-kicker">
                INTEL 0{selected + 1} / {task.role.toUpperCase()}
              </span>
              <h1>{task.title}</h1>
            </div>
            <span className="status">PRACTICE</span>
          </div>
          <p className="task-intro">{task.intro}</p>
          <section className="equation-stage">
            <span className="eyebrow">DECODE THE RELATIONSHIP</span>
            <MathLine text={task.equation} />
          </section>
          <div className="work-toolbar">
            <h2>Your working</h2>
            <div className="segmented" aria-label="Help level">
              {(['build', 'guide', 'notebook'] as const).map((mode) => (
                <button key={mode} aria-pressed={work.mode === mode} onClick={() => edit({ mode })}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {work.steps.map((step, index) => (
            <div
              className={`work-step ${assessment.checks[index]?.valid ? 'valid' : 'invalid'}`}
              key={index}
            >
              <span className="step-index">0{index + 1}</span>
              <div>
                <MathLine text={step.equation} />
                <p>{step.reason}</p>
                {!assessment.checks[index]?.valid && (
                  <p className="feedback-error">{assessment.checks[index]?.message}</p>
                )}
              </div>
            </div>
          ))}
          <EquationEditor
            key={`${task.id}:${current}`}
            current={current}
            mode={work.mode}
            entry={work.entry ?? emptyEntry()}
            onEntry={(entry) => edit({ entry })}
            onAppend={(equation, reason) => {
              if (work.steps.length >= 30) {
                setMessage('Undo a step to keep this rehearsal within 30 steps.');
                return;
              }
              edit({ steps: [...work.steps, { equation, reason }], entry: emptyEntry() });
            }}
            disabled={false}
          />
          {work.steps.length > 0 && (
            <button
              className="text-button"
              onClick={() => edit({ steps: work.steps.slice(0, -1) })}
            >
              Undo last step
            </button>
          )}
          <label className="explanation-label">
            Tell command what your result means.
            <textarea
              rows={2}
              maxLength={3000}
              value={work.explanation}
              onChange={(event) => edit({ explanation: event.target.value })}
              placeholder="My result is… seconds because…"
            />
          </label>
          <div className="siege-preview-transmit">
            <button
              className="siege-launch"
              onClick={() => {
                if (!assessment.checked) {
                  setMessage(assessment.message);
                  return;
                }
                const output = outputExpression(work.steps.at(-1)?.equation || '', task.variable);
                if (output === null) {
                  setMessage('Isolate the requested quantity before transmitting.');
                  return;
                }
                setValues({ ...values, [task.output]: output });
                setMessage(
                  published === tasks.length - 1 && values[task.output] === undefined
                    ? 'All signals received. Open Tactical rehearsal above and try a start delay.'
                    : 'Signal received. Your mission readout has updated.',
                );
              }}
            >
              Transmit finding <span>↗</span>
            </button>
            <small>Uses the same algebra checks as your workbook.</small>
          </div>
          {message && (
            <p className="siege-preview-message" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
      <footer className="siege-preview-footer">
        <span>YOUR TEAM. YOUR PLAN.</span>
        <p>Original tactical artwork · supplied practice data</p>
        <Link href="/verification">Inspect the math checks ↗</Link>
      </footer>
    </main>
  );
}
