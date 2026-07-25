import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { AuthScreen } from './src/AuthScreen';
import { CatalogManagement } from './src/CatalogManagement';
import { SafetyCenter } from './src/SafetyCenter';
import { ConnectionsModal, EditProfileModal, ProfileRecord, PublicProfileModal } from './src/ProfileModals';
import { EditableTasting, EditTastingModal } from './src/EditTastingModal';
import { Brand, CheeseArt, PrimaryButton, Rating, SectionHeader } from './src/components';
import { Cheese, Post, Role } from './src/data';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { chooseReportReason } from './src/reporting';
import { colors, shadow } from './src/theme';
import { readCache, writeCache } from './src/cache';

type Tab = 'feed' | 'discover' | 'log' | 'cellar' | 'profile';
type UserProfile = ProfileRecord & { role: Role; role_approved: boolean; account_status?: 'active' | 'warned' | 'suspended'; moderation_note?: string | null };

const tabItems: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'feed', label: 'Feed', icon: 'home-outline', active: 'home' },
  { id: 'discover', label: 'Discover', icon: 'search-outline', active: 'search' },
  { id: 'log', label: 'Log', icon: 'add', active: 'add' },
  { id: 'cellar', label: 'Cellar', icon: 'bookmark-outline', active: 'bookmark' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', active: 'person' },
];

function AppHeader({ title, subtitle, unreadCount = 0, onNotifications }: { title?: string; subtitle?: string; unreadCount?: number; onNotifications?: () => void }) {
  return (
    <View style={styles.header}>
      {title ? (
        <View>
          <Text style={styles.eyebrow}>{subtitle}</Text>
          <Text style={styles.pageTitle}>{title}</Text>
        </View>
      ) : <Brand compact />}
      <Pressable style={styles.headerAction} onPress={onNotifications}>
        <Ionicons name="notifications-outline" size={21} color={colors.ink} />
        {unreadCount > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
      </Pressable>
    </View>
  );
}

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.retryState}><Ionicons name="cloud-offline-outline" size={32} color={colors.sage} /><Text style={styles.retryText}>{message}</Text><Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryButtonText}>Try again</Text></Pressable></View>;
}

