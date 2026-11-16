import test from 'node:test';
import assert from 'node:assert/strict';
import { toUserFacingMessage } from '../src/features/ventory/error-message.ts';

test('validasi stok dan file backup tampil jelas tanpa raw internals', () => {
  assert.match(toUserFacingMessage(new Error('Stok Beras tidak cukup (tersisa 1).'), 'sale'), /Stok Beras/);
  assert.match(toUserFacingMessage(new Error('Backup tidak valid: SKU duplikat.'), 'backup'), /SKU duplikat/);
  assert.match(toUserFacingMessage(new Error('SQLITE_BUSY: database is locked'), 'expense'), /Database sedang digunakan/);
  assert.equal(toUserFacingMessage(new Error('SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: products.sku')), 'SKU tersebut sudah digunakan oleh produk lain.');
});

test('pesan exception internal tidak dibocorkan ke pengguna', () => {
  const msg = toUserFacingMessage(new Error('SQLITE_CORRUPT internal path /Users/example/finance.db'), 'backup');
  assert.doesNotMatch(msg, /SQLITE_CORRUPT|Users|finance.db/);
  assert.match(msg, /Backup|restore/);
  assert.match(toUserFacingMessage({}, 'sale'), /Penjualan/);
});
