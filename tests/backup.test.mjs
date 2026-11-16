import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDB, insertProduct, first } from './helpers/sqlite-adapter.mjs';
import { saveSale } from '../src/features/ventory/sales.ts';
import { saveExpense, localDateKey } from '../src/features/ventory/finance.ts';
import {
  BACKUP_VERSION, collectBackup, countBackupRows, parseBackupJson,
  restoreBackup, validateBackup,
} from '../src/features/ventory/backup.ts';

async function filledDB() {
  const db = await createTestDB();
  const productId = await insertProduct(db);
  await saveSale(db, [{ productId, quantity: 2 }]);
  await saveExpense(db, {
    category: 'Operasional', amount: 5_000, note: 'Parkir', expense_date: localDateKey(new Date()),
  });
  return db;
}

const clone = (value) => JSON.parse(JSON.stringify(value));

test('backup mengandung 4 tabel yang konsisten, dapat diparse ulang', async () => {
  const db = await filledDB();
  try {
    const exported = await collectBackup(db);
    assert.equal(exported.version, BACKUP_VERSION);
    assert.deepEqual(countBackupRows(exported), {
      products: 1, sales: 1, saleItems: 1, expenses: 1,
    });
    assert.deepEqual(parseBackupJson(JSON.stringify(exported)), JSON.parse(JSON.stringify(exported)));
  } finally { db.close(); }
});

test('restore mengganti data, ID, stok, transaksi, pengeluaran secara atomik', async () => {
  const db = await filledDB();
  try {
    const backup = await collectBackup(db);
    await db.runAsync('UPDATE products SET stock = 99');
    await db.runAsync('DELETE FROM expenses');
    await restoreBackup(db, backup);
    assert.equal((await first(db, 'SELECT stock FROM products')).stock, 18);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM expenses')).n, 1);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sale_items')).n, 1);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sales')).n, 1);
    assert.deepEqual((await collectBackup(db)).tables, backup.tables);
  } finally { db.close(); }
});

test('backup yang diubah totalnya, SKU duplikat atau FK rusak ditolak sebelum restore', async () => {
  const db = await filledDB();
  try {
    const original = await collectBackup(db);
    const tampered = clone(original);
    tampered.tables.sales[0].total_amount += 1;
    assert.throws(() => validateBackup(tampered), /nominal transaksi/);
    const duplicate = clone(original);
    duplicate.tables.products.push({ ...duplicate.tables.products[0], id: 9 });
    assert.throws(() => validateBackup(duplicate), /SKU duplikat/);
    const broken = clone(original);
    broken.tables.sale_items[0].sale_id = 9999;
    assert.throws(() => validateBackup(broken), /item tanpa referensi/);
    const badVersion = clone(original);
    badVersion.version = 99;
    assert.throws(() => validateBackup(badVersion), /versi backup/);
    assert.throws(() => parseBackupJson('{not json'), /JSON/);
    assert.equal((await first(db, 'SELECT stock FROM products')).stock, 18);
  } finally { db.close(); }
});

test('restore gagal pada INSERT SQL: seluruh delete/insert di-rollback', async () => {
  const db = await filledDB();
  try {
    const source = await collectBackup(db);
    await db.runAsync('UPDATE products SET stock = 6');
    await db.execAsync(`CREATE TRIGGER stop_restore BEFORE INSERT ON products
      BEGIN SELECT RAISE(ABORT, 'restore failure'); END;`);
    await assert.rejects(restoreBackup(db, source), /restore failure/);
    assert.equal((await first(db, 'SELECT stock FROM products')).stock, 6);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sales')).n, 1);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM expenses')).n, 1);
  } finally { db.close(); }
});