function FeedScreen({ openCheese, openProfile, catalog, feedPosts, profile, userId, refreshing, error, unreadCount, onRefresh, onLog, onNotifications }: { openCheese: (cheese: Cheese) => void; openProfile: (id: string) => void; catalog: Cheese[]; feedPosts: Post[]; profile: UserProfile | null; userId?: string; refreshing: boolean; error: string | null; unreadCount: number; onRefresh: () => void; onLog: () => void; onNotifications: () => void }) {
  const [liked, setLiked] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const initials = (profile?.display_name ?? 'Guest').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!supabase || !userId) {
      setLiked([]);
      setFollowing([]);
      return;
    }
    Promise.all([
      supabase.from('likes').select('tasting_id').eq('user_id', userId),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
    ]).then(([likesResult, followsResult]) => {
      setLiked((likesResult.data ?? []).map((row) => row.tasting_id));
      setFollowing((followsResult.data ?? []).map((row) => row.following_id));
    });
  }, [userId, feedPosts]);

  const deleteTasting = (post: Post) => {
    if (!supabase || !userId || post.userId !== userId) return;
    Alert.alert(
      'Delete this tasting?',
      'This removes the post, its likes and comments, and its photo. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { data: photos, error: photoLookupError } = await supabase!.from('tasting_photos').select('storage_path').eq('tasting_id', post.id);
            if (photoLookupError) {
              Alert.alert('Could not delete tasting', photoLookupError.message);
              return;
            }
            const storagePaths = (photos ?? []).map((photo) => photo.storage_path);
            if (storagePaths.length) {
              const { error: storageError } = await supabase!.storage.from('tasting-photos').remove(storagePaths);
              if (storageError) {
                Alert.alert('Could not delete photo', `${storageError.message}\n\nThe tasting was left intact.`);
                return;
              }
            }
            const { error } = await supabase!.from('tastings').delete().eq('id', post.id).eq('user_id', userId);
            if (error) {
              Alert.alert('Could not delete tasting', error.message);
              return;
            }
            setCommentPost(null);
            onRefresh();
          },
        },
      ],
    );
  };

  const report = async (targetType: 'profile' | 'tasting', targetId: string) => {
    if (!userId) return Alert.alert('Sign in required', 'Sign in to report content or accounts.');
    chooseReportReason(userId, targetType, targetId);
  };

  const block = (post: Post) => {
    if (!supabase || !userId || !post.userId) return;
    Alert.alert('Block this account?', `You and ${post.user} will no longer see or interact with each other.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase!.from('blocks').insert({ blocker_id: userId, blocked_id: post.userId });
          if (error) return Alert.alert('Could not block account', error.message);
          await supabase!.from('follows').delete().eq('follower_id', userId).eq('following_id', post.userId);
          onRefresh();
        },
      },
    ]);
  };

  const openPostMenu = (post: Post) => {
    if (post.userId === userId) return deleteTasting(post);
    Alert.alert(post.user, 'Choose a safety action.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        onPress: () => Alert.alert('What would you like reviewed?', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'This tasting', onPress: () => report('tasting', post.id) },
          { text: 'This account', onPress: () => post.userId && report('profile', post.userId) },
        ]),
      },
      { text: 'Block account', style: 'destructive', onPress: () => block(post) },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.wine} colors={[colors.wine]} />}
    >
      <AppHeader unreadCount={unreadCount} onNotifications={onNotifications} />
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
          <Text style={styles.heroTitle}>Welcome, {profile?.display_name ?? 'cheese lover'}.</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      </View>

      <Pressable style={styles.promptCard} onPress={onLog}>
        <View style={styles.promptTop}>
          <View style={styles.promptIcon}><Ionicons name="restaurant-outline" size={20} color={colors.wine} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promptTitle}>What’s on your board?</Text>
            <Text style={styles.promptCopy}>Log a tasting and share it with the community.</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.wine} />
        </View>
      </Pressable>

      <SectionHeader title="From your circle" />
      {error && <RetryState message={error} onRetry={onRefresh} />}
      {!error && !refreshing && !feedPosts.length && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={36} color={colors.sage} />
          <Text style={styles.emptyStateTitle}>Your feed is ready</Text>
          <Text style={styles.emptyStateCopy}>New public tastings from real testers will appear here.</Text>
        </View>
      )}
      {feedPosts.filter((post) => catalog.some((item) => item.id === post.cheeseId)).map((post) => {
        const cheese = catalog.find((item) => item.id === post.cheeseId)!;
        const isLiked = liked.includes(post.id);
        return (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Pressable onPress={() => post.userId && openProfile(post.userId)} style={[styles.postAvatar, { backgroundColor: post.role === 'cheesemonger' ? colors.wine : colors.sage }]}>
                {post.avatarUrl ? <Image source={{ uri: post.avatarUrl }} style={styles.postAvatarImage} /> : <Text style={styles.postAvatarText}>{post.initials}</Text>}
              </Pressable>
              <Pressable onPress={() => post.userId && openProfile(post.userId)} style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.postName}>{post.user}</Text>
                  {post.role === 'cheesemonger' && <Ionicons name="checkmark-circle" size={15} color={colors.wine} />}
                </View>
                <Text style={styles.postMeta}>{post.handle} · {post.time}</Text>
              </Pressable>
              {userId && post.userId && post.userId !== userId && (
                <Pressable onPress={async () => {
                  if (!supabase) return;
                  const isFollowing = following.includes(post.userId!);
                  const action = isFollowing
                    ? supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', post.userId!)
                    : supabase.from('follows').upsert({ follower_id: userId, following_id: post.userId! });
                  const { error } = await action;
                  if (error) return Alert.alert('Could not update follow', error.message);
                  setFollowing((current) => isFollowing ? current.filter((id) => id !== post.userId) : [...current, post.userId!]);
                }} style={styles.followButton}>
                  <Text style={styles.followText}>{following.includes(post.userId) ? 'Following' : 'Follow'}</Text>
                </Pressable>
              )}
              {post.userId && (
                <Pressable accessibilityLabel="Post options" onPress={() => openPostMenu(post)} style={styles.postMenu}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
                </Pressable>
              )}
            </View>
            <Pressable style={styles.featureArt} onPress={() => openCheese(cheese)}>
              {post.photoUrl ? <Image source={{ uri: post.photoUrl }} style={styles.postPhoto} /> : (
                <>
                  <View style={styles.artGlow} />
                  <CheeseArt name={cheese.name} color={cheese.color} imageUrl={cheese.imageUrl} size={132} />
                </>
              )}
              {post.photoPending && <View style={styles.pendingPhotoBadge}><Ionicons name="time-outline" size={12} color={colors.white} /><Text style={styles.pendingPhotoText}>Visible to you · awaiting review</Text></View>}
            </Pressable>
            <View style={styles.postBody}>
              <View style={styles.postCheeseRow}>
                <View style={styles.postCheeseInfo}>
                  <Text style={styles.postCheese}>{cheese.name}</Text>
                  <Text style={styles.postMaker}>{cheese.creamery} · {cheese.location}</Text>
                </View>
                <Rating value={post.rating} large />
              </View>
              <Text style={styles.postNote}>{post.note}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.muted} />
                <Text style={styles.locationText}>{post.place}</Text>
              </View>
              <View style={styles.socialRow}>
                <Pressable style={styles.socialAction} onPress={async () => {
                  if (userId && supabase) {
                    const action = isLiked
                      ? supabase.from('likes').delete().eq('user_id', userId).eq('tasting_id', post.id)
                      : supabase.from('likes').upsert({ user_id: userId, tasting_id: post.id });
                    const { error } = await action;
                    if (error) {
                      Alert.alert('Could not update like', error.message);
                      return;
                    }
                  }
                  setLiked((current) => isLiked ? current.filter((id) => id !== post.id) : [...current, post.id]);
                }}>
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={21} color={isLiked ? colors.wine : colors.ink} />
                  <Text style={[styles.socialText, isLiked && { color: colors.wine }]}>{post.likes + (isLiked ? 1 : 0)}</Text>
                </Pressable>
                <Pressable style={styles.socialAction} onPress={() => setCommentPost(post)}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.ink} />
                  <Text style={styles.socialText}>{post.comments}</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => Share.share({ message: `${post.user} rated ${cheese.name} ${post.rating.toFixed(1)} stars on By the Whey: “${post.note}”` })}>
                  <Ionicons name="share-outline" size={20} color={colors.ink} />
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
      <CommentsModal post={commentPost} userId={userId} onCommented={onRefresh} onClose={() => setCommentPost(null)} />
    </ScrollView>
  );
}

function CommentsModal({ post, userId, onCommented, onClose }: { post: Post | null; userId?: string; onCommented: () => void; onClose: () => void }) {
  const [comments, setComments] = useState<{ id: string; user_id: string; body: string; created_at: string; profiles: { display_name: string; handle: string } }[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!supabase || !post) return;
    const { data } = await supabase.from('comments').select('id,user_id,body,created_at,profiles:user_id(display_name,handle)').eq('tasting_id', post.id).order('created_at');
    setComments((data ?? []) as unknown as typeof comments);
  };

  useEffect(() => { load(); }, [post?.id]);

  const send = async () => {
    if (!supabase || !post || !userId || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({ tasting_id: post.id, user_id: userId, body: body.trim() });
    setSending(false);
    if (error) return Alert.alert(error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Comment needs revision' : 'Could not comment', error.message.includes('CONTENT_REVIEW_REQUIRED') ? 'Please remove potentially harmful, explicit, or spam-like language and try again.' : error.message);
    setBody('');
    load();
    onCommented();
  };

  const manageComment = (comment: typeof comments[number]) => {
    if (!supabase || !userId) return;
    if (comment.user_id === userId) {
      Alert.alert('Delete comment?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase!.from('comments').delete().eq('id', comment.id).eq('user_id', userId);
          if (error) return Alert.alert('Could not delete comment', error.message);
          load();
          onCommented();
        } },
      ]);
      return;
    }
    chooseReportReason(userId, 'comment', comment.id);
  };

  return (
    <Modal visible={Boolean(post)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.commentsPage}>
        <View style={styles.commentsHeader}>
          <Pressable style={styles.modalButton} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
          <Text style={styles.commentsTitle}>Tasting conversation</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView contentContainerStyle={styles.commentsList}>
          {comments.length ? comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{comment.profiles.display_name.charAt(0)}</Text></View>
              <View style={styles.commentBubble}>
                <Text style={styles.commentName}>{comment.profiles.display_name} <Text style={styles.commentHandle}>@{comment.profiles.handle}</Text></Text>
                <Text style={styles.commentBody}>{comment.body}</Text>
              </View>
              <Pressable accessibilityLabel="Comment options" onPress={() => manageComment(comment)} style={styles.commentMenu}><Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} /></Pressable>
            </View>
          )) : <Text style={styles.emptyComments}>Start the conversation about this tasting.</Text>}
        </ScrollView>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.commentComposer}>
            <TextInput value={body} onChangeText={setBody} placeholder="Add a thoughtful comment…" placeholderTextColor="#9B958A" style={styles.commentInput} multiline />
            <Pressable onPress={send} disabled={sending || !body.trim()} style={styles.commentSend}>
              {sending ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="arrow-up" size={20} color={colors.white} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function DiscoverScreen({ openCheese, catalog, loading, error, unreadCount, onRetry, onNotifications }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[]; loading: boolean; error: string | null; unreadCount: number; onRetry: () => void; onNotifications: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<'Highest rated' | 'Most tasted' | 'Recently added' | 'Alphabetical'>('Highest rated');
  const filters = ['All', 'Alpine', 'Blue Cheese', 'Cheddar', 'Fresh Cheese', 'Gouda', 'Hard Aged Cheese', 'Soft Cheese', 'Tomme Style', 'Washed Rind'];
  const results = useMemo(() => catalog.filter((cheese) => {
    const matchesQuery = `${cheese.name} ${cheese.creamery} ${cheese.location} ${cheese.style} ${cheese.category} ${cheese.flavorProfile.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'All' || cheese.category === filter;
    return matchesQuery && matchesFilter;
  }).sort((a, b) => sort === 'Highest rated' ? b.rating - a.rating || b.logs - a.logs : sort === 'Most tasted' ? b.logs - a.logs || b.rating - a.rating : sort === 'Recently added' ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : a.name.localeCompare(b.name)), [query, filter, sort, catalog]);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <AppHeader title="Discover" subtitle="FIND YOUR NEXT FAVORITE" unreadCount={unreadCount} onNotifications={onNotifications} />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Cheese, maker, region…" placeholderTextColor="#9B958A" style={styles.searchInput} />
        {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={21} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterPill, filter === item && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.sortLabel}>SORT BY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {(['Highest rated', 'Most tasted', 'Recently added', 'Alphabetical'] as const).map((item) => <Pressable key={item} onPress={() => setSort(item)} style={[styles.sortPill, sort === item && styles.sortPillActive]}><Text style={[styles.sortText, sort === item && styles.sortTextActive]}>{item}</Text></Pressable>)}
      </ScrollView>

      <SectionHeader title={`${results.length} ${filter === 'All' ? 'cheeses' : filter}`} />
      {loading && <ActivityIndicator color={colors.wine} />}
      {error && <RetryState message={error} onRetry={onRetry} />}
      <View style={styles.cheeseList}>
        {results.map((cheese) => (
          <Pressable key={cheese.id} style={styles.cheeseRow} onPress={() => openCheese(cheese)}>
            <CheeseArt name={cheese.name} color={cheese.color} imageUrl={cheese.imageUrl} size={70} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cheeseName}>{cheese.name}</Text>
              <Text style={styles.cheeseMaker}>{cheese.creamery}</Text>
              <View style={styles.cheeseMetaRow}>
                <Text style={styles.cheeseMeta}>{cheese.milkType} · {cheese.style}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 12 }}>
              {cheese.logs > 0 ? (
                <View style={styles.communityRating}>
                  <Rating value={cheese.rating} />
                  <Text style={styles.communityRatingCount}>{cheese.logs} {cheese.logs === 1 ? 'rating' : 'ratings'}</Text>
                </View>
              ) : <Text style={styles.unratedText}>Not rated yet</Text>}
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </View>
          </Pressable>
        ))}
      </View>
      {!loading && !error && !results.length && <View style={styles.emptyState}><Ionicons name="search-outline" size={36} color={colors.sage} /><Text style={styles.emptyStateTitle}>No cheeses found</Text><Text style={styles.emptyStateCopy}>Try another name, maker, region, or category.</Text></View>}
    </ScrollView>
  );
}

