/**
 * Ventory Backup & Restore v1 (Expo Go, native iOS / Android).
 * JSON snapshots of the four existing SQLite tables.
 * No database-file copying: safe with SQLite WAL mode.
 * Restore: validate everything before using one exclusive transaction.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

export const BACKUP_FORMAT = 'ventory-sqlite-json';
export const BACKUP_VERSION = 1;
const MAX_TEXT_LENGTH = 12_000_000; // defensive bound for small-business MVP
const SAFETY_PREFIX = 'ventory-before-restore-';

type ProductRow = {
  id: number;
  name: string;
  sku: string | null;
  purchase_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
};

type SaleRow = {
  id: number;
  total_amount: number;
  gross_profit: number;
  created_at: number;
};

type SaleItemRow = {
  id: number;
  sale_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
};

type ExpenseRow = {
  id: number;
  category: string;
  amount: number;
  note: string;
  expense_date: string;
  created_at: number;
  updated_at: number;
};

export type VentoryBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  tables: {
    products: ProductRow[];
    sales: SaleRow[];
    sale_items: SaleItemRow[];
    expenses: ExpenseRow[];
  };
};

export type BackupCounts = {
  products: number;
  sales: number;
  saleItems: number;
  expenses: number;
};

export function countBackupRows(data: VentoryBackup): BackupCounts {
  return {
    products: data.tables.products.length,
    sales: data.tables.sales.length,
    saleItems: data.tables.sale_items.length,
    expenses: data.tables.expenses.length,
  };
}

/** A consistent snapshot across all 4 tables; never copy an open .db file in WAL mode. */
export async function collectBackup(db: SQLiteDatabase): Promise<VentoryBackup> {
  let tables: VentoryBackup['tables'] | null = null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const products = await tx.getAllAsync<ProductRow>('SELECT * FROM products ORDER BY id');
    const sales = await tx.getAllAsync<SaleRow>('SELECT * FROM sales ORDER BY id');
    const sale_items = await tx.getAllAsync<SaleItemRow>('SELECT * FROM sale_items ORDER BY id');
    const expenses = await tx.getAllAsync<ExpenseRow>('SELECT * FROM expenses ORDER BY id');
    tables = { products, sales, sale_items, expenses };
  });
  if (!tables) throw new Error('Gagal membaca data SQLite.');
  const backup: VentoryBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
  validateBackup(backup);
  return backup;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Backup tidak valid: ${message}`);
}

function text(value: unknown, label: string, max = 1000, allowEmpty = false): asserts value is string {
  assert(typeof value === 'string', `${label} harus teks.`);
  assert(value.length <= max, `${label} terlalu panjang.`);
  assert(allowEmpty || value.trim().length > 0, `${label} kosong.`);
}

function rowIds(rows: Record<string, unknown>[], label: string): Set<number> {
  const seen = new Set<number>();
  for (const row of rows) {
    assert(integer(row.id, 1), `ID ${label} tidak valid.`);
    assert(!seen.has(row.id), `ID ${label} ganda: ${row.id}`);
    seen.add(row.id);
  }
  return seen;
}

function validLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return y >= 2000 && y <= 2100 && date.getFullYear() === y &&
    date.getMonth() + 1 === m && date.getDate() === d;
}

/** Strict format, types, duplicate IDs/SKUs, references and transaction totals. */
export function validateBackup(input: unknown): VentoryBackup {
  assert(record(input), 'format JSON salah.');
  assert(input.format === BACKUP_FORMAT, 'file ini bukan backup Ventory.');
  assert(input.version === BACKUP_VERSION, 'versi backup belum didukung.');
  assert(typeof input.exportedAt === 'string' && !Number.isNaN(Date.parse(input.exportedAt)),
    'waktu ekspor tidak valid.');
  assert(record(input.tables), 'bagian tabel tidak ditemukan.');
  const t = input.tables;
  for (const key of ['products', 'sales', 'sale_items', 'expenses'] as const) {
    assert(Array.isArray(t[key]), `tabel ${key} tidak ditemukan.`);
    assert(t[key].length <= 50_000, `jumlah ${key} melebihi batas.`);
    for (const row of t[key]) assert(record(row), `ada baris ${key} tidak valid.`);
  }
  const products = t.products as Record<string, unknown>[];
  const sales = t.sales as Record<string, unknown>[];
  const saleItems = t.sale_items as Record<string, unknown>[];
  const expenses = t.expenses as Record<string, unknown>[];
  const productIds = rowIds(products, 'produk');
  const saleIds = rowIds(sales, 'penjualan');
  rowIds(saleItems, 'item penjualan');
  rowIds(expenses, 'pengeluaran');

  const skus = new Set<string>();
  for (const p of products) {
    text(p.name, 'nama produk');
    assert(p.sku === null || typeof p.sku === 'string', 'SKU tidak valid.');
    if (typeof p.sku === 'string') {
      text(p.sku, 'SKU', 100, true);
      assert(!skus.has(p.sku), 'SKU duplikat.');
      skus.add(p.sku);
    }
    for (const key of ['purchase_price', 'selling_price', 'stock', 'min_stock']) {
      assert(integer(p[key]), `nilai produk ${key} tidak valid.`);
    }
    text(p.created_at, 'created_at produk', 64);
    text(p.updated_at, 'updated_at produk', 64);
  }

  const totals = new Map<number, { total: number; profit: number; count: number }>();
  for (const s of sales) {
    assert(integer(s.total_amount), 'total penjualan tidak valid.');
    assert(typeof s.gross_profit === 'number' && Number.isSafeInteger(s.gross_profit),
      'laba kotor tidak valid.');
    assert(integer(s.created_at), 'tanggal penjualan tidak valid.');
    totals.set(s.id as number, { total: 0, profit: 0, count: 0 });
  }
  for (const item of saleItems) {
    assert(integer(item.sale_id, 1) && saleIds.has(item.sale_id),
      'item tanpa referensi transaksi.');
    assert(item.product_id === null ||
      (integer(item.product_id, 1) && productIds.has(item.product_id)),
      'referensi produk item tidak tersedia.');
    text(item.product_name, 'nama barang pada transaksi');
    assert(integer(item.quantity, 1), 'jumlah item tidak valid.');
    assert(integer(item.unit_price) && integer(item.unit_cost) && integer(item.line_total),
      'harga item tidak valid.');
    const expectedTotal = (item.quantity as number) * (item.unit_price as number);
    const expectedProfit = (item.quantity as number) *
      ((item.unit_price as number) - (item.unit_cost as number));
    assert(Number.isSafeInteger(expectedTotal) && item.line_total === expectedTotal,
      'total item tidak cocok dengan harga × jumlah.');
    const sum = totals.get(item.sale_id as number)!;
    sum.total += expectedTotal;
    sum.profit += expectedProfit;
    sum.count++;
    assert(Number.isSafeInteger(sum.total) && Number.isSafeInteger(sum.profit),
      'akumulasi penjualan terlalu besar.');
  }
  for (const sale of sales) {
    const sum = totals.get(sale.id as number)!;
    assert(sum.count > 0, 'ada transaksi tanpa item.');
    assert(sum.total === sale.total_amount && sum.profit === sale.gross_profit,
      'nominal transaksi tidak cocok dengan detailnya.');
  }

  for (const e of expenses) {
    text(e.category, 'kategori pengeluaran', 100);
    assert(integer(e.amount, 1), 'nominal pengeluaran tidak valid.');
    text(e.note, 'catatan pengeluaran', 200, true);
    text(e.expense_date, 'tanggal pengeluaran', 10);
    assert(validLocalDate(e.expense_date as string), 'tanggal pengeluaran tidak valid.');
    assert(integer(e.created_at) && integer(e.updated_at), 'waktu pengeluaran tidak valid.');
  }

  return input as unknown as VentoryBackup;
}

/** Parse with upper bound before JSON.parse to avoid huge untrusted files. */
export function parseBackupJson(source: string): VentoryBackup {
  assert(source.length <= MAX_TEXT_LENGTH, 'ukuran file melebihi batas 12 juta karakter.');
  let json: unknown;
  try {
    json = JSON.parse(source) as unknown;
  } catch {
    throw new Error('File JSON tidak dapat dibaca.');
  }
  return validateBackup(json);
}

export async function loadBackupFile(uri: string, knownSize?: number): Promise<VentoryBackup> {
  assert(knownSize === undefined || knownSize <= 12_000_000,
    'file terlalu besar (maksimal 12 MB).');
  const file = new File(uri);
  assert(file.exists, 'file tidak ditemukan.');
  assert(file.size <= 12_000_000, 'file terlalu besar (maksimal 12 MB).');
  return parseBackupJson(await file.text());
}

function uniqueFileName(prefix: string): string {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}${date}-${suffix}.json`;
}

