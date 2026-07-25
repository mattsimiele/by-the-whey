import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from './theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <View style={styles.wedgeDot} />
        <View style={[styles.wedgeDot, { left: 15, top: 18, width: 4, height: 4 }]} />
        <View style={[styles.wedgeDot, { left: 9, top: 9, width: 3, height: 3 }]} />
      </View>
      <View>
        <Text style={[styles.brandName, compact && styles.brandNameCompact]}>BY THE WHEY</Text>
        {!compact && <Text style={styles.byline}>BUILT BY THE CURD NERD</Text>}
      </View>
    </View>
  );
}

export function Rating({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <View style={[styles.rating, large && styles.ratingLarge]}>
      <Ionicons name="star" size={large ? 15 : 12} color={colors.gold} />
      <Text style={[styles.ratingText, large && styles.ratingTextLarge]}>{value.toFixed(1)}</Text>
    </View>
  );
}

export function CheeseArt({ name, color, size = 72 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.cheeseArt, { width: size, height: size, backgroundColor: color }]}>
      <View style={styles.rindLine} />
      <View style={[styles.hole, { width: size * 0.15, height: size * 0.15, top: size * 0.2, left: size * 0.24 }]} />
      <View style={[styles.hole, { width: size * 0.09, height: size * 0.09, top: size * 0.56, left: size * 0.53 }]} />
      <Text style={[styles.cheeseLetter, { fontSize: size * 0.28 }]}>{name.charAt(0)}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <Pressable onPress={onPress}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, secondary = false }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && { opacity: 0.86 }]}>
      {icon && <Ionicons name={icon} size={18} color={secondary ? colors.wine : colors.white} />}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 38, height: 34, borderTopLeftRadius: 18, borderBottomLeftRadius: 18, borderTopRightRadius: 5, borderBottomRightRadius: 5, backgroundColor: colors.gold, transform: [{ rotate: '-4deg' }] },
  markCompact: { width: 30, height: 27 },
  wedgeDot: { position: 'absolute', width: 6, height: 6, borderRadius: 9, left: 22, top: 8, backgroundColor: colors.cream, opacity: 0.8 },
  brandName: { color: colors.ink, fontSize: 20, lineHeight: 21, letterSpacing: 2.2, fontWeight: '800' },
  brandNameCompact: { fontSize: 16, letterSpacing: 1.8 },
  byline: { color: colors.muted, marginTop: 3, fontSize: 8, letterSpacing: 1.7, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.cream, borderRadius: 20, alignSelf: 'flex-start' },
  ratingLarge: { paddingHorizontal: 11, paddingVertical: 7 },
  ratingText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  ratingTextLarge: { fontSize: 14 },
  cheeseArt: { overflow: 'hidden', borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...shadow },
  rindLine: { position: 'absolute', right: -12, width: '35%', height: '130%', backgroundColor: 'rgba(70,39,20,0.13)', transform: [{ rotate: '10deg' }] },
  hole: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 20 },
  cheeseLetter: { fontWeight: '900', color: 'rgba(255,255,255,0.76)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sectionAction: { color: colors.wine, fontWeight: '700', fontSize: 13 },
  button: { height: 52, borderRadius: 16, paddingHorizontal: 20, backgroundColor: colors.wine, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonSecondary: { backgroundColor: colors.blush },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  buttonTextSecondary: { color: colors.wine },
});
