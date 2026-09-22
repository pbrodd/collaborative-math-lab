'use client';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { siegeRehearsal, signalTime, type SiegeSignals } from '../../lib/siege-briefing';

function subscribeMotion(callback: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', callback);
  return () => preference.removeEventListener('change', callback);
}
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function SiegeBriefing({
  title,
  signals,
  published,
  total,
  reviewed = 0,
  children,
}: {
  title: string;
  signals: SiegeSignals;
  published: number;
  total: number;
  reviewed?: number;
  children?: ReactNode;
}) {
  const [motion, setMotion] = useState(true);
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);
  const animate = motion && !reduced;
  return (
    <section
      className={`siege-briefing${animate ? '' : ' siege-still'}`}
      aria-label="Mission command"
    >
      <div className="siege-command-bar">
        <span>
          <i className="siege-status-light" /> COMMAND CONSOLE <b>/ ACTIVE</b>
        </span>
        <span className="siege-classification">SIEGE // TACTICAL REHEARSAL</span>
        <button
          className="siege-small-button"
          aria-pressed={!animate}
          disabled={reduced}
          onClick={() => setMotion(!motion)}
        >
          {reduced
            ? 'Reduced motion enabled'
            : motion
              ? 'Pause ambient motion'
              : 'Resume ambient motion'}
        </button>
      </div>
      <div className="siege-hero">
        <div className="siege-hero-copy">
          <span className="siege-kicker">OPERATION / SYNCHRONIZE</span>
          <h2>
            {title === 'Every second counts' ? (
              <>
                EVERY SECOND
                <br />
                <em>COUNTS.</em>
              </>
            ) : (
              title
            )}
          </h2>
          <p>
            One objective. One arrival window.
            <br />
            Get your team there together.
          </p>
          <a className="siege-launch" href="#siege-workspace">
            Enter the mission <span>↗</span>
          </a>
          <div className="siege-hero-meta">
            <span>CO-OP INTELLIGENCE</span>
            <span>SUPPLIED PRACTICE DATA</span>
          </div>
        </div>
        <div className="siege-device-bay" aria-label="Rotating holographic relay device" role="img">
          <div className="siege-device-grid" />
          <div className="siege-orbit siege-orbit-outer" />
          <div className="siege-orbit siege-orbit-inner" />
          <div className="siege-device-shadow" />
          <div className="siege-device-perspective">
            <div className="siege-device">
              {['front', 'back', 'left', 'right', 'top', 'bottom'].map((face) => (
                <div className={`siege-device-face siege-device-${face}`} key={face}>
                  <span className="siege-device-core" />
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          </div>
          <div className="siege-object-label">
            <span>ASSET 01</span>
            <b>RELAY CORE</b>
            <small>Awaiting synchronized arrival</small>
          </div>
          <span className="siege-object-axis">
            Y +<br />
            <br />Z / X
          </span>
          <div className="siege-device-caption">
            LIVE OBJECT VIEW <span>↻ 360°</span>
          </div>
        </div>
        <div className="siege-signal-rail">
          <span className="siege-kicker">MISSION SIGNALS</span>
          <Signal label="YOUR ROUTE" code="ALPHA" value={signals.travel} />
          <Signal label="TEAM ARRIVAL" code="BRAVO" value={signals.arrival} />
          <Signal label="ARRIVAL DEADLINE" code="OBJECTIVE" value={signals.deadline} />
          <small>Readouts use published findings.</small>
        </div>
      </div>
      <div className="siege-mission-strip">
        <span>
          <b>{String(published).padStart(2, '0')}</b> / {String(total).padStart(2, '0')} FINDINGS
          TRANSMITTED
        </span>
        <div className="siege-segments" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i className={i < published ? 'lit' : ''} key={i} />
          ))}
        </div>
        <span>{reviewed} PEER REVIEWED</span>
        <span className="siege-strip-note">YOUR CALCULATIONS POWER THE PLAN</span>
      </div>
      <Rehearsal key={Object.values(signals).join(':')} signals={signals} motion={animate} />
      {children}
    </section>
  );
}

function Signal({ label, code, value }: { label: string; code: string; value: number | null }) {
  return (
    <div className={`siege-signal${value === null ? '' : ' received'}`}>
      <span>
        {label}
        <i />
      </span>
      <strong>
        {signalTime(value)}
        <small>{value === null ? ' PENDING' : ' SEC'}</small>
      </strong>
      <span className="siege-signal-code">
        {code} / {value === null ? 'AWAITING INTEL' : 'SIGNAL RECEIVED'}
      </span>
    </div>
  );
}