async function writeBackup(
  db: SQLiteDatabase,
  dir: Directory,
  prefix: string
): Promise<File> {
  const payload = await collectBackup(db);
  const json = JSON.stringify(payload, null, 2);
  assert(json.length <= MAX_TEXT_LENGTH, 'data terlalu besar untuk ekspor JSON versi ini.');
  const file = new File(dir, uniqueFileName(prefix));
  file.create();
  try {
    await file.write(json);
  } catch (error) {
    try { file.delete(); } catch { /* best effort cleanup */ }
    throw error;
  }
  return file;
}

/** Temporary exported file. User must explicitly select Save to Files / iCloud. */
export async function createExportFile(db: SQLiteDatabase): Promise<File> {
  return writeBackup(db, Paths.cache, 'ventory-backup-');
}

/** Recovery snapshot created automatically before any destructive restore. */
export async function createSafetySnapshot(db: SQLiteDatabase): Promise<File> {
  return writeBackup(db, Paths.document, SAFETY_PREFIX);
}

/** Latest local recovery snapshot; remains inside app sandbox, not iCloud backup. */
export function getLatestSafetySnapshot(): File | null {
  const candidates = Paths.document.list()
    .filter((entry): entry is File => entry instanceof File)
    .filter(file => file.name.startsWith(SAFETY_PREFIX) && file.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name));
  return candidates[0] ?? null;
}

