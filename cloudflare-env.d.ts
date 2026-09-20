declare module 'cloudflare:workers' {
  export const env: { DB: import('./db').Database };
}
interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}
type D1Database = import('./db').Database;
