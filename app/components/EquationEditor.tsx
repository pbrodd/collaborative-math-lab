'use client';
import { useEffect, useRef, useState } from 'react';
import {
  branches,
  relations,
  terms,
  choices,
  previewMove,
  type Move,
  type MovePreview,
  type Target,
} from '../../lib/algebra-moves';
import { fromLatex, toLatex, written } from '../../lib/math-notation';
import type { HelpMode, MathEntry } from '../../lib/missions';
import { MathInput } from './MathInput';
import { MathLine, MathText } from './MathDisplay';

export function EquationEditor({
  current,
  mode,
  entry,
  onEntry,
  onAppend,
  disabled,
}: {
  current: string;
  mode: HelpMode;
  entry: MathEntry;
  onEntry: (entry: MathEntry) => void;
  onAppend: (equation: string, reason: string) => void;
  disabled: boolean;
}) {
  const [scope, setScope] = useState<number | 'all'>('all');
  const [selection, setSelection] = useState<{
    branch: number;
    target: Target;
    options: ReturnType<typeof choices>;
  } | null>(null);
  const [preview, setPreview] = useState<{
    result: MovePreview;
    operation: string;
    amount: string;
    scope: number | 'all';
  } | null>(null);
  const [error, setError] = useState('');
  const previewPanel = useRef<HTMLElement>(null);
  const parts = branches(current);
  const operation = entry.operation as Move;
  const needsAmount = ['add', 'subtract', 'multiply', 'divide'].includes(operation);
  const visiblePreview =
    preview &&
    preview.operation === operation &&
    preview.amount === entry.amount &&
    preview.scope === scope
      ? preview.result
      : null;
  useEffect(() => {
    if (!visiblePreview) return;
    previewPanel.current?.focus({ preventScroll: true });
    previewPanel.current?.scrollIntoView({ block: 'nearest' });
  }, [visiblePreview]);
  const update = (patch: Partial<MathEntry>) => {
    onEntry({ ...entry, ...patch });
    setError('');
    setPreview(null);
  };
  const propose = (move = operation, amount = entry.amount, branch = scope, target?: Target) => {
    setError('');
    try {
      const result = previewMove(
        current,
        move,
        ['add', 'subtract', 'multiply', 'divide'].includes(move) ? fromLatex(amount) : '',
        branch,
        target,
      );
      setPreview({ result, operation: move, amount, scope: branch });
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Check this move.');
    }
  };
  const addTyped = (latex = entry.latex) => {
    setError('');
    try {
      onAppend(fromLatex(latex), entry.reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check the equation.');
    }
  };
  return (
    <div className="step-builder equation-editor">
      {mode === 'build' ? (
        <>
          <p className="builder-label">Tap a term to choose a move, or use the controls below.</p>
          <div className="equation-selection" aria-label="Choose a term in the current equation">
            {parts.map((part, branch) => {
              try {
                return (
                  <div className="selectable-case" key={branch}>
                    {parts.length > 1 && (
                      <small>
                        CASE {branch + 1}
                        {branch ? ' · OR' : ''}
                      </small>
                    )}
                    {relations(part).map((relation, clause) => (
                      <div key={clause} className="selectable-relation">
                        {clause > 0 && <small>AND</small>}
                        {(['left', 'right'] as const).map((side) => (
                          <div key={side} className="selectable-side">
                            {side === 'right' && (
                              <span className="relation-sign">
                                {relation.op.replace('<=', '≤').replace('>=', '≥')}
                              </span>
                            )}
                            {terms(relation[side]).map((term, i) => {
                              const text = written(term);
                              return (
                                <button
                                  type="button"
                                  key={i}
                                  className="equation-term"
                                  disabled={disabled}
                                  aria-label={`Select ${text} on the ${side} of case ${branch + 1}`}
                                  aria-pressed={
                                    selection?.branch === branch &&
                                    selection.target.clause === clause &&
                                    selection.target.side === side &&
                                    selection.target.term === i
                                  }
                                  onClick={() => {
                                    try {
                                      setSelection({
                                        branch,
                                        target: { clause, side, term: i },
                                        options: choices(term),
                                      });
                                      setScope(parts.length > 1 ? branch : 'all');
                                      setPreview(null);
                                      setError('');
                                    } catch (e) {
                                      setError(
                                        e instanceof Error ? e.message : 'Choose another term.',
                                      );
                                    }
                                  }}
                                >
                                  {i > 0 && !text.startsWith('-') && (
                                    <span aria-hidden="true">+ </span>
                                  )}
                                  <MathText text={text} />
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              } catch {
                return <MathLine key={branch} text={part} />;
              }
            })}
          </div>
          {selection && (
            <div className="term-actions" role="group" aria-label="Moves for the selected term">
              {selection.options.map((option) => (
                <button
                  type="button"
                  className="button secondary small"
                  key={option.label}
                  disabled={disabled}
                  onClick={() => {
                    const amount = option.amount ? toLatex(option.amount) : '';
                    onEntry({ ...entry, operation: option.operation, amount });
                    propose(
                      option.operation,
                      amount,
                      scope,
                      option.operation === 'distribute' ? selection.target : undefined,
                    );
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {parts.length > 1 && (
            <label>
              Apply the move to
              <select
                aria-label="Cases to change"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setSelection(null);
                  setPreview(null);
                }}
                disabled={disabled}
              >
                <option value="all">Both / all cases</option>
                {parts.map((_, i) => (
                  <option key={i} value={i}>
                    Case {i + 1} only
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="move-controls">
            <label>
              Operation
              <select
                aria-label="Operation"
                value={operation}
                disabled={disabled}
                onChange={(e) => {
                  update({ operation: e.target.value });
                  setSelection(null);
                }}
              >
                <option value="subtract">Subtract from both sides</option>
                <option value="add">Add to both sides</option>
                <option value="divide">Divide both sides by</option>
                <option value="multiply">Multiply both sides by</option>
                <option value="combine">Combine like terms</option>
                <option value="distribute">Distribute across parentheses</option>
                <option value="split">Open absolute-value cases</option>
              </select>
            </label>
            {needsAmount && (
              <div>
                <span className="input-caption">
                  {operation === 'add' || operation === 'subtract'
                    ? 'Number or expression'
                    : 'Nonzero number or fraction'}
                </span>
                <MathInput
                  label="Amount for the operation"
                  value={entry.amount}
                  onChange={(amount) => update({ amount })}
                  onEnter={(latex) => propose(operation, latex)}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="button"
            disabled={disabled || (needsAmount && !entry.amount.trim())}
            onClick={() => propose()}
          >
            Preview move
          </button>
          {visiblePreview && (
            <section
              ref={previewPanel}
              tabIndex={-1}
              className="move-preview"
              aria-label="Move preview"
              aria-live="polite"
            >
              <p className="operation-note">{visiblePreview.reason}</p>
              <span className="eyebrow">THE OPERATION</span>
              <MathLine text={visiblePreview.working} />
              <span className="eyebrow">AFTER CANCELLING AND COLLECTING TERMS</span>
              <MathLine text={visiblePreview.after} />
              {visiblePreview.flips && (
                <p className="inequality-note">
                  The inequality reverses on both lines because you used a negative number.
                </p>
              )}
              <div className="preview-actions">
                <button
                  type="button"
                  className="button"
                  disabled={disabled}
                  onClick={() => onAppend(visiblePreview.after, visiblePreview.reason)}
                >
                  Keep this step
                </button>
                <button type="button" className="button secondary" onClick={() => setPreview(null)}>
                  Cancel preview
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <span className="input-caption">Next equation</span>
          <MathInput
            label="Next equation"
            value={entry.latex}
            onChange={(latex) => update({ latex })}
            onEnter={addTyped}
            disabled={disabled}
          />
          {mode === 'guide' && (
            <p className="field-note">
              Use the fraction and grouping keys at your cursor. Keep the same solutions on both
              sides, and include every absolute-value case.
            </p>
          )}
          <div className="parts" role="group" aria-label="Special solution statements">
            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ latex: '\\text{no solution}' })}
            >
              No solution
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => update({ latex: '\\text{all real numbers}' })}
            >
              All real numbers
            </button>
          </div>
          <label>
            What did you change?
            <input
              value={entry.reason}
              disabled={disabled}
              maxLength={240}
              placeholder="I divided both sides by…"
              onChange={(e) => update({ reason: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={disabled || !entry.latex.trim()}
            onClick={() => addTyped()}
          >
            Check and add step
          </button>
        </>
      )}
      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
      {(entry.latex || entry.amount || entry.reason) && (
        <div className="entry-status">
          <small>Save draft also keeps your unfinished entry.</small>
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => update({ latex: '', amount: '', reason: '' })}
          >
            Clear unfinished entry
          </button>
        </div>
      )}
    </div>
  );
}
