import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Card, DemoLabel, Header, Screen, SectionHeading } from '../features/ventory/screen';
import { colors } from '../features/ventory/theme';
export default function MoreScreen() {
  return <Screen><Header title="Ruang usaha Anda" subtitle="Pengeluaran, profil, dan pengaturan dalam satu tempat." /><Card><View style={s.profile}><View style={s.avatar}><Text style={s.initial}>US</Text></View><View><Text style={s.name}>Usaha Saya</Text><Text style={s.caption}>Pemilik usaha · Data contoh</Text></View></View></Card><SectionHeading title="Modul berikutnya" /><Card><View style={s.row}><Ionicons name="wallet-outline" size={22} color={colors.primary} /><View style={s.text}><Text style={s.label}>Pengeluaran</Text><Text style={s.description}>Pencatatan biaya operasional</Text></View><Text style={s.badge}>Berikutnya</Text></View><View style={[s.row, s.border]}><Ionicons name="settings-outline" size={22} color={colors.primary} /><View style={s.text}><Text style={s.label}>Pengaturan</Text><Text style={s.description}>Profil dan preferensi usaha</Text></View><Text style={s.badge}>Berikutnya</Text></View></Card><Text style={s.info}>Tahap 1 berfokus pada navigasi dan tampilan Beranda. Modul transaksi, penyimpanan data, dan autentikasi dikembangkan pada tahap berikutnya.</Text><DemoLabel /></Screen>;
}
const s = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  name: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  caption: { color: colors.muted, fontSize: 10, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 18 },
  text: { flex: 1 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  description: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 4 },
  badge: { color: colors.muted, fontSize: 9 },
  border: { borderTopWidth: 1, borderTopColor: colors.line },
  info: { color: colors.muted, fontSize: 11, lineHeight: 20, marginTop: 22 },
});
