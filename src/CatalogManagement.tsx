import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from './components';
import { Role } from './data';
import { supabase } from './lib/supabase';
import { colors } from './theme';

type Draft = {
  name: string;
  creamery_name: string;
  location_city: string;
  location_region: string;
  location_country: string;
  milk_type: string;
  rennet: string;
  cheese_style: string;
  catalog_category: string;
  age_description: string;
  flavor_profile: string;
  story_notes: string;
  pairings: string;
};

const emptyDraft: Draft = {
  name: '',
  creamery_name: '',
  location_city: '',
  location_region: '',
  location_country: 'USA',
  milk_type: '',
  rennet: '',
  cheese_style: '',
  catalog_category: '',
  age_description: '',
  flavor_profile: '',
  story_notes: '',
  pairings: '',
};

type Submission = Draft & { id: string; slug: string; flavor_profile: string[]; pairings: string[]; profiles: { display_name: string; handle: string } };
type Report = { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; reporter_handle: string; target_preview: string | null };
type PhotoReview = { id: string; storage_path: string; created_at: string; signed_url?: string; tasting: { notes: string; rating: number; visibility: string; profile: { display_name: string; handle: string } } };

export function CatalogManagement({ visible, role, userId, onClose }: { visible: boolean; role: Role; userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'submit' | 'review' | 'photos' | 'reports' | 'users'>(role === 'admin' ? 'review' : 'submit');
  const [draft, setDraft] = useState(emptyDraft);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; display_name: string; handle: string; role: Role }[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [photos, setPhotos] = useState<PhotoReview[]>([]);

  const loadSubmissions = async () => {
    if (!supabase || role !== 'admin') return;
    const { data, error } = await supabase
      .from('cheeses')
      .select('*,profiles:submitted_by(display_name,handle)')
      .eq('status', 'pending')
      .order('created_at');
    if (error) return Alert.alert('Could not load submissions', error.message);
    setSubmissions((data ?? []) as unknown as Submission[]);
  };

  const loadAccounts = async () => {
    if (!supabase || role !== 'admin') return;
    const { data } = await supabase.from('profiles').select('id,display_name,handle,role').order('display_name');
    setAccounts((data ?? []) as typeof accounts);
  };

  const loadReports = async () => {
    if (!supabase || role !== 'admin') return;
    const { data, error } = await supabase.rpc('admin_report_queue');
    if (error) return Alert.alert('Could not load reports', error.message);
    setReports((data ?? []) as unknown as Report[]);
  };

  const loadPhotos = async () => {
    if (!supabase || role !== 'admin') return;
    const { data, error } = await supabase.from('tasting_photos')
      .select('id,storage_path,created_at,tasting:tasting_id(notes,rating,visibility,profile:user_id(display_name,handle))')
      .eq('moderation_status', 'pending')
      .order('created_at');
    if (error) return Alert.alert('Could not load photo review', error.message);
    const withUrls = await Promise.all((data ?? []).map(async (item) => {
      const signed = await supabase!.storage.from('tasting-photos').createSignedUrl(item.storage_path, 1800);
      return { ...item, signed_url: signed.data?.signedUrl };
    }));
    setPhotos(withUrls as unknown as PhotoReview[]);
  };

  useEffect(() => {
    if (visible) {
      setTab(role === 'admin' ? 'review' : 'submit');
      loadSubmissions();
      loadAccounts();
      loadReports();
      loadPhotos();
    }
  }, [visible, role]);

  const setField = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = async () => {
    if (!supabase) return;
    const missing = Object.entries(draft).find(([, value]) => !value.trim());
    if (missing) return Alert.alert('Complete every field', 'Published cheese records require all catalog information.');
    setSaving(true);
    const slug = draft.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await supabase.from('cheeses').insert({
      ...draft,
      slug,
      flavor_profile: draft.flavor_profile.split(',').map((item) => item.trim()).filter(Boolean),
      pairings: draft.pairings.split(',').map((item) => item.trim()).filter(Boolean),
      status: 'pending',
      submitted_by: userId,
    });
    setSaving(false);
    if (error) return Alert.alert(error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Submission needs revision' : 'Could not submit cheese', error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Please remove potentially harmful, explicit, or spam-like language and try again.' : error.message);
    setDraft(emptyDraft);
    Alert.alert('Submitted for review', 'An administrator can now review this cheese for publication.');
    if (role === 'admin') {
      setTab('review');
      loadSubmissions();
    }
  };

  const review = async (id: string, approve: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from('cheeses').update({
      status: approve ? 'published' : 'rejected',
      approved_by: approve ? userId : null,
    }).eq('id', id);
    if (error) return Alert.alert('Could not update submission', error.message);
    setSubmissions((current) => current.filter((item) => item.id !== id));
  };

  const changeRole = async (id: string, nextRole: Role) => {
    if (!supabase || id === userId) return;
    const { error } = await supabase.from('profiles').update({ role: nextRole, role_approved: true }).eq('id', id);
    if (error) return Alert.alert('Could not change role', error.message);
    setAccounts((current) => current.map((account) => account.id === id ? { ...account, role: nextRole } : account));
  };

  const resolveReport = async (id: string, status: 'actioned' | 'dismissed') => {
    if (!supabase) return;
    const { error } = await supabase.from('reports').update({ status, reviewed_by: userId }).eq('id', id);
    if (error) return Alert.alert('Could not update report', error.message);
    setReports((current) => current.filter((report) => report.id !== id));
  };

  const reviewPhoto = async (photo: PhotoReview, approve: boolean) => {
    if (!supabase) return;
    if (approve) {
      const { error } = await supabase.from('tasting_photos').update({ moderation_status: 'approved', reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq('id', photo.id);
      if (error) return Alert.alert('Could not approve photo', error.message);
    } else {
      const { error: storageError } = await supabase.storage.from('tasting-photos').remove([photo.storage_path]);
      if (storageError) return Alert.alert('Could not remove photo', storageError.message);
      const { error } = await supabase.from('tasting_photos').delete().eq('id', photo.id);
      if (error) return Alert.alert('Could not reject photo', error.message);
    }
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  };

  const fields: { key: keyof Draft; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: 'name', label: 'Cheese name', placeholder: 'Shelburne 2 Year' },
    { key: 'creamery_name', label: 'Creamery', placeholder: 'Shelburne Farms' },
    { key: 'location_city', label: 'City', placeholder: 'Shelburne' },
    { key: 'location_region', label: 'State / region', placeholder: 'Vermont' },
    { key: 'location_country', label: 'Country', placeholder: 'USA' },
    { key: 'milk_type', label: 'Milk type', placeholder: 'Raw cow’s milk' },
    { key: 'rennet', label: 'Rennet', placeholder: 'Animal' },
    { key: 'cheese_style', label: 'Cheese style', placeholder: 'Cheddar' },
    { key: 'catalog_category', label: 'Catalog category', placeholder: 'Alpine, Blue Cheese, Cheddar, Fresh Cheese, Gouda, Hard Aged Cheese, Soft Cheese, Tomme Style, or Washed Rind' },
    { key: 'age_description', label: 'Age', placeholder: 'Minimum two years' },
    { key: 'flavor_profile', label: 'Flavor profile', placeholder: 'Brothy, caramelized onions, toasted nuts' },
    { key: 'story_notes', label: 'Story / notes', placeholder: 'Producer, herd, process, and distinguishing details', multiline: true },
    { key: 'pairings', label: 'Pairings', placeholder: 'Apples, raw honey, Cabernet Sauvignon', multiline: true },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
          <View><Text style={styles.kicker}>CURD NERD CATALOG</Text><Text style={styles.title}>{role === 'admin' ? 'Catalog management' : 'Submit a cheese'}</Text></View>
          <View style={{ width: 38 }} />
        </View>
        {role === 'admin' && (
          <View style={styles.tabs}>
            {(['review', 'photos', 'reports', 'submit', 'users'] as const).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'review' ? `Cheese ${submissions.length}` : item === 'photos' ? `Photos ${photos.length}` : item === 'reports' ? `Reports ${reports.length}` : item === 'submit' ? 'Add' : 'Users'}</Text></Pressable>)}
          </View>
        )}
        {tab === 'submit' ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.helper}>Every field is required so the catalog remains useful and consistent.</Text>
            {fields.map((field) => (
              <View key={field.key}>
                <Text style={styles.label}>{field.label.toUpperCase()}</Text>
                <TextInput value={draft[field.key]} onChangeText={(value) => setField(field.key, value)} placeholder={field.placeholder} placeholderTextColor="#9B958A" multiline={field.multiline} style={[styles.input, field.multiline && styles.multiline]} />
              </View>
            ))}
            {saving ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label="Submit for review" icon="arrow-forward" onPress={submit} />}
          </ScrollView>
        ) : tab === 'review' ? (
          <ScrollView contentContainerStyle={styles.content}>
            {!submissions.length ? <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={40} color={colors.sage} /><Text style={styles.emptyTitle}>Review queue is clear</Text><Text style={styles.helper}>New cheesemonger submissions will appear here.</Text></View> : submissions.map((item) => (
              <View key={item.id} style={styles.submission}>
                <Text style={styles.submissionTitle}>{item.name}</Text>
                <Text style={styles.submitter}>Submitted by @{item.profiles.handle}</Text>
                <Text style={styles.summary}>{item.creamery_name} · {item.location_city}, {item.location_region}</Text>
                <Text style={styles.summary}>{item.milk_type} · {item.rennet} rennet · {item.cheese_style}</Text>
                <Text style={styles.story}>{item.story_notes}</Text>
                <Text style={styles.pills}>{item.flavor_profile.join(' · ')}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => review(item.id, false)} style={styles.reject}><Text style={styles.rejectText}>Return</Text></Pressable>
                  <Pressable onPress={() => review(item.id, true)} style={styles.approve}><Ionicons name="checkmark" size={17} color={colors.white} /><Text style={styles.approveText}>Publish</Text></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : tab === 'photos' ? (
          <ScrollView contentContainerStyle={styles.content}>
            {!photos.length ? <View style={styles.empty}><Ionicons name="images-outline" size={40} color={colors.sage} /><Text style={styles.emptyTitle}>Photo queue is clear</Text><Text style={styles.helper}>New tasting photos will remain off the public feed until approved.</Text></View> : photos.map((photo) => (
              <View key={photo.id} style={styles.submission}>
                {photo.signed_url ? <Image source={{ uri: photo.signed_url }} style={styles.reviewPhoto} /> : <View style={styles.photoUnavailable}><Ionicons name="image-outline" size={30} color={colors.muted} /></View>}
                <Text style={styles.submissionTitle}>{photo.tasting.profile.display_name}</Text>
                <Text style={styles.submitter}>@{photo.tasting.profile.handle} · {Number(photo.tasting.rating).toFixed(1)} stars · {photo.tasting.visibility}</Text>
                <Text style={styles.story}>{photo.tasting.notes || 'No tasting notes.'}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => reviewPhoto(photo, false)} style={styles.reject}><Text style={styles.rejectText}>Reject</Text></Pressable>
                  <Pressable onPress={() => reviewPhoto(photo, true)} style={styles.approve}><Ionicons name="checkmark" size={17} color={colors.white} /><Text style={styles.approveText}>Approve</Text></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : tab === 'reports' ? (
          <ScrollView contentContainerStyle={styles.content}>
            {!reports.length ? <View style={styles.empty}><Ionicons name="shield-checkmark-outline" size={40} color={colors.sage} /><Text style={styles.emptyTitle}>Report queue is clear</Text><Text style={styles.helper}>New community reports will appear here.</Text></View> : reports.map((report) => (
              <View key={report.id} style={styles.submission}>
                <Text style={styles.submissionTitle}>{report.target_type.charAt(0).toUpperCase() + report.target_type.slice(1)} report</Text>
                <Text style={styles.submitter}>Reported by @{report.reporter_handle} · {new Date(report.created_at).toLocaleDateString()}</Text>
                <Text style={styles.summary}>{report.target_preview || `Removed target · ${report.target_id}`}</Text>
                <Text style={styles.story}>{report.reason}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => resolveReport(report.id, 'dismissed')} style={styles.reject}><Text style={styles.rejectText}>Dismiss</Text></Pressable>
                  <Pressable onPress={() => resolveReport(report.id, 'actioned')} style={styles.approve}><Ionicons name="checkmark" size={17} color={colors.white} /><Text style={styles.approveText}>Actioned</Text></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.helper}>Choose who may contribute cheeses. Admins retain full moderation access.</Text>
            {accounts.map((account) => (
              <View key={account.id} style={styles.account}>
                <View style={styles.accountAvatar}><Text style={styles.accountInitial}>{account.display_name.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.accountName}>{account.display_name}</Text><Text style={styles.submitter}>@{account.handle} · {account.role}</Text></View>
                {account.id !== userId && (
                  <Pressable onPress={() => changeRole(account.id, account.role === 'cheesemonger' ? 'turophile' : 'cheesemonger')} style={styles.roleToggle}>
                    <Text style={styles.roleToggleText}>{account.role === 'cheesemonger' ? 'Remove access' : 'Make monger'}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  header: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.wine, textAlign: 'center', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 },
  tabs: { flexDirection: 'row', margin: 16, padding: 4, height: 44, backgroundColor: colors.cream, borderRadius: 14 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: colors.white },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.wine },
  content: { padding: 20, paddingBottom: 40, gap: 4 },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: 12 },
  label: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginTop: 12, marginBottom: 6 },
  input: { minHeight: 48, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 13, color: colors.ink, fontSize: 13 },
  multiline: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 5 },
  submission: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 19, padding: 17, marginBottom: 13 },
  submissionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  submitter: { color: colors.wine, fontSize: 10, fontWeight: '700', marginTop: 3 },
  summary: { color: colors.muted, fontSize: 11, marginTop: 8 },
  story: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 12 },
  pills: { color: colors.wine, fontSize: 10, fontWeight: '700', marginTop: 11 },
  reviewPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginBottom: 13, backgroundColor: colors.cream },
  photoUnavailable: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginBottom: 13, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  reject: { flex: 1, height: 43, borderRadius: 13, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: colors.wine, fontWeight: '800', fontSize: 12 },
  approve: { flex: 1, height: 43, borderRadius: 13, backgroundColor: colors.wine, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  approveText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  account: { minHeight: 70, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  accountAvatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  accountInitial: { color: colors.white, fontWeight: '800' },
  accountName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  roleToggle: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.blush, borderRadius: 12 },
  roleToggleText: { color: colors.wine, fontSize: 8, fontWeight: '800' },
});
