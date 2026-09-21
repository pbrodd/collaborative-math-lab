'use client';
import { useCallback, useEffect, useState } from 'react';
import { scenarioCatalog } from '../../scenarios/catalog';
import { missions } from '../../lib/missions';
import type { Book, Summary } from '../../lib/model';
import { Solver } from './Solver';
import { DocumentEditor } from './Editors';
import { MissionCards } from './MissionCards';
import { PlanningBoard } from './PlanningBoard';
import { AccountGate, AccountPanel } from './Accounts';
import type { Account } from '../../lib/auth';
import { api } from '../../lib/client-api';
type Dialog =
  | { type: 'create'; kind: 'notebook' | 'scenario' | 'play'; template?: string }
  | { type: 'join'; code?: string }
  | { type: 'share' }
  | { type: 'name' }
  | null;
export function Studio() {
  return (
    <AccountGate>
      {(account, update) => <Workspace key={account.id} account={account} onAccount={update} />}
    </AccountGate>
  );
}
function Workspace({
  account,
  onAccount,
}: {
  account: Account;
  onAccount: (result: { user: Account | null; recoveryCode?: string }) => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [books, setBooks] = useState<Summary[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState(account.name);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const refreshBooks = useCallback(async () => {
    const data = await api('/api/books');
    setBooks(data.books);
    setReady(true);
  }, []);
  const open = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/books/${encodeURIComponent(id)}`);
      setDirty(false);
      setBoardDirty(false);
      setBook(data.book);
      history.replaceState(null, '', `?book=${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the workbook.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api('/api/books')
      .then((data) => {
        if (!active) return;
        setBooks(data.books);
        setReady(true);
        const q = new URLSearchParams(window.location.search);
        if (q.get('book')) void open(q.get('book')!);
        else if (q.get('join')) setDialog({ type: 'join', code: q.get('join')! });
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [open]);
  const bookId = book?.id;
  useEffect(() => {
    if (!bookId) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const data = await api(`/api/books/${bookId}`);
        if (active) setBook(data.book);
      } catch {
        if (active) setToast('Connection paused. Your open draft is still here.');
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bookId]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || boardDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, boardDirty]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const leave = () =>
    !(dirty || boardDirty) ||
    window.confirm('Leave unsaved changes? Save your workbook and board notes first to keep them.');
  const home = () => {
    if (!leave()) return false;
    setDirty(false);
    setBoardDirty(false);
    setBook(null);
    history.replaceState(null, '', '/');
    refreshBooks().catch((e) => setError(e.message));
    return true;
  };
  const mutate = async (data: Record<string, unknown>): Promise<Book> => {
    if (!book) throw new Error('Open a workbook first.');
    const result = await api(`/api/books/${book.id}`, data, 'PATCH');
    setBook(result.book);
    return result.book;
  };
  const derive = async (action: 'remix' | 'test') => {
    if (!book) return;
    if (action === 'remix' && !leave()) return;
    if (
      action === 'test' &&
      boardDirty &&
      !window.confirm('Test-play the saved plan? Unsaved board notes will be left behind.')
    )
      return;
    setLoading(true);
    try {
      const result = await api('/api/books', { action, id: book.id, name, playMode: 'solo' });
      setDirty(false);
      setBoardDirty(false);
      setBook(result.book);
      history.replaceState(null, '', `?book=${result.book.id}`);
      refreshBooks().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const exportBook = () => {
    if (!book) return;
    if (dirty || boardDirty) {
      setError(
        'Save your workbook, role work, and board notes before exporting. The export includes saved work only.',
      );
      return;
    }
    setError('');
    const payload = {
      format: 'discovery-workbook',
      version: 1,
      title: book.title,
      creator: book.creator,
      source: book.source,
      document: book.document,
      planning: book.planning,
      work: book.contributions.map((c) => ({
        task: c.task_id,
        work: c.work,
        published: !!c.published,
      })),
      reviews: book.reviews.map((r) => ({
        ...r,
        author: book.members.find((m) => m.id === r.member_id)?.name,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const create = (kind: 'notebook' | 'scenario' | 'play', template?: string) => {
    if (!leave()) return;
    setDialog({ type: 'create', kind, template });
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to your workspace
      </a>
      <header className="site-header">
        <button className="wordmark" onClick={home} aria-label="Discovery lab home">
          <span className="logo-mark">
            u<span>·</span>
          </span>
          <span>
            untitled<span className="wordmark-dot">.</span>
            <small>A STUDENT DISCOVERY LAB</small>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button className={!book ? 'active' : ''} onClick={home}>
            Explore
          </button>
          <button
            onClick={() => {
              if (!home()) return;
              setTimeout(
                () =>
                  document.getElementById('my-workbooks')?.scrollIntoView({ behavior: 'smooth' }),
                30,
              );
            }}
          >
            My workbooks
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="button secondary small"
            disabled={!ready}
            onClick={() => {
              if (leave()) setDialog({ type: 'join' });
            }}
          >
            Join a room ↗
          </button>
          <button
            className="profile-button"
            onClick={() => setAccountOpen(true)}
            aria-label="Account settings"
          >
            {name.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      {error && (
        <div className="global-notice notice error" role="alert">
          {error}
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {loading && (
        <div className="loading-strip" role="status">
          Opening your workspace…
        </div>
      )}
      <main id="main">
        {!book ? (
          <div className="home">
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <i /> MADE FOR CURIOUS MINDS
                </span>
                <h1>
                  Your questions.
                  <br />
                  Your team.
                  <br />
                  <em>Your discovery.</em>
                </h1>
                <p>
                  Make something out of your curiosity. Build a world, follow the math, and figure
                  it out together.
                </p>
                <div className="hero-actions">
                  <button className="button" disabled={!ready} onClick={() => create('notebook')}>
                    Start with an idea <span>↗</span>
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      document.getElementById('missions')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    Find a mission ↓
                  </button>
                </div>
                <div className="hero-footnote">
                  <span className="mini-avatars">
                    <i>A</i>
                    <i>B</i>
                    <i>C</i>
                  </span>
                  <span>Different ideas. One shared discovery.</span>
                </div>
              </div>
              <div className="hero-visual" aria-label="An equation branches into two valid results">
                <div className="grid-decoration" />
                <span className="floating-label label-top">
                  WHAT IF THERE’S MORE THAN ONE ANSWER?
                </span>
                <div className="paper-equation">
                  <div>
                    <span className="paper-dot" />
                    <small>A QUESTION WORTH ASKING</small>
                    <span>✦</span>
                  </div>
                  <p>|x − 4| = 3</p>
                  <div className="paper-branches">
                    <span>↙</span>
                    <span>↘</span>
                  </div>
                  <div className="paper-answers">
                    <span>x = 1</span>
                    <span>x = 7</span>
                  </div>
                  <small>Two paths. Both worth exploring.</small>
                </div>
                <span className="floating-label label-bottom">
                  CHECK IT. QUESTION IT. REMIX IT.
                </span>
                <span className="hero-star">✳</span>
              </div>
            </section>
            <section className="creation-strip">
              <div>
                <span className="mini-symbol">+</span>
                <h2>Make it yours.</h2>
                <p>A blank page is a perfectly good starting point.</p>
              </div>
              <button disabled={!ready} onClick={() => create('notebook')}>
                <span>▤</span>
                <b>Open a notebook</b>
                <small>Questions, graphs & unfinished ideas</small>
                <i>↗</i>
              </button>
              <button disabled={!ready} onClick={() => create('scenario')}>
                <span>⌘</span>
                <b>Create a scenario</b>
                <small>A world for your friends to figure out</small>
                <i>↗</i>
              </button>
            </section>
            <section id="missions" className="missions-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">A FEW PLACES TO BEGIN</span>
                  <h2>Small steps. Big worlds.</h2>
                </div>
                <span className="collection-tag">STARTER COLLECTION / 01</span>
              </div>
              <div className="mission-cards">
                {scenarioCatalog.map((entry, i) => {
                  const id = entry.id;
                  const m = missions[id as keyof typeof missions] || {
                    name: entry.title,
                    title: entry.title,
                    subtitle: entry.scenario.story,
                    category: 'COMMUNITY LAB',
                    skills: ['Student-created'],
                    minutes: 'Explore at your pace',
                  };
                  return (
                    <article className={`mission-card ${id}`} key={id}>
                      <div className="mission-card-top">
                        <span className="mission-world">{m.name.toUpperCase()}</span>
                        <span>0{i + 1} / LAB</span>
                      </div>
                      <div className="mission-card-content">
                        <div>
                          <span className="mission-category">{m.category}</span>
                          <h3>{m.title}</h3>
                          <p>{m.subtitle}</p>
                        </div>
                        <span className="mission-glyph">{id === 'brawl' ? '✦' : '⌁'}</span>
                      </div>
                      <div className="skill-tags">
                        {m.skills.map((s) => (
                          <span key={s}>{s}</span>
                        ))}
                      </div>
                      <div className="mission-card-bottom">
                        <span>{m.minutes} · solo or crew</span>
                        <div>
                          <button
                            className="remix-button"
                            disabled={!ready}
                            onClick={() => create('scenario', id)}
                          >
                            Remix
                          </button>
                          <button
                            className="mission-play"
                            disabled={!ready}
                            onClick={() => create('play', id)}
                          >
                            Play mission ↗
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            <section id="my-workbooks" className="my-workbooks">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">KEEP THE THREAD GOING</span>
                  <h2>Your work in progress</h2>
                </div>
                <div className="segmented">
                  {['all', 'notebook', 'scenario', 'play'].map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f === 'all'
                        ? 'All'
                        : f === 'notebook'
                          ? 'Notebooks'
                          : f === 'scenario'
                            ? 'Scenarios'
                            : 'Playthroughs'}
                    </button>
                  ))}
                </div>
              </div>
              {books.filter((b) => filter === 'all' || b.kind === filter).length ? (
                <div className="book-grid">
                  {books
                    .filter((b) => filter === 'all' || b.kind === filter)
                    .map((b) => (
                      <button className="book-card" key={b.id} onClick={() => open(b.id)}>
                        <span className={`book-symbol ${b.kind}`}>
                          {b.kind === 'notebook' ? '▤' : b.kind === 'scenario' ? '⌘' : '↗'}
                        </span>
                        <small>{b.kind === 'play' ? 'PLAYTHROUGH' : b.kind.toUpperCase()}</small>
                        <h3>{b.title}</h3>
                        <p>
                          By {b.creator} ·{' '}
                          {b.members === 1 ? 'Solo workspace' : `${b.members} collaborators`}
                        </p>
                        <span className="book-date">
                          {new Date(b.updated_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                          <i>Continue →</i>
                        </span>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="empty-library">
                  <span>↖</span>
                  <h3>Your next idea belongs here.</h3>
                  <p>
                    Start a notebook, remix a mission, or make a scenario from scratch. It doesn’t
                    have to be finished to be worth saving.
                  </p>
                  <button
                    className="text-button"
                    disabled={!ready}
                    onClick={() => create('notebook')}
                  >
                    Create your first notebook →
                  </button>
                </div>
              )}
            </section>
            <section className="principles">
              <div>
                <span>01</span>
                <h3>Own the question.</h3>
                <p>Follow an interest. Invent a world. Make the problem yours.</p>
              </div>
              <div>
                <span>02</span>
                <h3>Make your thinking visible.</h3>
                <p>Build with parts, ask for a hint, or work freely. Every step has a reason.</p>
              </div>
              <div>
                <span>03</span>
                <h3>Find another pair of eyes.</h3>
                <p>Review a friend’s idea. Ask a better question. Discover more together.</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="active-workspace">
            <div className="workspace-bar">
              <button className="text-button" onClick={home}>
                ← Your workbooks
              </button>
              <div>
                <button className="text-button" onClick={() => derive('remix')}>
                  Remix
                </button>
                <button className="text-button" onClick={exportBook}>
                  Export
                </button>
                <button className="button small" onClick={() => setDialog({ type: 'share' })}>
                  Invite the crew ↗
                </button>
              </div>
            </div>
            {book.source && (
              <div className="attribution">
                {book.kind === 'play' ? 'Playing' : 'Remixed from'}{' '}
                <button
                  onClick={() => {
                    if (!leave()) return;
                    if (book.source!.id.startsWith('starter:'))
                      create('scenario', book.source!.id.split(':')[1] as 'brawl' | 'siege');
                    else {
                      setDirty(false);
                      open(book.source!.id);
                    }
                  }}
                >
                  {book.source.title}
                </button>{' '}
                by {book.source.creator}
                <span> · Created by {book.creator}</span>
              </div>
            )}
            <PlanningBoard
              key={`plan:${book.id}`}
              book={book}
              mutate={mutate}
              onDirty={setBoardDirty}
            />
            {book.document.type === 'scenario' && (
              <MissionCards key={`cards:${book.id}`} book={book} dirty={dirty || boardDirty} />
            )}
            {book.kind === 'play' ? (
              <Solver key={book.id} book={book} mutate={mutate} onDirty={setDirty} />
            ) : (
              <DocumentEditor
                key={book.id}
                book={book}
                mutate={mutate}
                onDirty={setDirty}
                onTest={() => derive('test')}
              />
            )}
          </div>
        )}
      </main>
      <footer className="site-footer">
        <span>Built for questions that lead somewhere.</span>
        <details>
          <summary>The name? That’s yours, too.</summary>
          <p>
            “Untitled” is a placeholder. The crew gets to name this. “mathchud” is one candidate.
          </p>
          <small>CHUD · Collaborative Hub for Unhinged Discovery</small>
        </details>
        <a href="/verification" target="_blank" rel="noreferrer">
          How do we know the math is right? ↗
        </a>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {accountOpen && (
        <AccountPanel
          user={account}
          canLeave={leave}
          onClose={() => setAccountOpen(false)}
          onUpdate={(result) => {
            if (result.user) setName(result.user.name);
            onAccount(result);
          }}
        />
      )}
      {dialog && (
        <DialogView
          dialog={dialog}
          name={name}
          book={book}
          onClose={() => setDialog(null)}
          onName={(n) => {
            setName(n);
          }}
          onCreated={(b) => {
            setDirty(false);
            setBoardDirty(false);
            setBook(b);
            history.replaceState(null, '', `?book=${b.id}`);
            setDialog(null);
            refreshBooks().catch(() => {});
          }}
          onCopy={() => setToast('Invite copied. Share it with your crew.')}
        />
      )}
    </div>
  );
}
function DialogView({
  dialog,
  name,
  book,
  onClose,
  onName,
  onCreated,
  onCopy,
}: {
  dialog: NonNullable<Dialog>;
  name: string;
  book: Book | null;
  onClose: () => void;
  onName: (n: string) => void;
  onCreated: (b: Book) => void;
  onCopy: () => void;
}) {
  const [nickname, setNickname] = useState(name);
  const [code, setCode] = useState(dialog.type === 'join' ? dialog.code || '' : '');
  const [title, setTitle] = useState(
    dialog.type === 'create'
      ? dialog.template
        ? scenarioCatalog.find((s) => s.id === dialog.template)?.title || 'My new scenario'
        : dialog.kind === 'notebook'
          ? 'An unfinished idea'
          : 'My new scenario'
      : '',
  );
  const [playMode, setPlayMode] = useState('solo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);
  async function submit() {
    if (!nickname.trim()) {
      setError('Choose a display name.');
      return;
    }
    onName(nickname.trim());
    if (dialog.type === 'name') {
      onClose();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api(
        '/api/books',
        dialog.type === 'join'
          ? { action: 'join', name: nickname, code }
          : dialog.type === 'create'
            ? {
                action: 'create',
                kind: dialog.kind,
                template: dialog.template,
                title,
                name: nickname,
                playMode,
              }
            : {},
      );
      onCreated(result.book);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button
          className="modal-close icon-button"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <span className="eyebrow">A PLACE FOR YOUR CREW</span>
        <h2 id="dialog-title">
          {dialog.type === 'share'
            ? 'Better with another mind.'
            : dialog.type === 'join'
              ? 'Pull up a chair.'
              : dialog.type === 'name'
                ? 'What should we call you?'
                : dialog.kind === 'notebook'
                  ? 'Start anywhere.'
                  : dialog.kind === 'scenario'
                    ? 'Make a world of your own.'
                    : 'Let’s figure this out.'}
        </h2>
        {dialog.type === 'share' && book ? (
          <>
            <p>
              Share this code with people who can access the site. They can join this{' '}
              {book.kind === 'play' ? 'mission' : 'shared workbook'} from their own browser.
            </p>
            <div className="room-code">
              {book.code.slice(0, 5)} {book.code.slice(5)}
            </div>
            <button
              className="button full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${location.origin}/?join=${book.code}`);
                  onCopy();
                } catch {
                  setError('Copy the room code shown above to share it.');
                }
              }}
            >
              Copy invitation link ↗
            </button>
            <p className="field-note">
              A room code grants access to this workbook. Share it with your intended crew.
            </p>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label>
              Your display name
              <input
                autoFocus
                required
                value={nickname}
                maxLength={24}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="A nickname is perfect"
              />
            </label>
            {dialog.type === 'join' && (
              <label>
                Room code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCDE FG234"
                  maxLength={16}
                  required
                  className="code-input"
                />
              </label>
            )}
            {dialog.type === 'create' && (
              <>
                <label>
                  Workbook title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    required
                  />
                </label>
                {dialog.kind === 'play' && (
                  <fieldset className="play-choice">
                    <legend>How are you playing?</legend>
                    <label className={playMode === 'solo' ? 'chosen' : ''}>
                      <input
                        type="radio"
                        name="playmode"
                        value="solo"
                        checked={playMode === 'solo'}
                        onChange={() => setPlayMode('solo')}
                      />
                      <b>Start solo</b>
                      <span>Explore every role at your own pace.</span>
                    </label>
                    <label className={playMode === 'team' ? 'chosen' : ''}>
                      <input
                        type="radio"
                        name="playmode"
                        value="team"
                        checked={playMode === 'team'}
                        onChange={() => setPlayMode('team')}
                      />
                      <b>Start a team room</b>
                      <span>Invite friends, divide roles, review together.</span>
                    </label>
                  </fieldset>
                )}
              </>
            )}
            <button className="button full" type="submit" disabled={busy}>
              {busy
                ? 'Opening…'
                : dialog.type === 'join'
                  ? 'Join the crew →'
                  : dialog.type === 'name'
                    ? 'Save name'
                    : 'Create workbook →'}
            </button>
          </form>
        )}
        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
