import { useCallback, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Header, Screen, SectionHeading } from '../features/ventory/screen';
import { colors } from '../features/ventory/theme';
import { formatRupiah } from '../features/ventory/sales';
import {
  deleteExpense, EXPENSE_CATEGORIES, getFinancialReport,
  isValidDateKey, localDateKey, saveExpense,
  type Expense, type ExpenseCategory, type FinancialReport, type ReportPeriod,
} from '../features/ventory/finance';

type Draft = {
  category: ExpenseCategory;
  amount: string;
  note: string;
  expense_date: string;
};

const emptyDraft = (): Draft => ({
  category: 'Operasional', amount: '', note: '', expense_date: localDateKey(new Date()),
});

const periods: { key: ReportPeriod; title: string }[] = [
  { key: 'today', title: 'Hari ini' },
  { key: 'week', title: '7 hari' },
  { key: 'month', title: 'Bulan ini' },
];

function MiniStat({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{title}</Text>
      <Text style={s.statValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {subtitle ? <Text style={s.statNote}>{subtitle}</Text> : null}
    </View>
  );
}

function ExpenseRow({ item, onEdit, onDelete }: {
  item: Expense;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={s.expenseCard}>
      <View style={s.expenseTop}>
        <View style={s.expenseIcon}><Ionicons name="wallet-outline" size={18} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.expenseTitle}>{item.category}</Text>
          <Text style={s.muted}>{item.expense_date}</Text>
        </View>
        <Text style={s.expenseAmount}>−{formatRupiah(item.amount)}</Text>
      </View>
      {item.note ? <Text style={s.expenseNote}>{item.note}</Text> : null}
      <View style={s.expenseActions}>
        <Pressable accessibilityRole="button" onPress={onEdit} style={s.smallButton}>
          <Ionicons name="pencil-outline" color={colors.primary} size={15} />
          <Text style={s.smallButtonLabel}>Edit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDelete} style={s.smallButton}>
          <Ionicons name="trash-outline" color="#B44848" size={15} />
          <Text style={[s.smallButtonLabel, { color: '#B44848' }]}>Hapus</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TrendChart({ report }: { report: FinancialReport }) {
  const maxValue = Math.max(1, ...report.trend.flatMap((row) => [row.revenue, row.expenses]));
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>Tren 7 hari terakhir</Text>
      <View style={s.legend}>
        <View style={s.legendGroup}><View style={[s.legendSwatch, { backgroundColor: '#17634D' }]} /><Text style={s.legendText}>Penjualan</Text></View>
        <View style={s.legendGroup}><View style={[s.legendSwatch, { backgroundColor: '#E8B75B' }]} /><Text style={s.legendText}>Pengeluaran</Text></View>
      </View>
      <View style={s.bars}>
        {report.trend.map((day) => (
          <View key={day.day} style={s.dayCol}>
            <View style={s.barPair}>
              <View style={[s.bar, {
                height: day.revenue === 0 ? 3 : Math.max(5, Math.round(day.revenue / maxValue * 94)),
                backgroundColor: '#17634D',
              }]} />
              <View style={[s.bar, {
                height: day.expenses === 0 ? 3 : Math.max(5, Math.round(day.expenses / maxValue * 94)),
                backgroundColor: '#E8B75B',
              }]} />
            </View>
            <Text style={s.dayLabel}>{day.day.slice(8)}</Text>
          </View>
        ))}
      </View>
      <Text style={s.chartFootnote}>Angka di bawah batang adalah tanggal. Grafik selalu menunjukkan 7 hari terakhir.</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const db = useSQLiteContext();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getFinancialReport(db, period);
      setReport(next);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat laporan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [db, period]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void refresh();
  }, [refresh]));

  const newExpense = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const editExpense = (item: Expense) => {
    setEditingId(item.id);
    setDraft({
      category: EXPENSE_CATEGORIES.includes(item.category as ExpenseCategory)
        ? item.category as ExpenseCategory : 'Lainnya',
      amount: String(item.amount),
      note: item.note,
      expense_date: item.expense_date,
    });
    setModalOpen(true);
  };

  const persist = async () => {
    if (savingRef.current) return;
    if (!/^\d+$/.test(draft.amount.trim())) {
      Alert.alert('Nominal tidak valid', 'Masukkan jumlah rupiah tanpa titik atau koma, misalnya 15000.');
      return;
    }
    const amount = Number(draft.amount.trim());
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      Alert.alert('Nominal tidak valid', 'Nominal harus lebih dari nol.');
      return;
    }
    if (!isValidDateKey(draft.expense_date.trim())) {
      Alert.alert('Tanggal tidak valid', 'Gunakan format YYYY-MM-DD, misalnya 2026-11-12.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await saveExpense(db, {
        category: draft.category,
        amount,
        note: draft.note,
        expense_date: draft.expense_date.trim(),
      }, editingId);
      setModalOpen(false);
      await refresh();
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal menyimpan', err instanceof Error ? err.message : 'Pengeluaran gagal disimpan.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = (item: Expense) => {
    Alert.alert('Hapus pengeluaran?', `${item.category} · ${formatRupiah(item.amount)}`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive', onPress: () => {
          void (async () => {
            try { await deleteExpense(db, item.id); await refresh(); }
            catch (err) {
              console.error(err);
              Alert.alert('Gagal', 'Pengeluaran belum berhasil dihapus.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Laporan usaha" subtitle="Pantau penjualan, laba, dan pengeluaran dari data aktual." />
      <View style={s.periods}>
        {periods.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => setPeriod(item.key)}
            style={[s.periodButton, item.key === period && s.periodActive]}
          >
            <Text style={[s.periodText, item.key === period && s.periodTextActive]}>{item.title}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Text style={s.muted}>Memuat laporan...</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {report ? (
        <>
          <View style={s.hero}>
            <Text style={s.heroLabel}>Estimasi laba operasional · {report.label}</Text>
            <Text style={s.heroValue} adjustsFontSizeToFit numberOfLines={1}>
              {formatRupiah(report.operatingProfit)}
            </Text>
            <Text style={s.heroSub}>Laba kotor − pengeluaran operasional</Text>
          </View>

          <View style={s.statGrid}>
            <MiniStat title="Omzet" value={formatRupiah(report.revenue)} subtitle={`${report.transactions} transaksi`} />
            <MiniStat title="HPP terjual" value={formatRupiah(report.costOfGoodsSold)} subtitle={`${report.unitsSold} unit terjual`} />
            <MiniStat title="Laba kotor" value={formatRupiah(report.grossProfit)} />
            <MiniStat title="Pengeluaran" value={formatRupiah(report.operationalExpenses)} subtitle={`${report.expensesCount} catatan`} />
          </View>

          <TrendChart report={report} />
          <SectionHeading title="Pengeluaran per kategori" note={report.label} />
          {report.expenseCategories.length ? (
            <View style={s.categoryCard}>
              {report.expenseCategories.map((item) => (
                <View key={item.category} style={s.categoryRow}>
                  <Text style={s.categoryName}>{item.category}</Text>
                  <Text style={s.categoryAmount}>{formatRupiah(item.total)}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={s.empty}>Belum ada pengeluaran pada periode ini.</Text>}
        </>
      ) : null}

      <View style={s.expensesHeading}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Catatan pengeluaran</Text>
          <Text style={s.muted}>Sesuai periode laporan yang dipilih</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={newExpense} style={s.addButton}>
          <Ionicons name="add" color="#FFFFFF" size={18} />
          <Text style={s.addLabel}>Tambah</Text>
        </Pressable>
      </View>

      {report?.recentExpenses.length === 0 && !loading ? (
        <Text style={s.empty}>Belum ada catatan. Tekan Tambah untuk mencatat biaya pertama.</Text>
      ) : null}
      {report?.recentExpenses.map((item) => (
        <ExpenseRow key={item.id} item={item} onEdit={() => editExpense(item)} onDelete={() => confirmDelete(item)} />
      ))}
      {(report?.expensesCount ?? 0) > 100 ? (
        <Text style={s.muted}>Menampilkan 100 pengeluaran terbaru. Ringkasan tetap menghitung seluruh pengeluaran dalam periode ini.</Text>
      ) : null}
      <Text style={s.footer}>
        Perkiraan laba operasional belum memperhitungkan pajak, retur, diskon, piutang, atau penyesuaian lain. Pembelian barang untuk dijual kembali sudah dihitung melalui HPP ketika terjual; jangan catat lagi sebagai biaya operasional agar tidak terjadi perhitungan ganda.
      </Text>

      <Modal transparent visible={modalOpen} animationType="slide" onRequestClose={() => { if (!saving) setModalOpen(false); }}>
        <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.sheetTitle}>{editingId === null ? 'Tambah Pengeluaran' : 'Edit Pengeluaran'}</Text>
              <Text style={s.fieldTitle}>Kategori</Text>
              <View style={s.categoryChips}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    onPress={() => setDraft((old) => ({ ...old, category }))}
                    style={[s.chip, draft.category === category && s.chipActive]}
                  >
                    <Text style={[s.chipText, draft.category === category && s.chipTextActive]}>{category}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldTitle}>Nominal (Rp)</Text>
              <TextInput
                style={s.input} value={draft.amount}
                onChangeText={(amount) => setDraft((old) => ({ ...old, amount }))}
                placeholder="Contoh: 15000" placeholderTextColor="#89988F"
                keyboardType="number-pad" />
              <Text style={s.fieldTitle}>Tanggal (YYYY-MM-DD)</Text>
              <TextInput
                style={s.input} value={draft.expense_date}
                onChangeText={(expense_date) => setDraft((old) => ({ ...old, expense_date }))}
                placeholder="2026-11-12" placeholderTextColor="#89988F"
                autoCapitalize="none" keyboardType="numbers-and-punctuation" />
              <Text style={s.fieldTitle}>Keterangan (opsional)</Text>
              <TextInput
                style={[s.input, s.noteInput]}
                multiline maxLength={200}
                value={draft.note}
                onChangeText={(note) => setDraft((old) => ({ ...old, note }))}
                placeholder="Contoh: Biaya listrik kios" placeholderTextColor="#89988F" />
              <Pressable
                accessibilityRole="button" disabled={saving}
                onPress={() => { void persist(); }}
                style={[s.save, saving && { opacity: 0.5 }]}
              >
                <Text style={s.saveText}>{saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}</Text>
              </Pressable>
              <Pressable disabled={saving} accessibilityRole="button" onPress={() => setModalOpen(false)} style={s.cancel}>
                <Text style={s.cancelText}>Batal</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodButton: { flex: 1, paddingVertical: 12, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  periodActive: { backgroundColor: '#17634D', borderColor: '#17634D' },
  periodText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  periodTextActive: { color: '#FFFFFF' },
  hero: { backgroundColor: '#113D31', borderRadius: 22, padding: 23, marginBottom: 14 },
  heroLabel: { fontSize: 12, color: '#CDE1D5' },
  heroValue: { fontSize: 29, fontWeight: '900', color: '#FFFFFF', marginTop: 15, marginBottom: 8 },
  heroSub: { fontSize: 11, color: '#CDE1D5' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  stat: { width: '48.5%', minHeight: 103, padding: 14, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 11 },
  statNote: { color: colors.muted, fontSize: 10, marginTop: 5 },
  chartCard: { backgroundColor: colors.surface, marginTop: 14, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 17 },
  chartTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  legend: { flexDirection: 'row', gap: 15, marginTop: 12 },
  legendGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { height: 9, width: 9, borderRadius: 3 },
  legendText: { fontSize: 10, color: colors.muted },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, height: 112 },
  dayCol: { flex: 1, alignItems: 'center' },
  barPair: { height: 95, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { width: 11, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dayLabel: { color: colors.muted, fontSize: 10, marginTop: 6 },
  chartFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 14 },
  categoryCard: { borderRadius: 16, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  categoryRow: { paddingVertical: 9, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderBottomColor: '#EDF0EB', borderBottomWidth: StyleSheet.hairlineWidth },
  categoryName: { color: colors.ink, fontSize: 12, flex: 1 },
  categoryAmount: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  expensesHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 13, gap: 12 },
  sectionTitle: { fontSize: 17, color: colors.ink, fontWeight: '800' },
  addButton: { backgroundColor: '#17634D', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 11 },
  addLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  expenseCard: { backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
  expenseTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expenseIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E9F3EB', alignItems: 'center', justifyContent: 'center' },
  expenseTitle: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  expenseAmount: { color: '#B44848', fontWeight: '800', fontSize: 13 },
  expenseNote: { color: colors.ink, fontSize: 12, marginTop: 9, lineHeight: 19 },
  expenseActions: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end', marginTop: 11 },
  smallButton: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4 },
  smallButtonLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  error: { color: '#B44848', marginTop: 10 },
  empty: { color: colors.muted, fontSize: 12, paddingVertical: 16, lineHeight: 19 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 20, marginBottom: 10 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.46)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 27, backgroundColor: '#F5F7F1' },
  sheetTitle: { fontSize: 21, fontWeight: '900', color: colors.ink, marginBottom: 20 },
  fieldTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 10, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: '#17634D', borderColor: '#17634D' },
  chipText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: '#DCE5DA', borderRadius: 11, padding: 13, color: colors.ink, backgroundColor: '#FFFFFF', fontSize: 14 },
  noteInput: { minHeight: 76, textAlignVertical: 'top' },
  save: { backgroundColor: '#17634D', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 22 },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '700' },
});
