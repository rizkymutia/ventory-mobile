import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>;
}
export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={styles.header}><Text style={styles.eyebrow}>DAGANGIN</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>;
}
export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{note ? <Text style={styles.sectionNote}>{note}</Text> : null}</View>;
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function StageNote({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return <View style={styles.stage}><View style={styles.stageIcon}><Ionicons name={icon} size={28} color={colors.primary} /></View><Text style={styles.stageTitle}>{title}</Text><Text style={styles.stageDescription}>{description}</Text><Pressable accessibilityRole="button" onPress={() => router.navigate('/')} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}><Text style={styles.backText}>Kembali ke Beranda</Text><Ionicons name="arrow-forward" size={16} color={colors.primary} /></Pressable></View>;
}
export function DemoLabel() {
  return <View style={styles.demo}><Ionicons name="information-circle-outline" size={15} color={colors.muted} /><Text style={styles.demoText}>Data contoh untuk pengembangan tampilan.</Text></View>;
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 34, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { marginBottom: 24 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -0.8, color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 21, color: colors.muted },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 15, marginTop: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  sectionNote: { color: colors.muted, fontSize: 10 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 19, padding: 20 },
  stage: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 25, borderRadius: 20, marginTop: 24 },
  stageIcon: { width: 60, height: 60, backgroundColor: colors.soft, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 22 },
  stageTitle: { fontSize: 19, color: colors.ink, fontWeight: '700', marginBottom: 10 },
  stageDescription: { color: colors.muted, fontSize: 13, lineHeight: 22 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, minHeight: 44 },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  demo: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 25 },
  demoText: { color: colors.muted, fontSize: 10, flexShrink: 1 },
});
