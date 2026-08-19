import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { PrimaryButton } from './components';
import { supabase } from './lib/supabase';
import { colors } from './theme';

export type EditableTasting = { id: string; rating: number; notes: string; location_name: string | null; visibility: 'public' | 'followers' | 'private'; created_at: string };

export function EditTastingModal({ tasting, userId, onSaved, onClose }: { tasting: EditableTasting | null; userId: string; onSaved: () => void; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [currentPhoto, setCurrentPhoto] = useState<{ id: string; storage_path: string; url?: string } | null>(null);
  const [replacement, setReplacement] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase || !tasting) return;
    setRating(tasting.rating);
    setNotes(tasting.notes);
    setLocation(tasting.location_name ?? '');
    setVisibility(tasting.visibility);
    setReplacement(null);
    setRemovePhoto(false);
    supabase.from('tasting_photos').select('id,storage_path').eq('tasting_id', tasting.id).maybeSingle().then(async ({ data }) => {
      if (!data) return setCurrentPhoto(null);
      const signed = await supabase!.storage.from('tasting-photos').createSignedUrl(data.storage_path, 1800);
      setCurrentPhoto({ ...data, url: signed.data?.signedUrl });
    });
  }, [tasting?.id]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow photo access to replace this tasting photo.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setReplacement({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
      setRemovePhoto(false);
    }
  };

  const save = async () => {
    if (!supabase || !tasting) return;
    setSaving(true);
    const { error } = await supabase.from('tastings').update({ rating, notes: notes.trim(), location_name: location.trim() || null, visibility }).eq('id', tasting.id).eq('user_id', userId);
    if (error) {
      setSaving(false);
      return Alert.alert(error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Tasting needs revision' : 'Could not update tasting', error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Please revise potentially harmful, explicit, or spam-like language.' : error.message);
    }
    if ((replacement || removePhoto) && currentPhoto) {
      const { error: storageError } = await supabase.storage.from('tasting-photos').remove([currentPhoto.storage_path]);
      if (storageError) {
        setSaving(false);
        return Alert.alert('Tasting updated, but photo could not be changed', storageError.message);
      }
      await supabase.from('tasting_photos').delete().eq('id', currentPhoto.id);
    }
    if (replacement) {
      const extension = replacement.mimeType.includes('png') ? 'png' : replacement.mimeType.includes('webp') ? 'webp' : replacement.mimeType.includes('heic') ? 'heic' : 'jpg';
      const storagePath = `${userId}/${tasting.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('tasting-photos').upload(storagePath, decode(replacement.base64), { contentType: replacement.mimeType });
      if (uploadError) {
        setSaving(false);
        return Alert.alert('Tasting updated without replacement photo', uploadError.message);
      }
      const { error: recordError } = await supabase.from('tasting_photos').insert({ tasting_id: tasting.id, storage_path: storagePath });
      if (recordError) {
        await supabase.storage.from('tasting-photos').remove([storagePath]);
        setSaving(false);
        return Alert.alert('Tasting updated without replacement photo', recordError.message);
      }
    }
    setSaving(false);
    Alert.alert('Tasting updated', replacement ? 'Your replacement photo is awaiting administrator approval.' : 'Your changes are saved.');
    onSaved();
    onClose();
  };

  return <Modal visible={Boolean(tasting)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={styles.page}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Close tasting editor" style={styles.close} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable><Text style={styles.title}>Edit tasting</Text><View style={{ width: 38 }} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>RATING</Text><Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>
      <View style={styles.stars}>{[1, 2, 3, 4, 5].map((star) => <Pressable key={star} accessibilityRole="adjustable" accessibilityLabel={`Set rating near ${star} stars`} onPress={(event) => setRating(star - (event.nativeEvent.locationX < 17 ? 0.5 : 0))}><Ionicons name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'} size={34} color={colors.gold} /></Pressable>)}</View>
      <Text style={styles.label}>NOTES</Text><TextInput value={notes} onChangeText={setNotes} multiline style={styles.notes} placeholder="What did you notice?" placeholderTextColor={colors.placeholder} />
      <Text style={styles.label}>LOCATION</Text><TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="Where did you taste it?" placeholderTextColor={colors.placeholder} />
      <Text style={styles.label}>VISIBILITY</Text><View style={styles.visibility}>{(['public', 'followers', 'private'] as const).map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: visibility === item }} accessibilityLabel={`${item} tasting visibility`} onPress={() => setVisibility(item)} style={[styles.visibilityOption, visibility === item && styles.visibilityActive]}><Text style={[styles.visibilityText, visibility === item && styles.visibilityTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
      <Text style={styles.label}>PHOTO</Text>
      {(replacement?.uri || (currentPhoto?.url && !removePhoto)) ? <Image source={{ uri: replacement?.uri ?? currentPhoto!.url! }} style={styles.photo} /> : <View style={styles.noPhoto}><Ionicons name="image-outline" size={30} color={colors.muted} /><Text style={styles.noPhotoText}>No photo</Text></View>}
      <View style={styles.photoActions}><Pressable onPress={pickPhoto} style={styles.photoButton}><Text style={styles.photoButtonText}>{currentPhoto ? 'Replace photo' : 'Add photo'}</Text></Pressable>{currentPhoto && !replacement ? <Pressable onPress={() => setRemovePhoto(!removePhoto)} style={styles.photoButton}><Text style={styles.photoButtonText}>{removePhoto ? 'Keep photo' : 'Remove photo'}</Text></Pressable> : null}</View>
      {saving ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label="Save changes" icon="checkmark" onPress={save} />}
    </ScrollView>
  </SafeAreaView></Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  header: { height: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 45 },
  label: { color: colors.muted, fontSize: 8, letterSpacing: 1.3, fontWeight: '900', marginTop: 17, marginBottom: 7 },
  ratingNumber: { color: colors.ink, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 5 },
  notes: { minHeight: 105, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 13, color: colors.ink, textAlignVertical: 'top' },
  input: { minHeight: 49, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 13, color: colors.ink },
  visibility: { flexDirection: 'row', gap: 7 },
  visibilityOption: { flex: 1, height: 38, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  visibilityActive: { backgroundColor: colors.wine },
  visibilityText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  visibilityTextActive: { color: colors.white },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  noPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { color: colors.muted, fontSize: 10, marginTop: 6 },
  photoActions: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  photoButton: { flex: 1, height: 38, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  photoButtonText: { color: colors.wine, fontSize: 10, fontWeight: '800' },
});
