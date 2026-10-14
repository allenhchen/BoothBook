import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';

export function loadTypeScript(file, imports = {}) {
  const module = {exports: {}};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name) {
      if (!(name in imports)) throw new Error(`Missing test import: ${name}`);
      return imports[name];
    },
    crypto, Response, URL, console, Error,
  }, {filename: file});
  return module.exports;
}

// SQLite implements the same prepare/bind/batch surface used by D1 handlers.
export function createTestDatabase({onRead = () => {}, onWrite = () => {}} = {}) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync('drizzle/' + file, 'utf8'));
  }
  const db = {
    prepare(sql) {
      return {bind(...args) {
        return {
          async run() {onWrite(sql); return {meta: {changes: sqlite.prepare(sql).run(...args).changes}};},
          async all() {onRead(sql); return {results: sqlite.prepare(sql).all(...args)};},
          async first() {onRead(sql); return sqlite.prepare(sql).get(...args) || null;},
        };
      }};
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return {sqlite, db};
}