/** Replace, never merge; all deletes + inserts + consistency checks in one transaction. */
export async function restoreBackup(db: SQLiteDatabase, input: VentoryBackup): Promise<void> {
  const backup = validateBackup(input);
  const { products, sales, sale_items, expenses } = backup.tables;
  await db.withExclusiveTransactionAsync(async (tx) => {
    // Child first. Works also when foreign_keys is ON for the transaction connection.
    await tx.runAsync('DELETE FROM sale_items');
    await tx.runAsync('DELETE FROM sales');
    await tx.runAsync('DELETE FROM expenses');
    await tx.runAsync('DELETE FROM products');

    for (const p of products) {
      await tx.runAsync(
        `INSERT INTO products
          (id, name, sku, purchase_price, selling_price, stock, min_stock, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.sku, p.purchase_price, p.selling_price, p.stock,
          p.min_stock, p.created_at, p.updated_at]
      );
    }
    for (const s of sales) {
      await tx.runAsync(
        `INSERT INTO sales (id, total_amount, gross_profit, created_at) VALUES (?, ?, ?, ?)`,
        [s.id, s.total_amount, s.gross_profit, s.created_at]
      );
    }
    for (const item of sale_items) {
      await tx.runAsync(
        `INSERT INTO sale_items
          (id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.sale_id, item.product_id, item.product_name,
          item.quantity, item.unit_price, item.unit_cost, item.line_total]
      );
    }
    for (const e of expenses) {
      await tx.runAsync(
        `INSERT INTO expenses
          (id, category, amount, note, expense_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.category, e.amount, e.note, e.expense_date, e.created_at, e.updated_at]
      );
    }
    // FK enforcement may differ on exclusive tx connection; always check explicitly.
    const fkProblems = await tx.getAllAsync('PRAGMA foreign_key_check');
    if (fkProblems.length) throw new Error('Referensi data tidak konsisten; restore dibatalkan.');
    for (const [table, expected] of [
      ['products', products.length],
      ['sales', sales.length],
      ['sale_items', sale_items.length],
      ['expenses', expenses.length],
    ] as const) {
      const check = await tx.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`);
      if (check?.c !== expected) throw new Error(`Jumlah baris ${table} tidak cocok; restore dibatalkan.`);
    }
  });
}
