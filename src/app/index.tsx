import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Screen, SectionHeading } from '../features/dagangin/screen';
import { colors } from '../features/dagangin/theme';
import {
  formatRupiah, formatSaleTime, getDashboardStats,
  type DashboardStats,
} from '../features/dagangin/sales';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getDashboardStats(db)
      .then(data => { if (active) { setStats(data); setError(null); } })
      .catch(err => { console.error(err); if (active) setError('Gagal memuat ringkasan usaha.'); });
    return () => { active = false; };
  }, [db]));

  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long',
  }).toUpperCase();

  return (
    <Screen>
      <View style={s.brandRow}>
        <View style={s.brandLeft}>
          <View style={s.logo}><Text style={s.logoText}>d.</Text></View>
          <Text style={s.brand}>dagangin.</Text>
        </View>
        <View style={s.liveBadge}><Text style={s.liveBadgeText}>DATA AKTUAL</Text></View>
      </View>

      <Text style={s.date}>{today}</Text>
      <Text style={s.headline}>Usaha rapi,{"\n"}pikiran tenang.</Text>
      <Text style={s.subtitle}>Mari lihat kabar usaha Anda hari ini.</Text>

      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <Text style={s.heroLabel}>Penjualan hari ini</Text>
          <Text style={s.heroPeriod}>Hari ini</Text>
        </View>
        <Text style={s.heroAmount}>
          {stats ? formatRupiah(stats.todayRevenue) : 'Memuat...'}
        </Text>
        <View style={s.heroBottom}>
          <Text style={s.heroDetail}>
            ●  {stats?.todayTransactions ?? 0} transaksi tercatat
          </Text>
          <Ionicons name="trending-up-outline" color="#D7E9A2" size={25} />
        </View>
      </View>

      <View style={s.actions}>
        <Pressable style={s.primaryAction} accessibilityRole="button" onPress={() => router.navigate('/penjualan')}>
          <Ionicons name="add-circle-outline" color="#fff" size={19} />
          <Text style={s.primaryText}>Penjualan</Text>
        </Pressable>
        <Pressable style={s.secondaryAction} accessibilityRole="button" onPress={() => router.navigate('/produk')}>
          <Ionicons name="cube-outline" color={colors.primary} size={19} />
          <Text style={s.secondaryText}>Lihat stok</Text>
        </Pressable>
      </View>

      <View style={s.grid}>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Laba kotor hari ini</Text>
          <Text style={s.metricValue}>{formatRupiah(stats?.todayGrossProfit ?? 0)}</Text>
          <Text style={s.metricNote}>Omzet dikurangi modal barang terjual</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Transaksi hari ini</Text>
          <Text style={s.metricValue}>{stats?.todayTransactions ?? 0}</Text>
          <Text style={s.metricNote}>{stats?.todayUnits ?? 0} unit terjual</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Produk terdaftar</Text>
          <Text style={s.metricValue}>{stats?.allProducts ?? 0}</Text>
          <Text style={s.metricNote}>Data tersimpan lokal</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricLabel}>Stok rendah</Text>
          <Text style={s.metricValue}>{stats?.lowStockCount ?? 0}</Text>
          <Text style={s.metricNote}>Stok ≤ batas minimum</Text>
        </View>
      </View>

      <View style={s.inventoryInfo}>
        <Ionicons name="layers-outline" size={19} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.inventoryLabel}>Nilai persediaan (harga beli)</Text>
          <Text style={s.inventoryAmount}>{formatRupiah(stats?.inventoryCost ?? 0)}</Text>
        </View>
      </View>

      <SectionHeading title="Perlu diperhatikan" note="Stok rendah" />
      {(stats?.lowStockProducts.length ?? 0) === 0 ? (
        <Text style={s.empty}>Belum ada produk dengan stok rendah.</Text>
      ) : stats?.lowStockProducts.map(product => (
        <Pressable key={product.id} onPress={() => router.navigate('/produk')} style={s.notice}>
          <Ionicons name="alert-circle-outline" color="#AA6C1E" size={20} />
          <Text style={s.noticeText}>{product.name}</Text>
          <Text style={s.noticeQty}>Sisa {product.stock}</Text>
          <Ionicons name="chevron-forward" size={15} color="#AA6C1E" />
        </Pressable>
      ))}

      <SectionHeading title="Penjualan terbaru" note="5 transaksi" />
      {(stats?.recentSales.length ?? 0) === 0 ? (
        <Text style={s.empty}>Belum ada riwayat transaksi.</Text>
      ) : stats?.recentSales.map(sale => (
        <View key={sale.id} style={s.saleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.saleTitle}>Transaksi #{sale.id}</Text>
            <Text style={s.saleDate}>{formatSaleTime(sale.created_at)}</Text>
          </View>
          <Text style={s.saleAmount}>{formatRupiah(sale.total_amount)}</Text>
        </View>
      ))}
      <Text style={s.disclaimer}>
        Laba yang ditampilkan adalah laba kotor; biaya operasional belum dihitung.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 29 },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#DAE9A8', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '900', color: '#163D30' },
  brand: { fontSize: 21, fontWeight: '900', color: colors.ink, letterSpacing: -1 },
  liveBadge: { paddingHorizontal: 9, paddingVertical: 7, borderColor: '#D8E5D4', borderWidth: 1, borderRadius: 8 },
  liveBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 9, letterSpacing: 1 },
  date: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, color: colors.muted, marginBottom: 14 },
  headline: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 37 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 23 },
  error: { color: '#AA3333', marginBottom: 10 },
  hero: { backgroundColor: '#113D31', borderRadius: 23, padding: 23, minHeight: 170, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: '#DDE9E1', fontSize: 12 },
  heroPeriod: { backgroundColor: '#2D5849', color: '#E6F4E9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, fontSize: 10 },
  heroAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginVertical: 19 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroDetail: { color: '#C5DBCF', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 19 },
  primaryAction: { backgroundColor: '#17634D', flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 13, paddingVertical: 15, gap: 9 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  secondaryAction: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 13, paddingVertical: 15, gap: 9 },
  secondaryText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  metric: { width: '48.8%', minHeight: 125, padding: 16, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricValue: { color: colors.ink, fontWeight: '900', fontSize: 18, marginTop: 16, marginBottom: 5 },
  metricNote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  inventoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 12, borderRadius: 17, padding: 16, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface },
  inventoryLabel: { fontSize: 11, color: colors.muted },
  inventoryAmount: { fontWeight: '800', fontSize: 17, color: colors.ink, marginTop: 5 },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 19, paddingVertical: 14 },
  notice: { backgroundColor: '#FFF9E9', borderWidth: 1, borderColor: '#F0E3BD', borderRadius: 12, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  noticeText: { color: colors.ink, fontSize: 12, fontWeight: '700', flex: 1 },
  noticeQty: { color: '#A66B1F', fontSize: 11, fontWeight: '700' },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 14, backgroundColor: colors.surface, marginBottom: 9 },
  saleTitle: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  saleDate: { color: colors.muted, fontSize: 11, marginTop: 5 },
  saleAmount: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 18 },
});