function Rehearsal({ signals, motion }: { signals: SiegeSignals; motion: boolean }) {
  const [start, setStart] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const result = siegeRehearsal(signals, start);
  const maximum =
    Math.max(signals.arrival ?? 0, signals.deadline ?? 0, signals.travel ?? 0, 1000) + 5000;
  const duration =
    Math.max(result?.ready ?? 0, signals.arrival ?? 0, signals.deadline ?? 0, 1000) + 1000;
  useEffect(() => {
    if (!playing || !motion) return;
    const begins = performance.now();
    const timer = setInterval(() => {
      const elapsed = (performance.now() - begins) * 4;
      setTime(Math.min(duration, elapsed));
      if (elapsed >= duration) setPlaying(false);
    }, 50);
    return () => clearInterval(timer);
  }, [playing, duration, motion]);
  const progress = (delay: number, travel: number | null) =>
    travel === null || time < delay
      ? 0
      : travel === 0
        ? 100
        : Math.min(100, Math.max(0, ((time - delay) / travel) * 100));
  const alpha = progress(start, signals.travel);
  const bravo = progress(0, signals.arrival);
  return (
    <div className={`siege-rehearsal${open ? ' is-open' : ''}`}>
      <button
        className="siege-rehearsal-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <i className="siege-crosshair">⌖</i> TACTICAL REHEARSAL{' '}
          <small>Test a start time. Watch the arrivals.</small>
        </span>
        <span>
          {result ? 'SIMULATOR ONLINE' : 'AWAITING FINDINGS'} <b>{open ? '−' : '+'}</b>
        </span>
      </button>
      {open && (
        <div className="siege-rehearsal-body">
          <div className="siege-route-display">
            <div className="siege-route-heading">
              <span>ARRIVAL SCHEMATIC</span>
              <span>T + {signalTime(Math.round(time))} SEC</span>
            </div>
            <div className="siege-route-lane">
              <b>ALPHA</b>
              <div>
                <span style={{ width: `${alpha}%` }} />
                <i style={{ left: `${alpha}%` }} />
              </div>
              <small>
                {signals.travel === null
                  ? 'Awaiting route'
                  : `Travel ${signalTime(signals.travel)}s`}
              </small>
            </div>
            <div className="siege-route-lane bravo">
              <b>BRAVO</b>
              <div>
                <span style={{ width: `${bravo}%` }} />
                <i style={{ left: `${bravo}%` }} />
              </div>
              <small>
                {signals.arrival === null
                  ? 'Awaiting arrival'
                  : `Travel ${signalTime(signals.arrival)}s`}
              </small>
            </div>
            <div className="siege-route-target">
              <span>◇</span> RENDEZVOUS
            </div>
            <p>Predicted timing at 4× speed. Lines show progress through supplied travel times.</p>
            {result && (
              <label className="siege-replay-scrubber">
                Rehearsal time
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="1"
                  value={time}
                  onChange={(e) => {
                    setPlaying(false);
                    setTime(Number(e.target.value));
                  }}
                />
              </label>
            )}
          </div>
          <div className="siege-rehearsal-controls">
            <label>
              ALPHA START DELAY{' '}
              <output>
                {signalTime(start)} <small>SEC</small>
              </output>
              <input
                aria-label="Alpha start delay in seconds"
                type="range"
                min="0"
                max={maximum / 1000}
                step="0.5"
                value={start / 1000}
                disabled={!result}
                onChange={(e) => {
                  setStart(Math.round(Number(e.target.value) * 1000));
                  setTime(0);
                  setPlaying(false);
                }}
              />
            </label>
            {result && (
              <label className="siege-delay-entry">
                Exact start delay (seconds)
                <input
                  type="number"
                  min="0"
                  max={maximum / 1000}
                  step="0.001"
                  value={start / 1000}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value) || value < 0 || value > maximum / 1000) return;
                    setStart(Math.round(value * 1000));
                    setTime(0);
                    setPlaying(false);
                  }}
                />
              </label>
            )}
            {result ? (
              <>
                <div className="siege-rehearsal-verdict" role="status">
                  <b className={result.fits ? 'fits' : ''}>
                    {result.fits ? '✓ TIMING FITS' : '△ ADJUST THE PLAN'}
                  </b>
                  <span>
                    Alpha arrives at {signalTime(result.ready)}s · gap {signalTime(result.spread)}s
                  </span>
                  <span>
                    {result.synchronized ? '✓' : '×'} Within {signalTime(signals.tolerance)}s of
                    Bravo
                  </span>
                  <span>
                    {result.beforeDeadline ? '✓' : '×'} Both arrive by{' '}
                    {signalTime(signals.deadline)}s
                  </span>
                </div>
                <button
                  className="siege-launch"
                  disabled={!motion}
                  onClick={() => {
                    setTime(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? 'Stop rehearsal' : 'Run rehearsal'} <span>▷</span>
                </button>
                {!motion && <small>Use the rehearsal-time slider while motion is paused.</small>}
              </>
            ) : (
              <p>
                Publish your route, teammate arrival, and deadline to bring the rehearsal online.
                Timing readouts support nonnegative values up to one hour with exact millisecond
                precision.
              </p>
            )}
            <small>Trying a delay here does not publish or change your solution.</small>
          </div>
        </div>
      )}
    </div>
  );
}
