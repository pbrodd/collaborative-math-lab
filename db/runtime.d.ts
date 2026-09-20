declare module '@lab/database-driver' {
  export function runtimeDatabase(): import('./types').Database;
}
