// An explicit public origin lets HTTPS proxies forward to plain HTTP internally
// without weakening cookie security or trusting arbitrary forwarded headers.
export function applicationOrigin(requestUrl: string, configured = process.env.APP_ORIGIN): string {
  if (!configured) return new URL(requestUrl).origin;
  const url = new URL(configured);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('APP_ORIGIN must be an HTTP(S) origin, such as https://math.example.org.');
  }
  return url.origin;
}
