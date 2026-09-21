'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { Account, AccountState } from '../../lib/auth';
import { api } from '../../lib/client-api';

type AccountResult = { user: Account | null; recoveryCode?: string };
export function AccountGate({
  children,
}: {
  children: (user: Account, update: (result: AccountResult) => void) => ReactNode;
}) {
  const [state, setState] = useState<AccountState | null>(null);
  const [recovery, setRecovery] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/api/account')
      .then((value) => {
        if (!active) return;
        setState(value);
        setInvite(new URLSearchParams(window.location.search).get('invite') || '');
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const update = (result: AccountResult) => {
    setState({ user: result.user, setupRequired: false, setupAvailable: false });
    setRecovery(result.recoveryCode || '');
    if (result.recoveryCode || result.user) {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      history.replaceState(null, '', url.pathname + url.search);
      setInvite('');
    }
  };
  if (recovery)
    return (
      <main className="account-page">
        <RecoveryCard code={recovery} onContinue={() => setRecovery('')} />
      </main>
    );
  if (state?.user) return children(state.user, update);
  return (
    <main className="account-page">
      <section className="account-card">
        <span className="eyebrow">UNTITLED · A STUDENT DISCOVERY LAB</span>
        <h1>Your questions. Your math.</h1>
        <p>Keep your work, return on another device, and explore with your crew.</p>
        {error && (
          <p className="notice error" role="alert">
            {error} <button onClick={() => window.location.reload()}>Retry</button>
          </p>
        )}
        {!state ? (
          <p role="status">Connecting to the lab…</p>
        ) : (
          <SignInForm state={state} invite={invite} onComplete={update} />
        )}
      </section>
    </main>
  );
}
function RecoveryCard({ code, onContinue }: { code: string; onContinue: () => void }) {
  const [saved, setSaved] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          `Discovery lab recovery code\nSite: ${window.location.origin}\n\n${code}\n\nKeep this private. It can reset your password once. A reset replaces this code and signs out every device.\n`,
        ],
        { type: 'text/plain' },
      ),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'math-lab-recovery-code.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="account-card">
      <h1>Keep your recovery code.</h1>
      <p>
        This is shown once. Store it somewhere private, or ask a parent to keep it. It lets you
        reset a forgotten password without email.
      </p>
      <code className="account-secret">{code}</code>
      <button className="button secondary" onClick={download}>
        Download recovery code
      </button>
      <label className="account-check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I
        have saved my recovery code.
      </label>
      <button className="button" disabled={!saved} onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
function SignInForm({
  state,
  invite,
  onComplete,
}: {
  state: AccountState;
  invite: string;
  onComplete: (result: AccountResult) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'recover' | 'setup'>(
    state.setupRequired ? 'setup' : invite ? 'register' : 'login',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const creating = mode === 'register' || mode === 'setup';
  return (
    <>
      <h2>
        {mode === 'setup'
          ? 'Set up the host account'
          : mode === 'register'
            ? 'Join the lab'
            : mode === 'recover'
              ? 'Recover your account'
              : 'Welcome back'}
      </h2>
      {mode === 'setup' && !state.setupAvailable ? (
        <p className="notice">
          The host needs to configure the setup key before accounts can be created. See the server
          hosting guide.
        </p>
      ) : (
        <form
          key={mode}
          className="account-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (mode !== 'login' && form.get('password') !== form.get('confirm')) {
              setError('The passwords do not match.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              const data = await api('/api/account', {
                action: mode,
                username: form.get('username'),
                password: form.get('password'),
                newPassword: form.get('password'),
                name: form.get('name'),
                invite: form.get('invite'),
                setupToken: form.get('setupToken'),
                recoveryCode: form.get('recoveryCode'),
              });
              onComplete(data);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            {mode === 'setup' && (
              <label>
                Host setup key
                <input name="setupToken" type="password" autoComplete="off" required />
              </label>
            )}
            {mode === 'register' && (
              <label>
                Invitation code
                <input name="invite" defaultValue={invite} autoComplete="off" required />
              </label>
            )}
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            {creating && (
              <label>
                Display name
                <input
                  name="name"
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="A nickname is perfect"
                  required
                />
              </label>
            )}
            {mode === 'recover' && (
              <label>
                Recovery code
                <input name="recoveryCode" autoComplete="off" required />
              </label>
            )}
            <label>
              {mode === 'recover' ? 'New password' : 'Password'}
              <input
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'login' ? undefined : 15}
                maxLength={128}
                required
              />
            </label>
            {mode !== 'login' && (
              <>
                <p className="field-note">
                  Use at least 15 characters. A few memorable words work well. Spaces are welcome.
                </p>
                <label>
                  Repeat password
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={128}
                    required
                  />
                </label>
              </>
            )}
            {creating && (
              <p className="field-note">
                No email needed. If you have older work in this browser on this server, creating
                your account will keep it with you.
              </p>
            )}
            {mode === 'recover' && (
              <p className="field-note">
                Resetting replaces your recovery code and signs out every device.
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <button className="button full" type="submit">
              {busy
                ? 'Please wait…'
                : creating
                  ? 'Create account'
                  : mode === 'recover'
                    ? 'Reset password'
                    : 'Sign in'}
            </button>
          </fieldset>
        </form>
      )}
      {!state.setupRequired && (
        <nav className="account-options" aria-label="Account options">
          {(['login', 'register', 'recover'] as const)
            .filter((value) => value !== mode)
            .map((value) => (
              <button
                className="text-button"
                disabled={busy}
                key={value}
                onClick={() => {
                  setMode(value);
                  setError('');
                }}
              >
                {value === 'login'
                  ? 'Sign in'
                  : value === 'register'
                    ? 'I have an invitation'
                    : 'Forgot password?'}
              </button>
            ))}
        </nav>
      )}
    </>
  );
}
type Invite = { id: string; label: string; expires_at: number; used: number; revoked: number };
export function AccountPanel({
  user,
  onUpdate,
  onClose,
  canLeave,
}: {
  user: Account;
  onUpdate: (result: AccountResult) => void;
  onClose: () => void;
  canLeave: () => boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [invitation, setInvitation] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  useEffect(() => {
    if (user.role !== 'admin') return;
    let active = true;
    api('/api/account', { action: 'invites' })
      .then((result) => {
        if (active) setInvites(result.invites);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user.role]);
  async function act(input: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api('/api/account', input);
      if (input.action === 'invite') {
        setInvitation(`${window.location.origin}/?invite=${encodeURIComponent(result.invite)}`);
        setInvites((await api('/api/account', { action: 'invites' })).invites);
      } else if (input.action === 'revoke-invite') {
        setInvites((await api('/api/account', { action: 'invites' })).invites);
      } else {
        onUpdate(result);
        if (input.action === 'profile') setMessage('Display name saved.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button
          className="modal-close icon-button"
          aria-label="Close account settings"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="account-title">Your account</h2>
        <p>
          Signed in as <strong>{user.username}</strong>
          {user.role === 'admin' ? ' · Host' : ''}
        </p>
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: 'profile', name: new FormData(e.currentTarget).get('name') });
          }}
        >
          <label>
            Display name
            <input name="name" defaultValue={user.name} required maxLength={24} disabled={busy} />
          </label>
          <button className="button secondary" disabled={busy}>
            Save display name
          </button>
        </form>
        <details>
          <summary>Change password and recovery code</summary>
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (form.get('newPassword') !== form.get('confirm')) {
                setError('The passwords do not match.');
                return;
              }
              if (!canLeave()) return;
              void act({
                action: 'password',
                password: form.get('password'),
                newPassword: form.get('newPassword'),
              });
            }}
          >
            <fieldset disabled={busy}>
              <input type="hidden" name="username" value={user.username} autoComplete="username" />
              <label>
                Current password
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <label>
                New password
                <input
                  name="newPassword"
                  type="password"
                  minLength={15}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Repeat new password
                <input
                  name="confirm"
                  type="password"
                  minLength={15}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
              <p className="field-note">
                This signs out all devices and gives you a new recovery code.
              </p>
              <button className="button secondary">Change password</button>
            </fieldset>
          </form>
        </details>
        {user.role === 'admin' && (
          <section className="account-invites">
            <h3>Invite someone</h3>
            <p>Each invitation works once and expires after seven days.</p>
            <form
              className="account-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act({ action: 'invite', label: new FormData(e.currentTarget).get('label') });
              }}
            >
              <label>
                Invitation label
                <input
                  name="label"
                  maxLength={24}
                  placeholder="e.g. Study partner"
                  disabled={busy}
                />
              </label>
              <button className="button secondary" disabled={busy}>
                Create invitation
              </button>
            </form>
            {invitation && (
              <label>
                Copy this invitation link
                <input
                  aria-label="Invitation link"
                  value={invitation}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <small>Shown only here. Share it privately with the person you’re inviting.</small>
              </label>
            )}
            {invites.length > 0 && (
              <ul className="invitation-list">
                {invites.map((invite) => (
                  <li key={invite.id}>
                    <span>
                      {invite.label} ·{' '}
                      {invite.used
                        ? 'Used'
                        : invite.revoked
                          ? 'Revoked'
                          : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                    </span>
                    {!invite.used && !invite.revoked && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void act({ action: 'revoke-invite', id: invite.id })}
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice good" role="status">
            {message}
          </p>
        )}
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            if (canLeave()) void act({ action: 'logout' });
          }}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
