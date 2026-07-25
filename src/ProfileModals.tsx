import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { PrimaryButton, Rating } from './components';
import { supabase } from './lib/supabase';
import { colors } from './theme';

export type ProfileRecord = { id: string; handle: string; display_name: string; bio: string; location: string | null; avatar_path: string | null };
type Connection = { id: string; display_name: string; handle: string; avatar_path: string | null };

const avatarUrl = (path: string | null) => path && supabase ? supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl : undefined;

export function EditProfileModal({ visible, profile, onSaved, onClose }: { visible: boolean; profile: ProfileRecord; onSaved: () => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location ?? '');
  const [avatar, setAvatar] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDisplayName(profile.display_name);
    setHandle(profile.handle);
    setBio(profile.bio);
    setLocation(profile.location ?? '');
    setAvatar(null);
  }, [visible, profile]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow photo access to choose a profile image.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) setAvatar({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const save = async () => {
    if (!supabase || !displayName.trim() || !/^[a-z0-9_]{3,30}$/.test(handle)) {
      return Alert.alert('Check your profile', 'Add a name and use 3–30 lowercase letters, numbers, or underscores for the handle.');
    }
    setSaving(true);
    let avatarPath = profile.avatar_path;
    if (avatar) {
      const extension = avatar.mimeType.includes('png') ? 'png' : avatar.mimeType.includes('webp') ? 'webp' : avatar.mimeType.includes('heic') ? 'heic' : 'jpg';
      avatarPath = `${profile.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(avatarPath, decode(avatar.base64), { contentType: avatar.mimeType });
      if (uploadError) {
        setSaving(false);
        return Alert.alert('Could not upload avatar', uploadError.message);
      }
    }
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(),
      handle,
      bio: bio.trim(),
      location: location.trim() || null,
      avatar_path: avatarPath,
    }).eq('id', profile.id);
    if (error) {
      if (avatarPath && avatarPath !== profile.avatar_path) await supabase.storage.from('profile-avatars').remove([avatarPath]);
      setSaving(false);
      return Alert.alert(error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Profile needs revision' : 'Could not update profile', error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Please revise potentially harmful, explicit, or spam-like language.' : error.message);
    }
    if (profile.avatar_path && avatarPath !== profile.avatar_path) await supabase.storage.from('profile-avatars').remove([profile.avatar_path]);
    setSaving(false);
    onSaved();
    onClose();
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={styles.page}>
    <ModalHeader title="Edit profile" onClose={onClose} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={pickAvatar} style={styles.avatarPicker}>
        {avatar?.uri || avatarUrl(profile.avatar_path) ? <Image source={{ uri: avatar?.uri ?? avatarUrl(profile.avatar_path)! }} style={styles.avatarImage} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text></View>}
        <View style={styles.camera}><Ionicons name="camera" size={15} color={colors.white} /></View>
      </Pressable>
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Field label="Handle" value={handle} onChangeText={(value) => setHandle(value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoCapitalize="none" />
      <Field label="Bio" value={bio} onChangeText={setBio} multiline />
      <Field label="Location" value={location} onChangeText={setLocation} />
      {saving ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label="Save profile" icon="checkmark" onPress={save} />}
    </ScrollView>
  </SafeAreaView></Modal>;
}

export function ConnectionsModal({ visible, userId, initialTab, onChanged, onOpenProfile, onClose }: { visible: boolean; userId: string; initialTab: 'followers' | 'following'; onChanged: () => void; onOpenProfile: (id: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const select = tab === 'following' ? 'profile:following_id(id,display_name,handle,avatar_path)' : 'profile:follower_id(id,display_name,handle,avatar_path)';
    const column = tab === 'following' ? 'follower_id' : 'following_id';
    const { data } = await supabase.from('follows').select(select).eq(column, userId).order('created_at', { ascending: false });
    setItems((data ?? []).flatMap((row) => {
      const profile = row.profile as unknown as Connection | null;
      return profile ? [profile] : [];
    }));
    setLoading(false);
  };

  useEffect(() => { if (visible) { setTab(initialTab); } }, [visible, initialTab]);
  useEffect(() => { if (visible) load(); }, [visible, tab]);

  const remove = async (account: Connection) => {
    if (!supabase) return;
    const query = tab === 'following'
      ? supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', account.id)
      : supabase.from('follows').delete().eq('follower_id', account.id).eq('following_id', userId);
    const { error } = await query;
    if (error) return Alert.alert('Could not update connections', error.message);
    setItems((current) => current.filter((item) => item.id !== account.id));
    onChanged();
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={styles.page}>
    <ModalHeader title="Connections" onClose={onClose} />
    <View style={styles.segment}>{(['followers', 'following'] as const).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.segmentItem, tab === item && styles.segmentActive]}><Text style={[styles.segmentText, tab === item && styles.segmentTextActive]}>{item === 'followers' ? 'Followers' : 'Following'}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={styles.connectionList}>
      {loading ? <ActivityIndicator color={colors.wine} /> : items.length ? items.map((account) => <View key={account.id} style={styles.connectionRow}>
        <Pressable style={styles.connectionProfile} onPress={() => onOpenProfile(account.id)}>
          {avatarUrl(account.avatar_path) ? <Image source={{ uri: avatarUrl(account.avatar_path)! }} style={styles.smallAvatar} /> : <View style={styles.smallAvatarFallback}><Text style={styles.smallInitial}>{account.display_name.charAt(0)}</Text></View>}
          <View><Text style={styles.connectionName}>{account.display_name}</Text><Text style={styles.connectionHandle}>@{account.handle}</Text></View>
        </Pressable>
        <Pressable onPress={() => remove(account)} style={styles.remove}><Text style={styles.removeText}>{tab === 'following' ? 'Unfollow' : 'Remove'}</Text></Pressable>
      </View>) : <Text style={styles.empty}>No {tab} yet.</Text>}
    </ScrollView>
  </SafeAreaView></Modal>;
}

export function PublicProfileModal({ profileId, currentUserId, onChanged, onClose }: { profileId: string | null; currentUserId?: string; onChanged: () => void; onClose: () => void }) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [tastings, setTastings] = useState<{ id: string; rating: number; notes: string; created_at: string; cheese: { name: string; creamery_name: string } }[]>([]);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!supabase || !profileId) return;
    Promise.all([
      supabase.from('profiles').select('id,handle,display_name,bio,location,avatar_path').eq('id', profileId).single(),
      supabase.from('tastings').select('id,rating,notes,created_at,cheese:cheese_id(name,creamery_name)').eq('user_id', profileId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(30),
      currentUserId ? supabase.from('follows').select('following_id').eq('follower_id', currentUserId).eq('following_id', profileId).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([profileResult, tastingResult, followResult]) => {
      setProfile(profileResult.data as ProfileRecord | null);
      setTastings((tastingResult.data ?? []) as unknown as typeof tastings);
      setFollowing(Boolean(followResult.data));
    });
  }, [profileId, currentUserId]);

  const toggleFollow = async () => {
    if (!supabase || !currentUserId || !profileId) return;
    const action = following ? supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', profileId) : supabase.from('follows').insert({ follower_id: currentUserId, following_id: profileId });
    const { error } = await action;
    if (error) return Alert.alert('Could not update follow', error.message);
    setFollowing(!following);
    onChanged();
  };

  return <Modal visible={Boolean(profileId)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={styles.page}>
    <ModalHeader title="Turophile" onClose={onClose} />
    {!profile ? <ActivityIndicator style={{ marginTop: 80 }} color={colors.wine} /> : <ScrollView contentContainerStyle={styles.publicContent}>
      {avatarUrl(profile.avatar_path) ? <Image source={{ uri: avatarUrl(profile.avatar_path)! }} style={styles.publicAvatar} /> : <View style={styles.publicAvatarFallback}><Text style={styles.publicInitial}>{profile.display_name.charAt(0)}</Text></View>}
      <Text style={styles.publicName}>{profile.display_name}</Text><Text style={styles.publicHandle}>@{profile.handle}{profile.location ? ` · ${profile.location}` : ''}</Text>
      {profile.bio ? <Text style={styles.publicBio}>{profile.bio}</Text> : null}
      {currentUserId && currentUserId !== profile.id ? <View style={styles.followAction}><PrimaryButton label={following ? 'Following' : 'Follow'} icon={following ? 'checkmark' : 'person-add-outline'} secondary={following} onPress={toggleFollow} /></View> : null}
      <Text style={styles.sectionTitle}>Public tastings</Text>
      {tastings.length ? tastings.map((tasting) => <View key={tasting.id} style={styles.tastingCard}><View style={styles.tastingHeader}><Text style={styles.tastingCheese}>{tasting.cheese.name}</Text><Rating value={Number(tasting.rating)} /></View><Text style={styles.tastingMaker}>{tasting.cheese.creamery_name} · {new Date(tasting.created_at).toLocaleDateString()}</Text><Text style={styles.tastingNotes}>{tasting.notes || 'No tasting notes.'}</Text></View>) : <Text style={styles.empty}>No public tastings yet.</Text>}
    </ScrollView>}
  </SafeAreaView></Modal>;
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <View style={styles.header}><Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>{title}</Text><View style={{ width: 38 }} /></View>;
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, multiline, ...inputProps } = props;
  return <View><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput {...inputProps} multiline={multiline} placeholderTextColor="#9B958A" style={[styles.input, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  header: { height: 64, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 45, gap: 7 },
  avatarPicker: { width: 94, height: 94, alignSelf: 'center', marginBottom: 12 },
  avatarImage: { width: 94, height: 94, borderRadius: 47 },
  avatarFallback: { width: 94, height: 94, borderRadius: 47, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.white, fontSize: 30, fontWeight: '800' },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  label: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 10, marginBottom: 5 },
  input: { minHeight: 49, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, color: colors.ink, paddingHorizontal: 13 },
  multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  segment: { margin: 16, height: 43, padding: 4, borderRadius: 14, backgroundColor: colors.cream, flexDirection: 'row' },
  segmentItem: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  segmentTextActive: { color: colors.wine },
  connectionList: { padding: 17, gap: 9 },
  connectionRow: { minHeight: 66, borderRadius: 16, padding: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  connectionProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallAvatar: { width: 42, height: 42, borderRadius: 21 },
  smallAvatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  smallInitial: { color: colors.white, fontWeight: '800' },
  connectionName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  connectionHandle: { color: colors.muted, fontSize: 10, marginTop: 2 },
  remove: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.blush },
  removeText: { color: colors.wine, fontSize: 9, fontWeight: '800' },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 35, fontSize: 12 },
  publicContent: { padding: 20, alignItems: 'center', paddingBottom: 45 },
  publicAvatar: { width: 92, height: 92, borderRadius: 46 },
  publicAvatarFallback: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  publicInitial: { color: colors.white, fontSize: 30, fontWeight: '800' },
  publicName: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 13 },
  publicHandle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  publicBio: { color: colors.muted, textAlign: 'center', maxWidth: 300, lineHeight: 18, fontSize: 12, marginTop: 11 },
  followAction: { width: '100%', marginTop: 18 },
  sectionTitle: { width: '100%', color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 28, marginBottom: 12 },
  tastingCard: { width: '100%', borderRadius: 17, padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 9 },
  tastingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tastingCheese: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  tastingMaker: { color: colors.wine, fontSize: 9, fontWeight: '700', marginTop: 4 },
  tastingNotes: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 9 },
});
