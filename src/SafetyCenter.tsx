import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from './components';
import { supabase } from './lib/supabase';
import { colors } from './theme';

type Page = 'safety' | 'privacy' | 'terms' | 'guidelines' | 'support';
type BlockedAccount = { blocked_id: string; profile: { display_name: string; handle: string } | null };

const pages: { id: Page; label: string }[] = [
  { id: 'safety', label: 'Safety' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'guidelines', label: 'Guidelines' },
  { id: 'support', label: 'Support' },
];

export function SafetyCenter({ visible, userId, onClose }: { visible: boolean; userId: string; onClose: () => void }) {
  const [page, setPage] = useState<Page>('safety');
  const [blocked, setBlocked] = useState<BlockedAccount[]>([]);
  const [deleting, setDeleting] = useState(false);

  const loadBlocked = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('blocks').select('blocked_id,profile:blocked_id(display_name,handle)').eq('blocker_id', userId).order('created_at', { ascending: false });
    setBlocked((data ?? []) as unknown as BlockedAccount[]);
  };

  useEffect(() => {
    if (visible) {
      setPage('safety');
      loadBlocked();
    }
  }, [visible, userId]);

  const unblock = async (account: BlockedAccount) => {
    if (!supabase) return;
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', account.blocked_id);
    if (error) return Alert.alert('Could not unblock account', error.message);
    setBlocked((current) => current.filter((item) => item.blocked_id !== account.blocked_id));
  };

  const deleteAccount = () => {
    Alert.alert(
      'Permanently delete your account?',
      'Your profile, tastings, comments, likes, follows, saved cheeses, and uploaded tasting photos will be removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Final confirmation',
            'Delete your By the Whey account and all associated data?',
            [
              { text: 'Keep account', style: 'cancel' },
              {
                text: 'Delete account',
                style: 'destructive',
                onPress: async () => {
                  if (!supabase) return;
                  setDeleting(true);
                  const { data: tastings, error: tastingError } = await supabase.from('tastings').select('id').eq('user_id', userId);
                  if (tastingError) {
                    setDeleting(false);
                    return Alert.alert('Could not prepare account deletion', tastingError.message);
                  }
                  const ids = (tastings ?? []).map((tasting) => tasting.id);
                  if (ids.length) {
                    const { data: photos, error: photoError } = await supabase.from('tasting_photos').select('storage_path').in('tasting_id', ids);
                    if (photoError) {
                      setDeleting(false);
                      return Alert.alert('Could not prepare account deletion', photoError.message);
                    }
                    const paths = (photos ?? []).map((photo) => photo.storage_path);
                    if (paths.length) {
                      const { error: storageError } = await supabase.storage.from('tasting-photos').remove(paths);
                      if (storageError) {
                        setDeleting(false);
                        return Alert.alert('Could not remove uploaded photos', storageError.message);
                      }
                    }
                  }
                  const { error } = await supabase.rpc('delete_my_account');
                  setDeleting(false);
                  if (error) return Alert.alert('Could not delete account', error.message);
                  onClose();
                },
              },
            ],
          ),
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.close} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
          <Text style={styles.title}>Safety & Legal</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {pages.map((item) => <Pressable key={item.id} onPress={() => setPage(item.id)} style={[styles.tab, page === item.id && styles.tabActive]}><Text style={[styles.tabText, page === item.id && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
        </ScrollView>
        <ScrollView contentContainerStyle={styles.content}>
          {page === 'safety' && (
            <>
              <Text style={styles.heading}>Blocked accounts</Text>
              <Text style={styles.copy}>Blocked accounts cannot interact with you, and their activity is removed from your experience.</Text>
              {blocked.length ? blocked.map((account) => (
                <View key={account.blocked_id} style={styles.blockRow}>
                  <View style={styles.blockIcon}><Ionicons name="person-outline" size={18} color={colors.wine} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.blockName}>{account.profile?.display_name ?? 'Blocked account'}</Text><Text style={styles.blockHandle}>{account.profile ? `@${account.profile.handle}` : ''}</Text></View>
                  <Pressable onPress={() => unblock(account)} style={styles.unblock}><Text style={styles.unblockText}>Unblock</Text></Pressable>
                </View>
              )) : <Text style={styles.empty}>You have not blocked anyone.</Text>}
              <View style={styles.divider} />
              <Text style={styles.heading}>Delete account</Text>
              <Text style={styles.copy}>Account deletion is permanent and removes your community activity and uploaded tasting photos.</Text>
              {deleting ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label="Delete my account" icon="trash-outline" secondary onPress={deleteAccount} />}
            </>
          )}
          {page === 'privacy' && <Policy title="Privacy Policy" sections={[
            ['Information we collect', 'We store account details you provide, profile information, cheese tastings, ratings, notes, locations you type, uploaded photos, follows, likes, comments, saved cheeses, reports, blocks, and service diagnostics.'],
            ['How information is used', 'Information is used to operate the cheese journal and community, calculate anonymous cheese averages, moderate content, protect users, and improve reliability.'],
            ['Visibility', 'Public tastings appear in the community feed. Private tastings remain visible to their owner, while their rating may contribute only to an anonymous community average.'],
            ['Control and deletion', 'You can remove tastings, saved cheeses, follows, likes, comments, and blocks. In-app account deletion removes the account and associated data.'],
            ['Data sharing', 'We do not sell personal information. Supabase and Apple may process information needed to provide authentication, database, and storage services.'],
          ]} />}
          {page === 'terms' && <Policy title="Terms of Use" sections={[
            ['Use of the service', 'Use By the Whey lawfully and provide accurate account information. You are responsible for activity under your account.'],
            ['Your content', 'You retain ownership of content you submit and grant By the Whey permission to display and process it to operate the service.'],
            ['Community safety', 'Harassment, impersonation, illegal content, spam, and content that violates another person’s rights are prohibited.'],
            ['Moderation', 'Content may be reviewed, limited, or removed, and accounts may be restricted when necessary to protect the community or comply with law.'],
            ['Service changes', 'Features may change during testing. The service is provided without a guarantee of uninterrupted availability.'],
          ]} />}
          {page === 'guidelines' && <Policy title="Community Guidelines" sections={[
            ['Be thoughtful', 'Share useful cheese experiences and disagree without harassment or personal attacks.'],
            ['Keep it relevant', 'Posts should relate to cheese, tasting, producers, pairings, shops, events, or the community.'],
            ['Use your own media', 'Upload photos you created or have permission to share. Do not post private or identifying information about others.'],
            ['No harmful content', 'Threats, hate, sexual exploitation, scams, illegal sales, graphic violence, and coordinated abuse are not allowed.'],
            ['Report concerns', 'Use the report controls on posts, accounts, comments, and cheeses. Blocking immediately removes another account from your experience.'],
          ]} />}
          {page === 'support' && <><Policy title="Support" sections={[
            ['Getting help', 'If something is not working, record what you were doing, your device type, and any error message.'],
            ['Safety concerns', 'Use in-app reporting for content or behavior concerns. Urgent real-world emergencies should be directed to local emergency services.'],
            ['Account access', 'Use “Forgot password?” on the sign-in screen. Account deletion is available from the Safety tab on this page.'],
          ]} /><Pressable style={styles.contact} onPress={() => Linking.openURL('mailto:support@thecurdnerd.com')}><Ionicons name="mail-outline" size={19} color={colors.wine} /><Text style={styles.contactText}>support@thecurdnerd.com</Text></Pressable><Pressable style={styles.contact} onPress={() => Linking.openURL('https://thecurdnerd.com')}><Ionicons name="globe-outline" size={19} color={colors.wine} /><Text style={styles.contactText}>thecurdnerd.com</Text></Pressable></>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Policy({ title, sections }: { title: string; sections: [string, string][] }) {
  return <><Text style={styles.policyTitle}>{title}</Text><Text style={styles.updated}>DRAFT · LAST UPDATED JULY 25, 2026</Text>{sections.map(([heading, copy]) => <View key={heading} style={styles.policySection}><Text style={styles.heading}>{heading}</Text><Text style={styles.copy}>{copy}</Text></View>)}</>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  header: { height: 64, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  tabs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.wine, borderColor: colors.wine },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.white },
  content: { padding: 20, paddingBottom: 45 },
  policyTitle: { color: colors.ink, fontSize: 27, fontWeight: '800' },
  updated: { color: colors.wine, fontSize: 8, letterSpacing: 1.3, fontWeight: '900', marginTop: 5, marginBottom: 23 },
  policySection: { marginBottom: 19 },
  heading: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 7 },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19, marginBottom: 14 },
  empty: { color: colors.muted, fontSize: 12, fontStyle: 'italic', paddingVertical: 18 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 25 },
  blockRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  blockIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  blockName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  blockHandle: { color: colors.muted, fontSize: 10, marginTop: 2 },
  unblock: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: colors.blush },
  unblockText: { color: colors.wine, fontSize: 9, fontWeight: '800' },
  contact: { minHeight: 52, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 9 },
  contactText: { color: colors.wine, fontSize: 12, fontWeight: '800' },
});
