/**
 * Adapter for the real SQLite engine included in Node.js 24.
 * Implements the expo-sqlite async surface used by Ventory.
 * Not a fake SQL query interpreter. In-memory DB per test.
 */
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase } from '../../src/features/ventory/database.ts';

function argsOf(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}
export function createAdapter(sqlite = new DatabaseSync(':memory:')) {
  const api = {
    raw: sqlite,
    execAsync(sql) { sqlite.exec(sql); return Promise.resolve(); },
    runAsync(sql, ...params) {
      const result = sqlite.prepare(sql).run(...argsOf(params));
      return Promise.resolve({ lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) });
    },
    getFirstAsync(sql, ...params) {
      return Promise.resolve(sqlite.prepare(sql).get(...argsOf(params)) ?? null);
    },
    getAllAsync(sql, ...params) {
      return Promise.resolve(sqlite.prepare(sql).all(...argsOf(params)));
    },
    async withExclusiveTransactionAsync(fn) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const output = await fn(api);
        sqlite.exec('COMMIT');
        return output;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close() { sqlite.close(); },
  };
  return api;
}

export async function createTestDB() {
  const db = createAdapter();
  await initializeDatabase(db);
  return db;
}

export async function insertProduct(db, {
  name = 'Beras 5kg', sku = 'BR-001', purchase_price = 60_000,
  selling_price = 75_000, stock = 20, min_stock = 5,
} = {}) {
  const row = await db.runAsync(
    `INSERT INTO products (name, sku, purchase_price, selling_price, stock, min_stock)
     VALUES (?, ?, ?, ?, ?, ?)`,
    name, sku, purchase_price, selling_price, stock, min_stock
  );
  return row.lastInsertRowId;
}

export async function first(db, sql, ...args) {
  return db.getFirstAsync(sql, ...args);
}
