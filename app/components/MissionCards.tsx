'use client';
import { useEffect, useState } from 'react';
import { scenarioValues, type Book } from '../../lib/model';
import { missionCardSet, missionCardsHtml, type CardOptions } from '../../lib/mission-cards';

export function MissionCards({ book, dirty }: { book: Book; dirty: boolean }) {
  const [appearance, setAppearance] = useState<CardOptions['appearance']>(
    book.document.appearance ||
      (book.document.type === 'scenario' && book.document.theme === 'siege' ? 'briefing' : 'paper'),
  );
  const [task, setTask] = useState('');
  const [question, setQuestion] = useState('');
  const [prediction, setPrediction] = useState('');
  const [falsifier, setFalsifier] = useState('');
  const [artifact, setArtifact] = useState<{ url: string; revision: number; time: string } | null>(
    null,
  );
  useEffect(
    () => () => {
      if (artifact) URL.revokeObjectURL(artifact.url);
    },
    [artifact],
  );
  if (book.document.type !== 'scenario') return null;
  const scenario = book.document;
  const roles = scenario.tasks.filter((t) => t.kind !== 'transfer');
  function prepare() {
    const values = scenarioValues(scenario, book.contributions, false, book.revision);
    const set = missionCardSet(book, values, { appearance, task, question, prediction, falsifier });
    setArtifact({
      url: URL.createObjectURL(
        new Blob([missionCardsHtml(set)], { type: 'text/html;charset=utf-8' }),
      ),
      revision: book.revision,
      time: set.capturedAt,
    });
  }
  const changed = () => setArtifact(null);
  return (
    <details className="mission-cards-panel">
      <summary>
        Mission cards <span>Take the plan into the match ↗</span>
      </summary>
      <div className="mission-cards-body">
        <p>
          Make an offline briefing with objectives, assignments, published findings, and space for
          field notes. Author solutions and independent checks stay out of the cards.
        </p>
        <div className="card-options">
          <label>
            Card style
            <select
              value={appearance}
              onChange={(e) => {
                setAppearance(e.target.value as CardOptions['appearance']);
                changed();
              }}
            >
              <option value="paper">Paper notebook</option>
              <option value="briefing">Mission briefing</option>
            </select>
          </label>
          <label>
            Objectives
            <select
              value={task}
              onChange={(e) => {
                setTask(e.target.value);
                changed();
              }}
            >
              <option value="">Whole team</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card-options">
          <label>
            Question for the match
            <input
              value={question}
              maxLength={240}
              onChange={(e) => {
                setQuestion(e.target.value);
                changed();
              }}
              placeholder="Can we arrive within two seconds of each other?"
            />
          </label>
          <label>
            Prediction
            <input
              value={prediction}
              maxLength={400}
              onChange={(e) => {
                setPrediction(e.target.value);
                changed();
              }}
              placeholder="If we start at these times, then…"
            />
          </label>
          <label>
            What would count against it?
            <input
              value={falsifier}
              maxLength={400}
              onChange={(e) => {
                setFalsifier(e.target.value);
                changed();
              }}
              placeholder="An arrival gap larger than… under these conditions…"
            />
          </label>
        </div>
        <p className="field-note">
          These prompts go into the card file when you download it; they are not saved in the
          workbook. After playing, record your observations in a notebook or role discussion.
          Printing also offers Save as PDF.
        </p>
        {dirty && (
          <p className="feedback-error" role="status">
            Save your workbook or role work before making cards.
          </p>
        )}
        <div className="card-downloads">
          <button className="button secondary" disabled={dirty || !roles.length} onClick={prepare}>
            {artifact ? 'Refresh from saved work' : 'Prepare cards'}
          </button>
          {artifact && (
            <>
              <a
                className="button secondary"
                href={artifact.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open print sheet ↗
              </a>
              <a className="button" href={artifact.url} download="mission-cards.html">
                Download offline cards ↓
              </a>
            </>
          )}
        </div>
        {artifact && (
          <p className="field-note" role="status">
            Snapshot prepared {new Date(artifact.time).toLocaleTimeString()} · Scenario revision{' '}
            {artifact.revision}. Refresh after the team saves new findings or reviews.
          </p>
        )}
      </div>
    </details>
  );
}
