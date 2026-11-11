import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { Product } from '../features/dagangin/database';
import {
  formatRupiah, formatSaleTime, listAvailableProducts, listSales,
  saveSale, type SaleHistory,
} from '../features/dagangin/sales';
import { Header, Screen, SectionHeading } from '../features/dagangin/screen';
import { colors } from '../features/dagangin/theme';

export default function SalesScreen() {
  const db = useSQLiteContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<SaleHistory[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [productRows, saleRows] = await Promise.all([
        listAvailableProducts(db), listSales(db),
      ]);
      setProducts(productRows);
      setHistory(saleRows);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Gagal membaca data dari SQLite.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const shownProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const cartLines = useMemo(() => products
    .filter(product => (cart[product.id] ?? 0) > 0)
    .map(product => ({ product, quantity: cart[product.id] })),
  [products, cart]);

  const cartTotal = cartLines.reduce(
    (sum, line) => sum + line.quantity * line.product.selling_price, 0
  );
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  const changeQuantity = (product: Product, delta: number) => {
    setCart(prev => {
      const nextQty = Math.max(0, Math.min(product.stock, (prev[product.id] ?? 0) + delta));
      const next = { ...prev };
      if (nextQty === 0) delete next[product.id];
      else next[product.id] = nextQty;
      return next;
    });
  };

  const commitSale = async () => {
    if (savingRef.current) return;
    if (!cartLines.length) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const id = await saveSale(db, cartLines.map(({ product, quantity }) => ({
        productId: product.id, quantity,
      })));
      setCart({});
      await refresh();
      Alert.alert('Penjualan tersimpan', `Transaksi #${id} berhasil. Stok sudah diperbarui.`);
    } catch (err) {
      console.error(err);
      Alert.alert('Transaksi dibatalkan', err instanceof Error ? err.message : 'Gagal menyimpan penjualan.');
      // Bila satu item gagal, semua UPDATE stok dan INSERT penjualan di-rollback.
      await refresh();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmSale = () => {
    if (!cartLines.length || savingRef.current) return;
    if (Platform.OS === 'web') {
      Alert.alert('Belum tersedia', 'Pencatatan penjualan tahap ini ditujukan untuk Expo Go Android/iOS.');
      return;
    }
    Alert.alert(
      'Simpan transaksi?',
      `${itemCount} barang · ${formatRupiah(cartTotal)}\nStok akan langsung berkurang.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Simpan', onPress: () => { void commitSale(); } },
      ]
    );
  };

  return (
    <Screen>
      <Header title="Penjualan" subtitle="Catat transaksi. Stok otomatis berkurang setelah disimpan." />

      <View style={s.summary}>
        <Text style={s.summaryLabel}>Total keranjang</Text>
        <Text style={s.summaryAmount}>{formatRupiah(cartTotal)}</Text>
        <Text style={s.summaryNote}>{itemCount} barang · {cartLines.length} jenis produk</Text>
      </View>

      <SectionHeading title="Pilih produk" note={`${products.length} produk terdaftar`} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Cari nama atau SKU produk..."
        placeholderTextColor="#87968D"
        style={s.search}
      />
      {loading ? <Text style={s.muted}>Memuat produk...</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      {!loading && products.length === 0 ? (
        <Text style={s.empty}>Belum ada produk. Tambahkan terlebih dahulu melalui tab Produk.</Text>
      ) : null}
      {!loading && products.length > 0 && shownProducts.length === 0 ? (
        <Text style={s.empty}>Tidak ada produk yang cocok.</Text>
      ) : null}

      {shownProducts.map(product => {
        const qty = cart[product.id] ?? 0;
        return (
          <View key={product.id} style={s.productCard}>
            <View style={s.productMain}>
              <View style={s.productIcon}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
              </View>
              <View style={s.flex}>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.muted}>
                  {formatRupiah(product.selling_price)} · Stok {product.stock}
                </Text>
              </View>
            </View>
            <View style={s.qtyControls}>
              <Pressable
                accessibilityLabel={`Kurangi ${product.name}`}
                disabled={qty === 0 || saving}
                onPress={() => changeQuantity(product, -1)}
                style={[s.qtyButton, qty === 0 && s.disabled]}
              >
                <Ionicons name="remove" size={18} color={colors.primary} />
              </Pressable>
              <Text style={s.qtyNumber}>{qty}</Text>
              <Pressable
                accessibilityLabel={`Tambah ${product.name}`}
                disabled={qty >= product.stock || saving}
                onPress={() => changeQuantity(product, 1)}
                style={[s.qtyButton, qty >= product.stock && s.disabled]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <SectionHeading title="Keranjang" note={`${itemCount} barang`} />
      <View style={s.cartCard}>
        {cartLines.length === 0 ? (
          <Text style={s.empty}>Pilih produk di atas untuk mulai transaksi.</Text>
        ) : cartLines.map(({ product, quantity }) => (
          <View key={product.id} style={s.cartLine}>
            <Text style={s.cartName}>{product.name} ×{quantity}</Text>
            <Text style={s.cartPrice}>{formatRupiah(product.selling_price * quantity)}</Text>
          </View>
        ))}
        <View style={s.cartFooter}>
          <Text style={s.footerLabel}>Total pembayaran</Text>
          <Text style={s.footerValue}>{formatRupiah(cartTotal)}</Text>
        </View>
        <Pressable
          disabled={cartLines.length === 0 || saving || !!error || Platform.OS === 'web'}
          accessibilityRole="button"
          onPress={confirmSale}
          style={[s.saveButton, (cartLines.length === 0 || saving || !!error || Platform.OS === 'web') && s.disabled]}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={s.saveText}>{saving ? 'Menyimpan...' : 'Simpan penjualan'}</Text>
        </Pressable>
        <Text style={s.help}>Harga dan modal dicatat sesuai nilai produk saat transaksi dibuat.</Text>
      </View>

      <SectionHeading title="Riwayat transaksi" note="15 transaksi terakhir" />
      {history.length === 0 ? (
        <Text style={s.empty}>Belum ada penjualan tersimpan.</Text>
      ) : history.map(sale => (
        <View key={sale.id} style={s.historyCard}>
          <View style={s.historyHead}>
            <Text style={s.historyTitle}>Transaksi #{sale.id}</Text>
            <Text style={s.historyAmount}>{formatRupiah(sale.total_amount)}</Text>
          </View>
          <Text style={s.muted}>{formatSaleTime(sale.created_at)}</Text>
          <Text style={s.historyItems}>{sale.items_summary}</Text>
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  summary: { backgroundColor: '#103D31', borderRadius: 22, padding: 22, marginTop: 4 },
  summaryLabel: { color: '#C7DED2', fontSize: 12 },
  summaryAmount: { color: '#fff', fontWeight: '800', fontSize: 30, marginVertical: 12 },
  summaryNote: { color: '#B9DACB', fontSize: 12 },
  search: { borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, padding: 13, marginBottom: 12 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: '#A43B3B', paddingVertical: 12 },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 14 },
  productCard: { padding: 14, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: 9, gap: 12 },
  productMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  qtyControls: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 17 },
  qtyButton: { width: 34, height: 34, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5FAF5' },
  qtyNumber: { color: colors.ink, fontWeight: '700', fontSize: 15, minWidth: 15, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  cartCard: { backgroundColor: colors.surface, padding: 18, borderRadius: 19, borderWidth: 1, borderColor: colors.line },
  cartLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9 },
  cartName: { flex: 1, color: colors.ink, fontSize: 13 },
  cartPrice: { fontSize: 13, fontWeight: '700', color: colors.ink },
  cartFooter: { marginTop: 10, paddingTop: 15, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  footerLabel: { color: colors.muted, fontSize: 12 },
  footerValue: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  saveButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, backgroundColor: '#17634D', borderRadius: 13, padding: 16, marginTop: 18 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  help: { color: colors.muted, marginTop: 12, fontSize: 11, lineHeight: 18 },
  historyCard: { backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 15, marginBottom: 10 },
  historyHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  historyTitle: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  historyAmount: { color: '#17634D', fontWeight: '800', fontSize: 14 },
  historyItems: { color: colors.ink, fontSize: 12, marginTop: 8, lineHeight: 18 },
});