function LogScreen({ onComplete, catalog, initialCheese, userId, unreadCount, onNotifications }: { onComplete: () => void; catalog: Cheese[]; initialCheese: Cheese | null; userId?: string; unreadCount: number; onNotifications: () => void }) {
  const [selected, setSelected] = useState<Cheese | null>(null);
  const [cheeseQuery, setCheeseQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rating, setRating] = useState(4.5);
  const [note, setNote] = useState('');
  const [locationName, setLocationName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const cheeseResults = useMemo(() => {
    const normalized = cheeseQuery.trim().toLowerCase();
    if (!normalized) return catalog.slice(0, 12);
    return catalog.filter((cheese) => `${cheese.name} ${cheese.creamery} ${cheese.location} ${cheese.category}`.toLowerCase().includes(normalized)).slice(0, 30);
  }, [catalog, cheeseQuery]);

  useEffect(() => {
    if (!initialCheese) return;
    setSelected(initialCheese);
    setCheeseQuery('');
    setPickerOpen(false);
  }, [initialCheese]);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access to add an image to your tasting.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
    }
  };

  const submit = async () => {
    if (!supabase || !userId || !selected) {
      Alert.alert('Select a cheese', 'Choose a catalog cheese before logging your tasting.');
      return;
    }
    setSaving(true);
    const { data: cheese, error: cheeseError } = await supabase
      .from('cheeses')
      .select('id')
      .eq('slug', selected.id)
      .eq('status', 'published')
      .single();
    if (cheeseError || !cheese) {
      setSaving(false);
      Alert.alert('Catalog entry required', 'This prototype cheese is not published in the shared catalog yet.');
      return;
    }
    const { data: tasting, error } = await supabase.from('tastings').insert({
      user_id: userId,
      cheese_id: cheese.id,
      rating,
      notes: note.trim(),
      location_name: locationName.trim() || null,
      visibility: isPublic ? 'public' : 'private',
    }).select('id').single();
    if (error || !tasting) {
      setSaving(false);
      const filtered = error?.message.includes('CONTENT_REVIEW_REQUIRED');
      Alert.alert(filtered ? 'Tasting needs revision' : 'Could not log tasting', filtered ? 'Please remove potentially harmful, explicit, or spam-like language and try again.' : error?.message ?? 'The tasting record was not created.');
      return;
    }
    if (photo) {
      const extension = photo.mimeType.includes('png') ? 'png' : photo.mimeType.includes('webp') ? 'webp' : photo.mimeType.includes('heic') ? 'heic' : 'jpg';
      const storagePath = `${userId}/${tasting.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('tasting-photos')
        .upload(storagePath, decode(photo.base64), { contentType: photo.mimeType, upsert: false });
      if (uploadError) {
        await supabase.from('tastings').delete().eq('id', tasting.id).eq('user_id', userId);
        setSaving(false);
        Alert.alert('Photo could not be attached', `${uploadError.message}\n\nThe tasting was not saved, so you can try again without losing the photo or location you entered.`);
        return;
      }
      const { error: photoRecordError } = await supabase.from('tasting_photos').insert({ tasting_id: tasting.id, storage_path: storagePath });
      if (photoRecordError) {
        await supabase.storage.from('tasting-photos').remove([storagePath]);
        await supabase.from('tastings').delete().eq('id', tasting.id).eq('user_id', userId);
        setSaving(false);
        Alert.alert('Photo could not be attached', `${photoRecordError.message}\n\nThe tasting was not saved, so you can try again.`);
        return;
      }
    }
    setSaving(false);
    Alert.alert('Tasting logged', `${selected.name} has been added to your cheese diary${locationName.trim() ? ` at ${locationName.trim()}` : ''}${isPublic ? ' and shared with your circle' : ''}.${photo ? ' Your photo will appear publicly after an administrator approves it.' : ''}`);
    setNote('');
    setLocationName('');
    setPhoto(null);
    onComplete();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <AppHeader title="Log a tasting" subtitle="CAPTURE THE MOMENT" unreadCount={unreadCount} onNotifications={onNotifications} />
        <Text style={styles.fieldLabel}>WHAT ARE YOU TASTING?</Text>
        {selected && !pickerOpen ? (
          <Pressable style={styles.selectedCheeseSummary} onPress={() => setPickerOpen(true)}>
            <CheeseArt name={selected.name} color={selected.color} imageUrl={selected.imageUrl} size={46} />
            <View style={{ flex: 1 }}><Text style={styles.cheeseName}>{selected.name}</Text><Text style={styles.selectCheeseMaker}>{selected.creamery} · {selected.category}</Text></View>
            <Text style={styles.changeCheese}>Change</Text>
          </Pressable>
        ) : <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput autoFocus={pickerOpen} value={cheeseQuery} onFocus={() => setPickerOpen(true)} onChangeText={setCheeseQuery} placeholder="Search cheese, maker, or category…" placeholderTextColor="#9B958A" style={styles.searchInput} />
          {cheeseQuery ? <Pressable onPress={() => setCheeseQuery('')}><Ionicons name="close-circle" size={21} color={colors.muted} /></Pressable> : null}
        </View>}
        {pickerOpen && (
          <>
            <Text style={styles.searchHint}>{cheeseQuery ? `${cheeseResults.length} matching cheeses` : 'Showing the first 12 cheeses'}</Text>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.cheesePickerResults} contentContainerStyle={{ gap: 8 }}>
              {cheeseResults.map((cheese) => (
                <Pressable key={cheese.id} onPress={() => { setSelected(cheese); setCheeseQuery(''); setPickerOpen(false); }} style={[styles.selectCheese, selected?.id === cheese.id && styles.selectCheeseActive]}>
                  <CheeseArt name={cheese.name} color={cheese.color} imageUrl={cheese.imageUrl} size={44} />
                  <View style={{ flex: 1 }}><Text style={styles.selectCheeseName}>{cheese.name}</Text><Text style={styles.selectCheeseMaker}>{cheese.creamery} · {cheese.category}</Text></View>
                  {selected?.id === cheese.id && <View style={styles.selectedCheck}><Ionicons name="checkmark" size={12} color={colors.white} /></View>}
                </Pressable>
              ))}
              {!cheeseResults.length && <Text style={styles.noSearchResults}>No matching cheeses. A cheesemonger can submit a missing catalog entry.</Text>}
            </ScrollView>
          </>
        )}

        <View style={styles.ratingPanel}>
          <Text style={styles.fieldLabel}>YOUR RATING</Text>
          <Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={(event) => setRating(star - (event.nativeEvent.locationX < 17 ? 0.5 : 0))}>
                <Ionicons name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'} size={34} color={colors.gold} />
              </Pressable>
            ))}
          </View>
          <View style={styles.ratingScale}><Text style={styles.scaleText}>NOT FOR ME</Text><Text style={styles.scaleText}>EXTRAORDINARY</Text></View>
        </View>

        <Text style={styles.fieldLabel}>TASTING NOTES</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="What did you notice? Texture, aroma, flavor, pairing…"
          placeholderTextColor="#9B958A"
          style={styles.noteInput}
        />
        <View style={styles.quickNotes}>
          {(selected?.flavorProfile ?? []).map((item) => <Pressable key={item} onPress={() => setNote((current) => `${current}${current ? ', ' : ''}${item.toLowerCase()}`)} style={styles.noteChip}><Text style={styles.noteChipText}>+ {item}</Text></Pressable>)}
        </View>

        <View style={styles.addOns}>
          <Pressable style={styles.addOn} onPress={pickPhoto}>
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photoThumb} /> : <Ionicons name="camera-outline" size={21} color={colors.wine} />}
            <View style={{ flex: 1 }}><Text style={styles.addOnText}>{photo ? 'Photo selected' : 'Add photo'}</Text>{photo && <Text style={styles.addOnSub}>Tap to choose a different image</Text>}</View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
          <View style={styles.locationEditor}>
            <Ionicons name="location-outline" size={21} color={colors.wine} />
            <TextInput value={locationName} onChangeText={setLocationName} placeholder="Where did you taste it? (optional)" placeholderTextColor="#9B958A" style={styles.locationInput} />
          </View>
          <Pressable style={styles.addOn} onPress={() => setIsPublic(!isPublic)}>
            <Ionicons name={isPublic ? 'people-outline' : 'lock-closed-outline'} size={21} color={colors.wine} />
            <View style={{ flex: 1 }}><Text style={styles.addOnText}>{isPublic ? 'Share with your circle' : 'Keep this tasting private'}</Text><Text style={styles.addOnSub}>Tap to change visibility</Text></View>
            <View style={[styles.switch, isPublic && styles.switchActive]}><View style={[styles.switchKnob, isPublic && styles.switchKnobActive]} /></View>
          </Pressable>
        </View>
        {saving ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label={selected ? `Log ${selected.name}` : 'Select a cheese first'} icon="checkmark-circle-outline" onPress={submit} disabled={!selected} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type CellarEntry = { cheese: Cheese; count: number; average: number; lastTasted: string };

function CellarScreen({ openCheese, catalog, userId, reload, unreadCount, onNotifications }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[]; userId?: string; reload: number; unreadCount: number; onNotifications: () => void }) {
  const [segment, setSegment] = useState<'Tasted' | 'Want to try'>('Tasted');
  const [entries, setEntries] = useState<CellarEntry[]>([]);
  const [savedCheeses, setSavedCheeses] = useState<Cheese[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !userId || !catalog.length) {
      setEntries([]);
      setSavedCheeses([]);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from('tastings').select('rating,created_at,cheeses:cheese_id(slug)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('saved_cheeses').select('created_at,cheeses:cheese_id(slug)').eq('user_id', userId).order('created_at', { ascending: false }),
    ]).then(([tastingsResult, savedResult]) => {
        const grouped = new Map<string, { ratings: number[]; lastTasted: string }>();
        for (const row of tastingsResult.data ?? []) {
          const joined = row.cheeses as unknown as { slug: string } | null;
          if (!joined?.slug) continue;
          const current = grouped.get(joined.slug);
          if (current) current.ratings.push(Number(row.rating));
          else grouped.set(joined.slug, { ratings: [Number(row.rating)], lastTasted: row.created_at });
        }
        setEntries(Array.from(grouped.entries()).flatMap(([slug, value]) => {
          const cheese = catalog.find((item) => item.id === slug);
          return cheese ? [{ cheese, count: value.ratings.length, average: value.ratings.reduce((sum, rating) => sum + rating, 0) / value.ratings.length, lastTasted: value.lastTasted }] : [];
        }));
        setSavedCheeses((savedResult.data ?? []).flatMap((row) => {
          const joined = row.cheeses as unknown as { slug: string } | null;
          const cheese = joined?.slug ? catalog.find((item) => item.id === joined.slug) : null;
          return cheese ? [cheese] : [];
        }));
        setLoading(false);
      });
  }, [userId, catalog, reload]);

  const stylesExplored = new Set(entries.map((entry) => entry.cheese.category)).size;
  const regionsExplored = new Set(entries.map((entry) => entry.cheese.location)).size;
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <AppHeader title="My cellar" subtitle="YOUR CHEESE JOURNEY" unreadCount={unreadCount} onNotifications={onNotifications} />
      <View style={styles.cellarSummary}>
        <View><Text style={styles.summaryNumber}>{entries.length}</Text><Text style={styles.summaryLabel}>CHEESES</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryNumber}>{stylesExplored}</Text><Text style={styles.summaryLabel}>STYLES</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryNumber}>{regionsExplored}</Text><Text style={styles.summaryLabel}>REGIONS</Text></View>
      </View>
      <View style={styles.segment}>
        {(['Tasted', 'Want to try'] as const).map((item) => (
          <Pressable key={item} onPress={() => setSegment(item)} style={[styles.segmentItem, segment === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, segment === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.cheeseList}>
        {segment === 'Tasted' && entries.map((entry) => (
          <Pressable key={entry.cheese.id} style={styles.cheeseRow} onPress={() => openCheese(entry.cheese)}>
            <CheeseArt name={entry.cheese.name} color={entry.cheese.color} imageUrl={entry.cheese.imageUrl} size={70} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cheeseName}>{entry.cheese.name}</Text>
              <Text style={styles.cheeseMaker}>{entry.cheese.creamery}</Text>
              <Text style={styles.cheeseMeta}>Tasted {entry.count} {entry.count === 1 ? 'time' : 'times'} · Last {new Date(entry.lastTasted).toLocaleDateString()}</Text>
            </View>
            <Rating value={entry.average} />
          </Pressable>
        ))}
        {segment === 'Want to try' && savedCheeses.map((cheese) => (
          <Pressable key={cheese.id} style={styles.cheeseRow} onPress={() => openCheese(cheese)}>
            <CheeseArt name={cheese.name} color={cheese.color} imageUrl={cheese.imageUrl} size={70} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cheeseName}>{cheese.name}</Text>
              <Text style={styles.cheeseMaker}>{cheese.creamery}</Text>
              <Text style={styles.cheeseMeta}>{cheese.category} · {cheese.location}</Text>
            </View>
            <Ionicons name="bookmark" size={20} color={colors.wine} />
          </Pressable>
        ))}
        {!loading && ((segment === 'Tasted' && !entries.length) || (segment === 'Want to try' && !savedCheeses.length)) && (
          <View style={styles.emptyState}>
            <Ionicons name={segment === 'Tasted' ? 'restaurant-outline' : 'bookmark-outline'} size={36} color={colors.sage} />
            <Text style={styles.emptyStateTitle}>{segment === 'Tasted' ? 'Your cellar is empty' : 'No saved cheeses yet'}</Text>
            <Text style={styles.emptyStateCopy}>{segment === 'Tasted' ? 'Your first logged tasting will appear here with your personal stats.' : 'Tap the bookmark on any cheese to save it for later.'}</Text>
          </View>
        )}
        {loading && <ActivityIndicator color={colors.wine} />}
      </View>
    </ScrollView>
  );
}

function ProfileScreen({ profile, signedIn, statsReload, unreadCount, onEdit, onConnections, onManageCatalog, onSafety, onNotifications }: { profile: UserProfile | null; signedIn: boolean; statsReload: number; unreadCount: number; onEdit: () => void; onConnections: (tab: 'followers' | 'following') => void; onManageCatalog: () => void; onSafety: () => void; onNotifications: () => void }) {
  const role = profile?.role ?? 'turophile';
  const displayName = profile?.display_name ?? 'Guest Turophile';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'BT';
  const profileAvatar = profile?.avatar_path && supabase ? supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl : undefined;
  const [stats, setStats] = useState({ following: 0, followers: 0, tastings: 0 });

  useEffect(() => {
    if (!supabase || !profile?.id) {
      setStats({ following: 0, followers: 0, tastings: 0 });
      return;
    }
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
      supabase.from('tastings').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    ]).then(([following, followers, tastings]) => setStats({
      following: following.count ?? 0,
      followers: followers.count ?? 0,
      tastings: tastings.count ?? 0,
    }));
  }, [profile?.id, statsReload]);

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <AppHeader unreadCount={unreadCount} onNotifications={onNotifications} />
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}>{profileAvatar ? <Image source={{ uri: profileAvatar }} style={styles.profileAvatarImage} /> : <Text style={styles.profileInitials}>{initials}</Text>}</View>
        <Text style={styles.profileName}>{displayName}</Text>
        <Text style={styles.profileHandle}>{profile ? `@${profile.handle}${profile.location ? ` · ${profile.location}` : ''}` : 'Guest preview'}</Text>
        <View style={styles.roleBadge}><Ionicons name={role === 'admin' ? 'shield-checkmark' : role === 'cheesemonger' ? 'storefront' : 'sparkles'} size={14} color={colors.wine} /><Text style={styles.roleText}>{role === 'admin' ? 'Administrator' : role === 'cheesemonger' ? 'Verified Cheesemonger' : 'Turophile'}</Text></View>
        <Text style={styles.bio}>{profile?.bio || 'Your cheese journey starts with your first tasting.'}</Text>
        {signedIn && <Pressable style={styles.editProfileButton} onPress={onEdit}><Ionicons name="pencil-outline" size={14} color={colors.wine} /><Text style={styles.editProfileText}>Edit profile</Text></Pressable>}
        <View style={styles.followStats}>
          <Pressable onPress={() => onConnections('following')}><Text style={styles.followStat}><Text style={styles.followStrong}>{stats.following}</Text>{'\n'}following</Text></Pressable>
          <Pressable onPress={() => onConnections('followers')}><Text style={styles.followStat}><Text style={styles.followStrong}>{stats.followers}</Text>{'\n'}followers</Text></Pressable>
          <Text style={styles.followStat}><Text style={styles.followStrong}>{stats.tastings}</Text>{'\n'}tastings</Text>
        </View>
      </View>

      <SectionHeader title="Your palate" />
      <View style={styles.palateCard}>
        <Ionicons name="analytics-outline" size={28} color={colors.sage} />
        <Text style={styles.emptyStateTitle}>{stats.tastings ? 'Palate insights are building' : 'Log tastings to reveal your palate'}</Text>
        <Text style={styles.emptyStateCopy}>Your preferences will be calculated from your own ratings—not prototype percentages.</Text>
      </View>

      <SectionHeader title="Account access" />
      <Text style={styles.roleHelper}>Your role is secured by Supabase and can only be changed by an administrator.</Text>
      {signedIn && (
        <Pressable style={styles.rolePanel} onPress={onSafety}>
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.wine} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rolePanelTitle}>Safety, privacy & support</Text>
            <Text style={styles.rolePanelCopy}>Manage blocked accounts, read policies and guidelines, get help, or delete your account.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.wine} />
        </Pressable>
      )}
      {role !== 'turophile' && (
        <Pressable style={styles.rolePanel} onPress={onManageCatalog}>
          <Ionicons name={role === 'admin' ? 'settings-outline' : 'add-circle-outline'} size={24} color={colors.wine} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rolePanelTitle}>{role === 'admin' ? 'Manage the community' : 'Contribute to the catalog'}</Text>
            <Text style={styles.rolePanelCopy}>{role === 'admin' ? 'Review cheese submissions, moderate reports, and manage accounts.' : 'Submit missing cheeses and track their review status.'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.wine} />
        </Pressable>
      )}
      {signedIn && <View style={{ marginTop: 18 }}><PrimaryButton label="Sign out" icon="log-out-outline" secondary onPress={() => supabase?.auth.signOut()} /></View>}
    </ScrollView>
  );
}

type PersonalTasting = EditableTasting;

function CheeseModal({ cheese, userId, onSavedChange, onTastingUpdated, onLog, onClose }: { cheese: Cheese | null; userId?: string; onSavedChange: () => void; onTastingUpdated: () => void; onLog: (cheese: Cheese) => void; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [personalTastings, setPersonalTastings] = useState<PersonalTasting[]>([]);
  const [editTasting, setEditTasting] = useState<EditableTasting | null>(null);
  const [historyReload, setHistoryReload] = useState(0);

  useEffect(() => {
    setSaved(false);
    setPersonalTastings([]);
    if (!supabase || !userId || !cheese) return;
    supabase.from('cheeses').select('id').eq('slug', cheese.id).single().then(({ data }) => {
      if (!data) return;
      Promise.all([
        supabase!.from('saved_cheeses').select('cheese_id').eq('user_id', userId).eq('cheese_id', data.id).maybeSingle(),
        supabase!.from('tastings').select('id,rating,notes,location_name,visibility,created_at').eq('user_id', userId).eq('cheese_id', data.id).order('created_at', { ascending: false }),
      ]).then(([savedResult, tastingsResult]) => {
        setSaved(Boolean(savedResult.data));
        setPersonalTastings((tastingsResult.data ?? []).map((row) => ({ ...row, rating: Number(row.rating) })));
      });
    });
  }, [cheese?.id, userId, historyReload]);

  const toggleSaved = async () => {
    if (!supabase || !userId || !cheese) {
      Alert.alert('Sign in required', 'Create or sign in to an account to save cheeses for later.');
      return;
    }
    setSavingBookmark(true);
    const { data: catalogRow, error: catalogError } = await supabase.from('cheeses').select('id').eq('slug', cheese.id).single();
    if (catalogError || !catalogRow) {
      setSavingBookmark(false);
      Alert.alert('Could not save cheese', catalogError?.message ?? 'Catalog entry was not found.');
      return;
    }
    const { error } = saved
      ? await supabase.from('saved_cheeses').delete().eq('user_id', userId).eq('cheese_id', catalogRow.id)
      : await supabase.from('saved_cheeses').insert({ user_id: userId, cheese_id: catalogRow.id });
    setSavingBookmark(false);
    if (error) {
      Alert.alert('Could not update saved cheeses', error.message);
      return;
    }
    setSaved(!saved);
    onSavedChange();
  };

  const reportCheese = async () => {
    if (!supabase || !userId || !cheese) return Alert.alert('Sign in required', 'Sign in to report a catalog entry.');
    const { data: catalogRow, error: catalogError } = await supabase.from('cheeses').select('id').eq('slug', cheese.id).single();
    if (catalogError || !catalogRow) return Alert.alert('Could not report cheese', catalogError?.message ?? 'Catalog entry was not found.');
    chooseReportReason(userId, 'cheese', catalogRow.id);
  };

  if (!cheese) return null;
  const personalAverage = personalTastings.length ? personalTastings.reduce((sum, tasting) => sum + tasting.rating, 0) / personalTastings.length : null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalButton} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
            <Brand compact />
            <Pressable style={styles.modalButton} disabled={savingBookmark} onPress={toggleSaved}>
              {savingBookmark ? <ActivityIndicator size="small" color={colors.wine} /> : <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={colors.wine} />}
            </Pressable>
          </View>
          <View style={[styles.detailHero, { backgroundColor: cheese.color }]}>
            <View style={styles.detailOrb} />
            <CheeseArt name={cheese.name} color={cheese.color} imageUrl={cheese.imageUrl} size={190} />
            <View style={styles.detailStyleWrap}>
              <Text style={styles.detailStyle} numberOfLines={3}>{cheese.style.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.detailTitle}>{cheese.name}</Text>
          <Text style={styles.detailMaker}>by {cheese.creamery}</Text>
          <View style={styles.detailRatingRow}>
            {personalAverage === null ? <Text style={styles.detailLogs}>You haven’t tasted this cheese yet.</Text> : (
              <><Rating value={personalAverage} large /><Text style={styles.detailLogs}>your average from {personalTastings.length} {personalTastings.length === 1 ? 'tasting' : 'tastings'}</Text></>
            )}
          </View>
          <Text style={styles.detailDescription}>{cheese.story}</Text>
          <View style={styles.facts}>
            {[['Creamery', cheese.creamery], ['Location', cheese.location], ['Milk type', cheese.milkType], ['Rennet', cheese.rennet], ['Style', cheese.style], ['Age', cheese.age]].map(([label, value]) => (
              <View key={label} style={styles.fact}><Text style={styles.factLabel}>{label?.toUpperCase()}</Text><Text style={styles.factValue}>{value}</Text></View>
            ))}
          </View>
          <View style={styles.detailSection}>
            <SectionHeader title="Flavor profile" />
            <View style={styles.detailNotes}>{cheese.flavorProfile.map((note) => <View key={note} style={styles.detailNote}><Text style={styles.detailNoteText}>{note}</Text></View>)}</View>
          </View>
          <View style={styles.detailSection}>
            <SectionHeader title="Pair it with" />
            <View style={styles.detailNotes}>{cheese.pairings.map((pairing) => <View key={pairing} style={styles.pairingNote}><Text style={styles.pairingNoteText}>{pairing}</Text></View>)}</View>
          </View>
          {personalTastings.length > 0 && (
            <View style={styles.detailSection}>
              <SectionHeader title="Your tastings" />
              <View style={styles.personalTastingList}>
                {personalTastings.map((tasting) => (
                  <View key={tasting.id} style={styles.personalTastingCard}>
                    <View style={styles.personalTastingHeader}><Rating value={tasting.rating} /><View style={styles.personalTastingHeaderActions}><Text style={styles.personalTastingDate}>{new Date(tasting.created_at).toLocaleDateString()}</Text><Pressable onPress={() => setEditTasting(tasting)}><Ionicons name="pencil-outline" size={16} color={colors.wine} /></Pressable></View></View>
                    {tasting.notes ? <Text style={styles.personalTastingNotes}>{tasting.notes}</Text> : <Text style={styles.personalTastingEmpty}>No tasting notes added.</Text>}
                    {tasting.location_name ? <Text style={styles.personalTastingLocation}><Ionicons name="location-outline" size={12} color={colors.muted} /> {tasting.location_name}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.detailActions}>
            <PrimaryButton label={saved ? 'Saved for later' : 'Save for later'} icon={saved ? 'bookmark' : 'bookmark-outline'} secondary onPress={toggleSaved} />
            <View style={{ height: 10 }} />
            <PrimaryButton label="Log a tasting" icon="add-circle-outline" onPress={() => onLog(cheese)} />
            {userId && <Pressable style={styles.reportCheese} onPress={reportCheese}><Ionicons name="flag-outline" size={15} color={colors.muted} /><Text style={styles.reportCheeseText}>Report catalog information</Text></Pressable>}
          </View>
        </ScrollView>
      </SafeAreaView>
      {userId && <EditTastingModal tasting={editTasting} userId={userId} onSaved={() => { setHistoryReload((value) => value + 1); onTastingUpdated(); }} onClose={() => setEditTasting(null)} />}
    </Modal>
  );
}

function NotificationsModal({ visible, userId, onChanged, onClose }: { visible: boolean; userId?: string; onChanged: () => void; onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; kind: string; read_at: string | null; created_at: string; actor: { display_name: string; handle: string } | null }[]>([]);

  useEffect(() => {
    if (!visible || !supabase || !userId) return;
    supabase.from('notifications').select('id,kind,read_at,created_at,actor:actor_id(display_name,handle)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setItems((data ?? []) as unknown as typeof items));
  }, [visible, userId]);

  const markAllRead = async () => {
    if (!supabase || !userId) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    onChanged();
  };

  const message = (item: typeof items[number]) => {
    const name = item.actor?.display_name ?? 'Someone';
    if (item.kind === 'follow') return `${name} followed you.`;
    if (item.kind === 'like') return `${name} liked your tasting.`;
    if (item.kind === 'comment') return `${name} commented on your tasting.`;
    if (item.kind === 'cheese_approved') return 'Your cheese submission was approved.';
    if (item.kind === 'warn_account') return 'An administrator issued a community warning. Review the Community Guidelines.';
    if (item.kind === 'suspend_account') return 'Your account has been suspended. Contact support if you believe this is an error.';
    if (item.kind === 'restore_account') return 'Your account access has been restored.';
    return 'Your cheese submission needs revision.';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.commentsPage}>
        <View style={styles.commentsHeader}>
          <Pressable style={styles.modalButton} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
          <Text style={styles.commentsTitle}>Notifications</Text>
          <Pressable onPress={markAllRead}><Text style={styles.markRead}>Read all</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.notificationList}>
          {items.length ? items.map((item) => (
            <View key={item.id} style={[styles.notificationItem, !item.read_at && styles.notificationUnread]}>
              <View style={styles.notificationIcon}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'comment' ? 'chatbubble-outline' : item.kind.includes('account') ? 'shield-outline' : 'heart-outline'} size={19} color={colors.wine} /></View>
              <View style={{ flex: 1 }}><Text style={styles.notificationText}>{message(item)}</Text><Text style={styles.notificationTime}>{new Date(item.created_at).toLocaleDateString()}</Text></View>
              {!item.read_at && <View style={styles.unreadDot} />}
            </View>
          )) : <View style={styles.emptyNotification}><Ionicons name="notifications-outline" size={39} color={colors.sage} /><Text style={styles.emptyNotificationTitle}>All quiet at the cheese table</Text><Text style={styles.emptyComments}>New follows, likes, and comments will appear here.</Text></View>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PasswordResetModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const update = async () => {
    if (!supabase || password.length < 8 || password !== confirm) {
      return Alert.alert('Check your password', 'Use at least 8 characters and make sure both entries match.');
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return Alert.alert('Could not update password', error.message);
    setPassword('');
    setConfirm('');
    Alert.alert('Password updated', 'Your new password is ready to use.', [{ text: 'Done', onPress: onClose }]);
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.resetPage}>
        <View style={styles.resetIcon}><Ionicons name="key-outline" size={30} color={colors.wine} /></View>
        <Text style={styles.resetTitle}>Choose a new password</Text>
        <Text style={styles.resetCopy}>Use at least eight characters. A longer, unique password is best.</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="New password" placeholderTextColor="#9B958A" style={styles.resetInput} />
        <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Confirm password" placeholderTextColor="#9B958A" style={styles.resetInput} />
        {saving ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label="Update password" icon="checkmark-circle-outline" onPress={update} />}
      </SafeAreaView>
    </Modal>
  );
}

function Root({ profile, signedIn, userId, onProfileUpdated }: { profile: UserProfile | null; signedIn: boolean; userId?: string; onProfileUpdated: () => void }) {
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedCheese, setSelectedCheese] = useState<Cheese | null>(null);
  const [logCheese, setLogCheese] = useState<Cheese | null>(null);
  const [catalog, setCatalog] = useState<Cheese[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedReload, setFeedReload] = useState(0);
  const [savedReload, setSavedReload] = useState(0);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [catalogManagementOpen, setCatalogManagementOpen] = useState(false);
  const [catalogReload, setCatalogReload] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [usingOfflineData, setUsingOfflineData] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<'followers' | 'following'>('followers');
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionReload, setConnectionReload] = useState(0);
  const openNotifications = () => signedIn ? setNotificationsOpen(true) : Alert.alert('Sign in required', 'Create an account to receive community notifications.');
  const refreshCommunity = () => {
    setFeedReload((value) => value + 1);
    setCatalogReload((value) => value + 1);
  };

  const loadUnread = async () => {
    if (!supabase || !userId) return setUnreadCount(0);
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    loadUnread();
    if (!supabase || !userId) return;
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, loadUnread)
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const cached = readCache<Cheese[]>('catalog');
    if (cached?.length) {
      setCatalog(cached);
      setCatalogLoading(false);
    }
    setCatalogLoading(true);
    setCatalogError(null);
    Promise.all([
      supabase.from('cheeses').select('*,cheese_photos(storage_path,moderation_status)').eq('status', 'published').order('name'),
      supabase.rpc('cheese_rating_summary'),
    ]).then(([catalogResult, ratingsResult]) => {
      const { data, error } = catalogResult;
      setCatalogLoading(false);
      if (error) {
        setCatalogError('The cheese catalog could not be loaded. Check your connection and try again.');
        setUsingOfflineData(Boolean(cached?.length));
        retryTimer = setTimeout(() => setCatalogReload((value) => value + 1), 12000);
        return;
      }
      if (!data?.length) return;
      const ratings = new Map<string, { average: number; count: number }>((ratingsResult.data ?? []).map((row: { cheese_id: string; average_rating: number | string; rating_count: number | string }) => [row.cheese_id, {
        average: Number(row.average_rating),
        count: Number(row.rating_count),
      }]));
      const live = data.map((row) => {
        const catalogPhotos = row.cheese_photos as { storage_path: string; moderation_status: string }[] | null;
        const approvedPhoto = catalogPhotos?.find((photo) => photo.moderation_status === 'approved');
        return ({
        id: row.slug,
        name: row.name,
        creamery: row.creamery_name,
        location: [row.location_city, row.location_region, row.location_country].filter(Boolean).join(', '),
        milkType: row.milk_type,
        rennet: row.rennet,
        style: row.cheese_style,
        category: row.catalog_category ?? 'Uncategorized',
        age: row.age_description,
        flavorProfile: row.flavor_profile,
        story: row.story_notes,
        pairings: row.pairings,
        rating: ratings.get(row.id)?.average ?? 0,
        logs: ratings.get(row.id)?.count ?? 0,
        color: colors.gold,
        createdAt: row.created_at,
        imageUrl: approvedPhoto ? supabase!.storage.from('cheese-photos').getPublicUrl(approvedPhoto.storage_path).data.publicUrl : undefined,
      } satisfies Cheese);
      });
      setCatalog(live);
      writeCache('catalog', live);
      setUsingOfflineData(false);
    });
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [catalogReload]);

  useEffect(() => {
    if (!supabase || tab !== 'feed') return;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const cached = readCache<Post[]>('feed');
    if (cached?.length) setFeedPosts(cached);
    setRefreshingFeed(true);
    setFeedError(null);
    supabase
      .from('tastings')
      .select('id,rating,notes,location_name,created_at,user_id,cheese_id,profiles:user_id(display_name,handle,role,avatar_path),cheeses:cheese_id(slug,name),tasting_photos(storage_path,moderation_status),likes(count),comments(count)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        setRefreshingFeed(false);
        if (error) {
          setFeedError('The community feed could not be loaded. Pull to refresh or try again.');
          setUsingOfflineData(Boolean(cached?.length));
          retryTimer = setTimeout(() => setFeedReload((value) => value + 1), 12000);
          return;
        }
        if (!data?.length) {
          setFeedPosts([]);
          return;
        }
        Promise.all(data.map(async (row) => {
          const author = row.profiles as unknown as { display_name: string; handle: string; role: Role; avatar_path: string | null };
          const cheese = row.cheeses as unknown as { slug: string; name: string };
          const photos = row.tasting_photos as unknown as { storage_path: string; moderation_status: string }[];
          const likes = row.likes as unknown as { count: number }[];
          const comments = row.comments as unknown as { count: number }[];
          const signed = photos?.[0] ? await supabase!.storage.from('tasting-photos').createSignedUrl(photos[0].storage_path, 3600) : null;
          const initials = author.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
          const minutes = Math.max(1, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000));
          return {
            id: row.id,
            user: author.display_name,
            handle: `@${author.handle}`,
            initials,
            role: author.role,
            userId: row.user_id,
            cheeseId: cheese.slug,
            rating: Number(row.rating),
            note: row.notes || `Tasted ${cheese.name}.`,
            place: row.location_name || 'Location not added',
            time: minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`,
            likes: likes?.[0]?.count ?? 0,
            comments: comments?.[0]?.count ?? 0,
            avatarUrl: author.avatar_path ? supabase!.storage.from('profile-avatars').getPublicUrl(author.avatar_path).data.publicUrl : undefined,
            photoUrl: signed?.data?.signedUrl,
            photoPending: photos?.[0]?.moderation_status === 'pending',
          };
        })).then((posts) => {
          setFeedPosts(posts);
          writeCache('feed', posts);
          setUsingOfflineData(false);
        });
      });
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [tab, feedReload]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && usingOfflineData) {
        setCatalogReload((value) => value + 1);
        setFeedReload((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, [usingOfflineData]);

  const screen = tab === 'feed' ? <FeedScreen openCheese={setSelectedCheese} openProfile={setPublicProfileId} catalog={catalog} feedPosts={feedPosts} profile={profile} userId={userId} refreshing={refreshingFeed} error={feedError} unreadCount={unreadCount} onRefresh={refreshCommunity} onLog={() => { setLogCheese(null); setTab('log'); }} onNotifications={openNotifications} />
    : tab === 'discover' ? <DiscoverScreen openCheese={setSelectedCheese} catalog={catalog} loading={catalogLoading} error={catalogError} unreadCount={unreadCount} onRetry={() => setCatalogReload((value) => value + 1)} onNotifications={openNotifications} />
    : tab === 'log' ? <LogScreen onComplete={() => { refreshCommunity(); setLogCheese(null); setTab('feed'); }} catalog={catalog} initialCheese={logCheese} userId={userId} unreadCount={unreadCount} onNotifications={openNotifications} />
    : tab === 'cellar' ? <CellarScreen openCheese={setSelectedCheese} catalog={catalog} userId={userId} reload={feedReload + savedReload} unreadCount={unreadCount} onNotifications={openNotifications} />
    : <ProfileScreen profile={profile} signedIn={signedIn} statsReload={connectionReload} unreadCount={unreadCount} onEdit={() => setEditProfileOpen(true)} onConnections={(nextTab) => { setConnectionsTab(nextTab); setConnectionsOpen(true); }} onManageCatalog={() => setCatalogManagementOpen(true)} onSafety={() => setSafetyOpen(true)} onNotifications={openNotifications} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {usingOfflineData && <View style={styles.offlineBanner}><Ionicons name="cloud-offline-outline" size={14} color={colors.white} /><Text style={styles.offlineBannerText}>Offline — showing saved data. We’ll reconnect automatically.</Text></View>}
      <View style={styles.app}>{screen}</View>
      <View style={styles.tabBar}>
        {tabItems.map((item) => {
          const active = tab === item.id;
          const isLog = item.id === 'log';
          return (
            <Pressable key={item.id} onPress={() => { if (item.id === 'log') setLogCheese(null); setTab(item.id); }} style={styles.tabItem}>
              <View style={isLog ? styles.logButton : undefined}>
                <Ionicons name={active ? item.active : item.icon} size={isLog ? 27 : 22} color={isLog ? colors.white : active ? colors.wine : colors.muted} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive, isLog && { marginTop: 4 }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <CheeseModal cheese={selectedCheese} userId={userId} onSavedChange={() => setSavedReload((value) => value + 1)} onTastingUpdated={refreshCommunity} onLog={(cheese) => { setSelectedCheese(null); setLogCheese(cheese); setTab('log'); }} onClose={() => setSelectedCheese(null)} />
      {profile && userId && <CatalogManagement visible={catalogManagementOpen} role={profile.role} userId={userId} onClose={() => { setCatalogManagementOpen(false); setCatalogReload((value) => value + 1); }} />}
      <NotificationsModal visible={notificationsOpen} userId={userId} onChanged={loadUnread} onClose={() => setNotificationsOpen(false)} />
      {userId && <SafetyCenter visible={safetyOpen} userId={userId} onClose={() => setSafetyOpen(false)} />}
      {profile && <EditProfileModal visible={editProfileOpen} profile={profile} onSaved={() => { onProfileUpdated(); refreshCommunity(); }} onClose={() => setEditProfileOpen(false)} />}
      {userId && <ConnectionsModal visible={connectionsOpen} userId={userId} initialTab={connectionsTab} onChanged={() => setConnectionReload((value) => value + 1)} onOpenProfile={(id) => { setConnectionsOpen(false); setPublicProfileId(id); }} onClose={() => setConnectionsOpen(false)} />}
      <PublicProfileModal profileId={publicProfileId} currentUserId={userId} onChanged={() => { setConnectionReload((value) => value + 1); refreshCommunity(); }} onClose={() => setPublicProfileId(null)} />
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profileReload, setProfileReload] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setGuest(false);
      if (!nextSession) setProfile(null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const handleUrl = async (url: string) => {
      const parameters = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
      const accessToken = parameters.get('access_token');
      const refreshToken = parameters.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error && parameters.get('type') === 'recovery') setPasswordRecovery(true);
      }
    };
    Linking.getInitialURL().then((url) => { if (url) return handleUrl(url); });
    const listener = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setProfile(null);
      return;
    }
    supabase.from('profiles').select('id,handle,display_name,bio,location,avatar_path,role,role_approved,account_status,moderation_note').eq('id', session.user.id).single()
      .then(async ({ data }) => {
        const nextProfile = data as UserProfile | null;
        if (nextProfile?.account_status === 'suspended') {
          Alert.alert('Account suspended', nextProfile.moderation_note || 'This account has been suspended. Contact support@thecurdnerd.com if you believe this is an error.');
          await supabase!.auth.signOut();
          return;
        }
        setProfile(nextProfile);
        if (nextProfile?.account_status === 'warned') {
          Alert.alert('Community warning', nextProfile.moderation_note || 'An administrator issued a warning for this account. Please review the Community Guidelines.');
        }
      });
  }, [session, profileReload]);

  return (
    <SafeAreaProvider>
      {loadingSession ? (
        <SafeAreaView style={styles.authLoading}><ActivityIndicator color={colors.wine} /></SafeAreaView>
      ) : session || guest || !isSupabaseConfigured ? (
        <Root profile={profile} signedIn={Boolean(session)} userId={session?.user.id} onProfileUpdated={() => setProfileReload((value) => value + 1)} />
      ) : (
        <AuthScreen onGuest={() => setGuest(true)} />
      )}
      <PasswordResetModal visible={passwordRecovery} onClose={() => setPasswordRecovery(false)} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  offlineBanner: { minHeight: 34, paddingHorizontal: 14, backgroundColor: colors.wine, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  offlineBannerText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  authLoading: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  resetPage: { flex: 1, backgroundColor: colors.paper, padding: 25, justifyContent: 'center' },
  resetIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  resetTitle: { color: colors.ink, fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 18 },
  resetCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginVertical: 10 },
  resetInput: { height: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, marginBottom: 10 },
  app: { flex: 1 },
  retryState: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 24, borderRadius: 18, backgroundColor: colors.cream, marginBottom: 18 },
  retryText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  retryButton: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.blush },
  retryButtonText: { color: colors.wine, fontSize: 10, fontWeight: '800' },
  screenContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 0 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.wine, position: 'absolute', right: 2, top: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cream },
  notificationBadgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
  eyebrow: { color: colors.wine, fontSize: 9, fontWeight: '800', letterSpacing: 1.7, marginBottom: 4 },
  pageTitle: { color: colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.9 },
  welcomeRow: { marginTop: 8, marginBottom: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 28, color: colors.ink, fontWeight: '700', letterSpacing: -1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  promptCard: { backgroundColor: colors.cream, borderRadius: 20, padding: 17, marginBottom: 27, borderWidth: 1, borderColor: colors.line },
  promptTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promptIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  promptTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  promptCopy: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  promptDivider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  promptStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  promptStat: { fontSize: 11, color: colors.muted },
  promptStatStrong: { color: colors.ink, fontWeight: '900' },
  miniDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  postCard: { backgroundColor: colors.white, borderRadius: 23, marginBottom: 23, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow },
  postHeader: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  postAvatarImage: { width: 39, height: 39, borderRadius: 20 },
  postAvatarText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  postMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  followButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.blush, borderRadius: 12 },
  followText: { color: colors.wine, fontSize: 9, fontWeight: '800' },
  postMenu: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  featureArt: { height: 215, backgroundColor: '#E9DFC9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  pendingPhotoBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(75,30,42,0.9)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pendingPhotoText: { color: colors.white, fontSize: 8, fontWeight: '800' },
  artGlow: { position: 'absolute', width: 270, height: 270, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.30)', top: -75, right: -20 },
  postBody: { padding: 16 },
  postCheeseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  postCheeseInfo: { flex: 1, minWidth: 0 },
  postCheese: { fontSize: 18, fontWeight: '800', color: colors.ink },
  postMaker: { color: colors.muted, fontSize: 10, marginTop: 3 },
  postNote: { color: '#4D4942', fontSize: 13, lineHeight: 20, marginTop: 13 },
  locationRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 12 },
  locationText: { color: colors.muted, fontSize: 10 },
  socialRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 14, paddingTop: 13, flexDirection: 'row', alignItems: 'center', gap: 22 },
  socialAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  commentsPage: { flex: 1, backgroundColor: colors.paper },
  commentsHeader: { height: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  commentsTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  commentsList: { padding: 18, gap: 14, flexGrow: 1 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: colors.white, fontWeight: '800' },
  commentBubble: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 12 },
  commentMenu: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  commentName: { color: colors.ink, fontWeight: '800', fontSize: 11 },
  commentHandle: { color: colors.muted, fontWeight: '500' },
  commentBody: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 5 },
  emptyComments: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 13 },
  commentComposer: { padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  commentInput: { flex: 1, minHeight: 45, maxHeight: 100, backgroundColor: colors.cream, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 12, color: colors.ink },
  commentSend: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  markRead: { color: colors.wine, fontSize: 10, fontWeight: '800' },
  notificationList: { padding: 16, gap: 9, flexGrow: 1 },
  notificationItem: { minHeight: 70, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  notificationUnread: { backgroundColor: colors.blush },
  notificationIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  notificationText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  notificationTime: { color: colors.muted, fontSize: 9, marginTop: 4 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.wine },
  emptyNotification: { alignItems: 'center', paddingTop: 80 },
  emptyNotificationTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 12 },
  searchBox: { height: 52, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 9, ...shadow },
  searchInput: { flex: 1, paddingHorizontal: 10, color: colors.ink, fontSize: 14 },
  searchHint: { color: colors.muted, fontSize: 10, marginTop: 8, marginBottom: 10 },
  cheesePickerResults: { maxHeight: 225, marginBottom: 8 },
  selectedCheeseSummary: { minHeight: 70, padding: 11, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 11, ...shadow },
  changeCheese: { color: colors.wine, fontSize: 11, fontWeight: '800' },
  noSearchResults: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: 18 },
  filterRow: { gap: 8, paddingVertical: 16 },
  filterPill: { paddingHorizontal: 15, height: 35, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  filterPillActive: { backgroundColor: colors.wine, borderColor: colors.wine },
  filterText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  filterTextActive: { color: colors.white },
  sortLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginBottom: 7 },
  sortRow: { gap: 7, paddingBottom: 18 },
  sortPill: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  sortPillActive: { backgroundColor: colors.blush },
  sortText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  sortTextActive: { color: colors.wine },
  discoveryLabel: { color: colors.wine, fontSize: 9, letterSpacing: 1.5, fontWeight: '900', marginTop: 5, marginBottom: 10 },
  featuredCard: { minHeight: 220, backgroundColor: colors.wineDark, borderRadius: 22, padding: 20, marginBottom: 27, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  featuredKicker: { color: '#E6C981', fontSize: 8, letterSpacing: 1.5, fontWeight: '900' },
  featuredTitle: { color: colors.white, fontSize: 29, lineHeight: 31, fontWeight: '800', marginTop: 9, letterSpacing: -0.7 },
  featuredCopy: { color: '#E7D9DB', fontSize: 11, lineHeight: 16, width: 165, marginTop: 9 },
  featuredLink: { color: colors.white, fontWeight: '800', fontSize: 11, marginTop: 15 },
  cheeseList: { gap: 10, marginBottom: 18 },
  cheeseRow: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line },
  cheeseName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  cheeseMaker: { color: colors.wine, fontSize: 10, fontWeight: '700', marginTop: 3 },
  cheeseMetaRow: { flexDirection: 'row', marginTop: 7 },
  cheeseMeta: { color: colors.muted, fontSize: 10 },
  communityRating: { alignItems: 'flex-end', gap: 3 },
  communityRatingCount: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  unratedText: { color: colors.muted, fontSize: 9, fontStyle: 'italic' },
  fieldLabel: { color: colors.muted, fontWeight: '900', fontSize: 9, letterSpacing: 1.5, marginTop: 18, marginBottom: 10 },
  selectCheese: { minHeight: 66, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 10, gap: 10, flexDirection: 'row', alignItems: 'center' },
  selectCheeseActive: { borderWidth: 2, borderColor: colors.wine },
  selectCheeseName: { fontSize: 11, fontWeight: '800', color: colors.ink },
  selectCheeseMaker: { fontSize: 9, color: colors.muted, marginTop: 3 },
  selectedCheck: { position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  ratingPanel: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 22, marginTop: 18, paddingVertical: 22, paddingHorizontal: 25 },
  ratingNumber: { color: colors.ink, fontSize: 46, fontWeight: '800', letterSpacing: -2 },
  stars: { flexDirection: 'row', gap: 6, marginTop: 5 },
  ratingScale: { width: '100%', marginTop: 11, flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { color: colors.muted, fontWeight: '700', fontSize: 7, letterSpacing: 1 },
  noteInput: { minHeight: 118, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 15, color: colors.ink, textAlignVertical: 'top', fontSize: 13, lineHeight: 20 },
  quickNotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  noteChip: { backgroundColor: colors.blush, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14 },
  noteChipText: { color: colors.wine, fontSize: 10, fontWeight: '700' },
  addOns: { marginVertical: 20, borderTopWidth: 1, borderTopColor: colors.line },
  addOn: { minHeight: 55, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationEditor: { minHeight: 55, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 9 },
  locationInput: { flex: 1, color: colors.ink, fontSize: 13, paddingVertical: 12 },
  addOnText: { flex: 1, color: colors.ink, fontWeight: '700', fontSize: 13 },
  addOnSub: { color: colors.muted, fontSize: 9, marginTop: 2 },
  photoThumb: { width: 38, height: 38, borderRadius: 10 },
  switch: { width: 40, height: 23, borderRadius: 13, backgroundColor: colors.line, padding: 3 },
  switchActive: { backgroundColor: colors.wine },
  switchKnob: { width: 17, height: 17, backgroundColor: colors.white, borderRadius: 9 },
  switchKnobActive: { marginLeft: 17 },
  cellarSummary: { marginTop: 10, padding: 20, borderRadius: 20, backgroundColor: colors.wine, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 35, paddingHorizontal: 24 },
  emptyStateTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 9 },
  emptyStateCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  summaryNumber: { color: colors.white, textAlign: 'center', fontSize: 25, fontWeight: '800' },
  summaryLabel: { color: '#E6C9D1', marginTop: 3, fontSize: 8, letterSpacing: 1.2, fontWeight: '800' },
  summaryDivider: { width: 1, height: 31, backgroundColor: 'rgba(255,255,255,0.25)' },
  segment: { height: 44, borderRadius: 15, padding: 4, marginVertical: 20, backgroundColor: colors.cream, flexDirection: 'row' },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: colors.wine },
  profileHero: { alignItems: 'center', paddingTop: 12, paddingBottom: 26 },
  profileAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.wine, borderWidth: 5, borderColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  profileAvatarImage: { width: 76, height: 76, borderRadius: 38 },
  profileInitials: { color: colors.white, fontSize: 24, fontWeight: '800' },
  profileName: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 13 },
  profileHandle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  roleBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.blush, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, marginTop: 10 },
  roleText: { color: colors.wine, fontWeight: '800', fontSize: 10 },
  bio: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 290, marginTop: 12 },
  editProfileButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.blush, marginTop: 12 },
  editProfileText: { color: colors.wine, fontSize: 10, fontWeight: '800' },
  followStats: { flexDirection: 'row', gap: 35, marginTop: 20 },
  followStat: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 17 },
  followStrong: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  palateCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 24, marginBottom: 25, alignItems: 'center' },
  palateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7, marginTop: 5 },
  palateLabel: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  palateValue: { color: colors.muted, fontWeight: '800', fontSize: 11 },
  progressTrack: { height: 7, borderRadius: 5, backgroundColor: colors.cream, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.wine, borderRadius: 5 },
  roleHelper: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: -6, marginBottom: 12 },
  rolePicker: { flexDirection: 'row', gap: 7 },
  roleOption: { flex: 1, paddingVertical: 12, gap: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center', backgroundColor: colors.white },
  roleOptionActive: { backgroundColor: colors.wine, borderColor: colors.wine },
  roleOptionText: { color: colors.wine, fontSize: 9, fontWeight: '800' },
  rolePanel: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.blush, padding: 16, borderRadius: 18, marginTop: 12 },
  rolePanelTitle: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  rolePanelCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  tabBar: { height: 76, paddingBottom: 6, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 5 },
  tabLabelActive: { color: colors.wine },
  logButton: { width: 49, height: 49, marginTop: -28, borderRadius: 25, backgroundColor: colors.wine, borderWidth: 4, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', ...shadow },
  modalSafe: { flex: 1, backgroundColor: colors.paper },
  detailContent: { paddingBottom: 30 },
  modalHeader: { height: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  detailHero: { height: 290, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  detailOrb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.18)' },
  detailStyleWrap: { position: 'absolute', left: 18, right: 18, bottom: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(55,35,20,0.28)' },
  detailStyle: { color: colors.white, fontSize: 9, lineHeight: 14, letterSpacing: 1.5, fontWeight: '900', textAlign: 'center' },
  detailTitle: { marginTop: 25, paddingHorizontal: 20, color: colors.ink, textAlign: 'center', fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  detailMaker: { color: colors.wine, textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 5 },
  detailRatingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, marginTop: 13 },
  detailLogs: { color: colors.muted, fontSize: 10 },
  detailDescription: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 31, marginTop: 19 },
  facts: { margin: 20, paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', flexWrap: 'wrap' },
  fact: { width: '50%', paddingVertical: 9, paddingHorizontal: 12 },
  factLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  factValue: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  detailNotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  detailSection: { marginTop: 8 },
  detailNote: { paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.cream, borderRadius: 16 },
  detailNoteText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  pairingNote: { paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.blush, borderRadius: 16 },
  pairingNoteText: { color: colors.wine, fontSize: 11, fontWeight: '700' },
  detailActions: { padding: 20 },
  reportCheese: { marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  reportCheeseText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  personalTastingList: { gap: 10, paddingHorizontal: 20 },
  personalTastingCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 },
  personalTastingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personalTastingHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personalTastingDate: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  personalTastingNotes: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 9 },
  personalTastingEmpty: { color: colors.muted, fontSize: 11, fontStyle: 'italic', marginTop: 9 },
  personalTastingLocation: { color: colors.muted, fontSize: 10, marginTop: 8 },
});
