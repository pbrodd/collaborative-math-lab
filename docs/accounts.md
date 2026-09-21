# Accounts and invitations

Students sign in with a username and password. No email address, email delivery service, or social login provider is required. Workbooks and memberships belong to a persistent account, so signing in on another device restores access and creator ownership.

## Set up the host

Set `APP_ORIGIN` to the exact HTTPS origin, and generate a private `AUTH_SETUP_TOKEN` of at least 32 characters (`openssl rand -hex 32`). Add it to the server's ignored `.env` file before starting Docker Compose. With Workers, set it as a runtime secret. For local development, pass it as an environment variable to `npm run dev`.

Open the app. The initial setup form asks for this key and creates the host account. Save its recovery code. Setup succeeds once per database; the first visitor cannot create an administrator without the key. Remove `AUTH_SETUP_TOKEN` from the environment after setup and recreate the container. Existing accounts keep working without it.

Open **Account settings → Invite someone**. Each invitation permits one student account and expires after seven days. Copy the link when it is created and send it privately. The host can revoke unused invitations. An account invitation is different from a workbook's room code: students sign in first, then join the rooms shared with them. Hosts do not automatically gain access to students' workbooks.

## Passwords and recovery

Use a passphrase of 15–128 characters. Usernames contain 3–24 letters, numbers, or underscores and are case-insensitive. Display names can be nicknames.

Registration displays a private recovery code once, with a download option. **Forgot password?** accepts the username, recovery code, and new password. A successful reset consumes the old code, issues a replacement, and revokes all sessions. Changing a password in Account settings also replaces the code and signs out all devices. Save the replacement before signing back in.

If both the password and code are lost, the server operator can verify the student's identity outside the app and issue a fresh one-use code on the SQLite deployment:

```sh
docker compose exec -T app node scripts/account-recovery.mjs student_username
```

This command revokes that account's sessions. Give the output only to the account owner. It requires server/database access and is not exposed through an HTTP endpoint. The CLI targets SQLite; it is not a D1 administration tool.

## Existing work and domain changes

Before clearing an old browser's cookies, create its account in that browser on the same deployment. Registration transfers the legacy browser's workbook ownership and memberships atomically; contributions, private checks, and review authors keep their existing member IDs. Existing accounts do not automatically merge a different browser's legacy identity during login.

Accounts live in the same database as the work. Changing domains on the same server/database only requires signing in again. A new server or the separate Sites deployment has a different database unless the host migrates it. This release does not provide a Sites/D1-to-SQLite data importer. Back up before upgrading; the authentication migration only adds tables.

## Implementation and checks

- Passwords use Node's native asynchronous scrypt with random salts and the OWASP-listed `N=16384, r=8, p=5` configuration. No passwords are stored in plaintext.
- Random 256-bit session tokens are stored only as SHA-256 digests. Cookies are HttpOnly, SameSite=Lax, scoped to `/`, and Secure on HTTPS. Sessions expire after 14 days and are revoked by logout, password change, or recovery. A credential version prevents a concurrent login from reviving old credentials after a reset.
- Invitation and recovery codes have 160 bits of entropy; only their digests are stored. Redemption uses database transactions and conditional writes to prevent reuse, including concurrent requests.
- Account mutations require the configured same origin. Persistent limits cap account attempts per username/action and globally; they do not trust client-supplied forwarding headers. The global limit is intentionally suited to a small private group, not a large public service.
- Workbook APIs require sign-in and retain their existing room membership and role ownership checks. Public health and mathematical verification pages do not expose workbook data.
- Unit tests cover passwords, invitation races, expiry/revocation, recovery, session invalidation, legacy migration, and throttling. Browser checks exercise host setup, invitations, another device, recovery, and draft protection.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), and [Cloudflare Node crypto support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).
