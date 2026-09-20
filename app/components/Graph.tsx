'use client';
import { useEffect, useRef, useState } from 'react';
import { evaluateAt, numberValue } from '../../lib/algebra';
import { scenarioValues, type Book } from '../../lib/model';
export function Graph({
  expression,
  min = -10,
  max = 10,
}: {
  expression: string;
  min?: number;
  max?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const ctx = element.getContext('2d');
      if (!ctx) return;
      const width = element.clientWidth,
        height = 260,
        ratio = window.devicePixelRatio || 1;
      element.width = width * ratio;
      element.height = height * ratio;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, width, height);
      try {
        if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max || max - min > 10000)
          throw new Error('Choose an increasing x range, up to 10,000 units wide.');
        if (!expression.trim()) {
          setError('Add an expression, such as y = |x - 4|.');
          return;
        }
        const points = Array.from({ length: 241 }, (_, i) => {
          const x = min + ((max - min) * i) / 240;
          return { x, y: evaluateAt(expression, x) };
        });
        const ys = points.map((p) => p.y).filter((y) => Number.isFinite(y) && Math.abs(y) < 100000);
        if (!ys.length) throw new Error('No finite values in this range.');
        let bottom = Math.min(0, ...ys),
          top = Math.max(0, ...ys);
        if (top - bottom < 2) {
          top++;
          bottom--;
        }
        const padding = (top - bottom) * 0.12;
        top += padding;
        bottom -= padding;
        const left = 48,
          right = width - 20,
          up = 18,
          down = 224;
        const px = (x: number) => left + ((x - min) / (max - min)) * (right - left),
          py = (y: number) => down - ((y - bottom) / (top - bottom)) * (down - up);
        ctx.font = '12px system-ui';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const x = min + ((max - min) * i) / 4,
            y = bottom + ((top - bottom) * i) / 4;
          ctx.strokeStyle = '#dce3dd';
          ctx.beginPath();
          ctx.moveTo(px(x), up);
          ctx.lineTo(px(x), down);
          ctx.moveTo(left, py(y));
          ctx.lineTo(right, py(y));
          ctx.stroke();
          ctx.fillStyle = '#526568';
          ctx.textAlign = 'center';
          ctx.fillText(Number(x.toFixed(2)).toString(), px(x), 244);
          ctx.textAlign = 'right';
          ctx.fillText(Number(y.toFixed(1)).toString(), left - 8, py(y) + 4);
        }
        ctx.strokeStyle = '#7c8d8c';
        ctx.beginPath();
        if (min <= 0 && max >= 0) {
          ctx.moveTo(px(0), up);
          ctx.lineTo(px(0), down);
        }
        ctx.moveTo(left, py(0));
        ctx.lineTo(right, py(0));
        ctx.stroke();
        ctx.strokeStyle = '#ed643f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let started = false;
        for (const p of points) {
          if (!Number.isFinite(p.y) || Math.abs(p.y) > 100000) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(px(p.x), py(p.y));
            started = true;
          } else ctx.lineTo(px(p.x), py(p.y));
        }
        ctx.stroke();
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Check the expression.');
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [expression, min, max]);
  return (
    <div className="graph">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Graph of ${expression}, x from ${min} to ${max}. Orange line shows y; values are sampled numerically.`}
      />
      {error && <p className="field-note">{error}</p>}
      <span className="graph-axis">x →</span>
    </div>
  );
}
export function MissionExperiment({ book }: { book: Book }) {
  const [choice, setChoice] = useState(4);
  if (book.document.type !== 'scenario' || book.document.theme === 'original') return null;
  const values = scenarioValues(book.document, book.contributions, false, book.revision);
  const get = (key: string) => {
    try {
      return numberValue(values[key] || '');
    } catch {
      return NaN;
    }
  };
  if (book.document.theme === 'brawl') {
    const health = get('health'),
      reduction = get('reduction'),
      base = get('base'),
      gain = get('gain');
    if (![health, reduction, base, gain].every(Number.isFinite))
      return (
        <p className="field-note">
          Publish the health and shield findings to open this experiment.
        </p>
      );
    const damage = (base + choice * gain) * (1 - reduction),
      hits = damage > 0 ? Math.ceil(health / damage) : Infinity;
    return (
      <div className="experiment">
        <label>
          Try an upgrade level <strong>{choice}</strong>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={choice}
            onChange={(e) => setChoice(+e.target.value)}
          />
        </label>
        <div
          className="damage-bar"
          aria-label={`${Math.min(health, 3 * damage)} of ${health} health covered by three hits`}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: `${Math.min(damage / health, Math.max(0, 1 - (i * damage) / health)) * 100}%`,
              }}
            />
          ))}
        </div>
        <div className="experiment-results">
          <span>
            <b>{Math.round(damage)}</b> damage / hit
          </span>
          <span>
            <b>{hits}</b> hits needed
          </span>
        </div>
        <p>
          {3 * damage >= health
            ? 'Three hits are enough. Try one fewer upgrade.'
            : 'Three hits fall short. Where is the threshold?'}
        </p>
      </div>
    );
  }
  const travel = get('travel'),
    arrival = get('arrival'),
    deadline = get('deadline'),
    tolerance = get('tolerance');
  if (![travel, arrival, deadline, tolerance].every(Number.isFinite))
    return <p className="field-note">Publish the three timing findings to open this experiment.</p>;
  const start = choice + arrival - travel - 4,
    at = start + travel,
    apart = Math.abs(at - arrival),
    works = apart <= tolerance && at <= deadline;
  return (
    <div className="experiment">
      <label>
        Your start time <strong>{start} sec</strong>
        <input
          type="range"
          min="0"
          max="8"
          step=".5"
          value={choice}
          onChange={(e) => setChoice(+e.target.value)}
        />
      </label>
      <div className="arrival-track">
        <span
          className="arrival-window"
          style={{ left: `${((4 - tolerance) / 8) * 100}%`, width: `${(tolerance / 4) * 100}%` }}
        />
        <span className="arrival-marker" style={{ left: `${(choice / 8) * 100}%` }}>
          ●
        </span>
      </div>
      <div className="experiment-results">
        <span>
          Arrival <b>{at} sec</b>
        </span>
        <span>
          Difference <b>{apart} sec</b>
        </span>
      </div>
      <p>
        {works
          ? 'This start meets both constraints.'
          : at > deadline
            ? 'This arrival misses the deadline.'
            : 'This arrival is outside the tolerance.'}
      </p>
    </div>
  );
}
