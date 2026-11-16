import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { colors } from './theme';
import {
  countBackupRows,
  createExportFile,
  createSafetySnapshot,
  getLatestSafetySnapshot,
  loadBackupFile,
  restoreBackup,
  type VentoryBackup,
} from './backup';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : 'Terjadi kesalahan tak dikenal.';

export function BackupRestorePanel() {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);

  const updateRecovery = useCallback(() => {
    try { setHasRecovery(Boolean(getLatestSafetySnapshot())); }
    catch (error) { console.warn('Tidak dapat membaca backup lokal', error); }
  }, []);

  useFocusEffect(useCallback(() => { updateRecovery(); }, [updateRecovery]));

  const exportData = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Fitur berbagi file tidak tersedia.');
      const file = await createExportFile(db);
      await Sharing.shareAsync(file.uri, { UTI: 'public.json' });
      Alert.alert(
        'Konfirmasi penyimpanan',
        'Jika sudah memilih “Simpan ke File” (Save to Files), periksa file .json di Files/iCloud Drive. Menutup lembar berbagi saja belum berarti backup tersimpan.'
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Gagal membuat backup', message(error));
    } finally { setBusy(false); }
  };

  const applyData = async (data: VentoryBackup) => {
    if (busy) return;
    setBusy(true);
    try {
      // If this fails, current SQLite data is left untouched.
      await createSafetySnapshot(db);
      await restoreBackup(db, data);
      updateRecovery();
      Alert.alert(
        'Restore berhasil',
        'Data produk, transaksi, dan pengeluaran telah diganti sesuai file backup. Cadangan kondisi sebelum restore tersimpan secara lokal untuk pemulihan, bukan di iCloud.'
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Restore dibatalkan', `${message(error)}\n\nJika transaksi database gagal, perubahan database di-rollback.`);
    } finally { setBusy(false); }
  };

  const confirmRestore = (data: VentoryBackup, label: string) => {
    const c = countBackupRows(data);
    Alert.alert(
      'Ganti seluruh data Ventory?',
      `Sumber: ${label}\nDibuat: ${new Date(data.exportedAt).toLocaleString('id-ID')}\n\n` +
      `Produk: ${c.products}\nTransaksi: ${c.sales}\nDetail transaksi: ${c.saleItems}\nPengeluaran: ${c.expenses}\n\n` +
      'PERINGATAN: Data saat ini akan DIGANTI, bukan digabung. Cadangan keselamatan otomatis akan dibuat di perangkat sebelum perubahan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ganti data', style: 'destructive', onPress: () => { void applyData(data); } },
      ]
    );
  };

  const importFromFiles = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', multiple: false, copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected || !selected.name.toLowerCase().endsWith('.json')) {
        throw new Error('Pilih file backup Ventory berformat .json.');
      }
      const data = await loadBackupFile(selected.uri, selected.size);
      // Clear loading state before displaying confirmation. Actual restore is separate.
      setBusy(false);
      confirmRestore(data, selected.name);
    } catch (error) {
      console.error(error);
      Alert.alert('Backup tidak dapat dibaca', message(error));
    } finally { setBusy(false); }
  };

  const recoverPrevious = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const file = getLatestSafetySnapshot();
      if (!file) throw new Error('Belum ada cadangan sebelum restore.');
      const data = await loadBackupFile(file.uri);
      setBusy(false);
      confirmRestore(data, 'cadangan otomatis sebelum restore');
    } catch (error) {
      console.error(error);
      Alert.alert('Tidak dapat memulihkan', message(error));
    } finally { setBusy(false); }
  };

  if (Platform.OS === 'web') {
    return <Text style={s.note}>Backup & Restore tersedia pada iOS/Android, bukan versi web.</Text>;
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Backup & Restore</Text>
      <Text style={s.description}>
        Simpan salinan produk, riwayat penjualan, dan pengeluaran ke Files/iCloud Drive.
      </Text>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => { void exportData(); }}
        style={({ pressed }: { pressed: boolean }) => [s.buttonPrimary, (pressed || busy) && s.dim]}>
        <Ionicons name="cloud-upload-outline" color="#fff" size={20} />
        <Text style={s.buttonPrimaryText}>{busy ? 'Memproses...' : 'Backup ke Files'}</Text>
      </Pressable>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => { void importFromFiles(); }}
        style={({ pressed }: { pressed: boolean }) => [s.buttonSecondary, (pressed || busy) && s.dim]}>
        <Ionicons name="download-outline" color={colors.primary} size={20} />
        <Text style={s.buttonSecondaryText}>Restore dari file JSON</Text>
      </Pressable>
      {hasRecovery && (
        <Pressable disabled={busy} accessibilityRole="button" onPress={() => { void recoverPrevious(); }}
          style={({ pressed }: { pressed: boolean }) => [s.buttonRecovery, (pressed || busy) && s.dim]}>
          <Ionicons name="time-outline" color="#9B6015" size={19} />
          <Text style={s.buttonRecoveryText}>Pulihkan kondisi sebelum restore terakhir</Text>
        </Pressable>
      )}
      <View style={s.warning}>
        <Ionicons name="shield-outline" size={18} color="#8A6023" />
        <Text style={s.warningText}>
          Restore akan mengganti seluruh data saat ini. Backup JSON tidak terenkripsi; simpan di tempat aman.
          Cadangan otomatis di dalam aplikasi ikut hilang jika data aplikasi dihapus.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF', borderColor: '#DEE7DD', borderWidth: 1,
    borderRadius: 18, padding: 18, marginTop: 18, marginBottom: 20,
  },
  title: { color: '#173B30', fontSize: 18, fontWeight: '800' },
  description: { color: '#718177', fontSize: 12, lineHeight: 20, marginTop: 8, marginBottom: 18 },
  buttonPrimary: {
    backgroundColor: '#17634D', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginBottom: 9,
  },
  buttonPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  buttonSecondary: {
    backgroundColor: '#EDF7F0', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginBottom: 9,
  },
  buttonSecondaryText: { color: '#17634D', fontWeight: '800', fontSize: 13 },
  buttonRecovery: {
    backgroundColor: '#FFF3E2', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  buttonRecoveryText: { color: '#9B6015', fontWeight: '700', fontSize: 12 },
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', marginTop: 18,
    backgroundColor: '#FFFAEF', borderRadius: 12, padding: 12, gap: 9,
  },
  warningText: { flex: 1, color: '#87652E', fontSize: 11, lineHeight: 18 },
  note: { color: '#718177', padding: 16 },
  dim: { opacity: 0.6 },
});
