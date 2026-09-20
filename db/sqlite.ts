import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Database, Statement, SqlResult } from './types.ts';

// Implements the D1 subset used by the application. A batch is one synchronous
// SQLite transaction: no other request can interleave between its statements.
export function openSqlite(path: string): Database & { close(): void } {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  const operations = new WeakMap<Statement, () => SqlResult>();

  function prepare(sql: string, values: SQLInputValue[] = []): Statement {
    function execute(): SqlResult {
      const query = sqlite.prepare(sql);
      if (query.columns().length) return { results: query.all(...values), meta: { changes: 0 } };
      const result = query.run(...values);
      return { results: [], meta: { changes: Number(result.changes) } };
    }
    const statement: Statement = {
      bind(...input) {
        const bound = input.map((value): SQLInputValue => {
          if (value === null || typeof value === 'string' || typeof value === 'bigint')
            return value;
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          throw new TypeError('SQL parameters must be strings, finite numbers, bigints, or null.');
        });
        return prepare(sql, bound);
      },
      async first<T>() {
        return (sqlite.prepare(sql).get(...values) as T | undefined) ?? null;
      },
      async all<T>() {
        return { results: sqlite.prepare(sql).all(...values) as T[], meta: { changes: 0 } };
      },
      async run() {
        return execute();
      },
    };
    operations.set(statement, execute);
    return statement;
  }
  return {
    prepare,
    async batch(statements) {
      const execute = statements.map((statement) => {
        const operation = operations.get(statement);
        if (!operation) throw new TypeError('A batch must use statements from this database.');
        return operation;
      });
      if (!execute.length) return [];
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = execute.map((operation) => operation());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      sqlite.close();
    },
  };
}

let database: ReturnType<typeof openSqlite> | undefined;
export function runtimeDatabase(): Database {
  return (database ??= openSqlite(process.env.DATABASE_PATH || './data/math-lab.sqlite'));
}
