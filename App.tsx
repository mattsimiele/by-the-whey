import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import { Brand, CheeseArt, PrimaryButton, Rating, SectionHeader } from './src/components';
import { Cheese, Post, Role } from './src/data';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { colors, shadow } from './src/theme';

type Tab = 'feed' | 'discover' | 'log' | 'cellar' | 'profile';
type UserProfile = { id: string; handle: string; display_name: string; bio: string; location: string | null; role: Role; role_approved: boolean };

const tabItems: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'feed', label: 'Feed', icon: 'home-outline', active: 'home' },
  { id: 'discover', label: 'Discover', icon: 'search-outline', active: 'search' },
  { id: 'log', label: 'Log', icon: 'add', active: 'add' },
  { id: 'cellar', label: 'Cellar', icon: 'bookmark-outline', active: 'bookmark' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', active: 'person' },
];

function AppHeader({ title, subtitle, onNotifications }: { title?: string; subtitle?: string; onNotifications?: () => void }) {
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
        <View style={styles.notificationDot} />
      </Pressable>
    </View>
  );
}

function FeedScreen({ openCheese, catalog, feedPosts, profile, userId, refreshing, onRefresh, onNotifications }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[]; feedPosts: Post[]; profile: UserProfile | null; userId?: string; refreshing: boolean; onRefresh: () => void; onNotifications: () => void }) {
  const [liked, setLiked] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const initials = (profile?.display_name ?? 'Guest').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.wine} colors={[colors.wine]} />}
    >
      <AppHeader onNotifications={onNotifications} />
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
          <Text style={styles.heroTitle}>Welcome, {profile?.display_name ?? 'cheese lover'}.</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
      </View>

      <View style={styles.promptCard}>
        <View style={styles.promptTop}>
          <View style={styles.promptIcon}><Ionicons name="restaurant-outline" size={20} color={colors.wine} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promptTitle}>What’s on your board?</Text>
            <Text style={styles.promptCopy}>Log a tasting and share it with the community.</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.wine} />
        </View>
      </View>

      <SectionHeader title="From your circle" action="See all" />
      {!feedPosts.length && (
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
              <View style={[styles.postAvatar, { backgroundColor: post.role === 'cheesemonger' ? colors.wine : colors.sage }]}>
                <Text style={styles.postAvatarText}>{post.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.postName}>{post.user}</Text>
                  {post.role === 'cheesemonger' && <Ionicons name="checkmark-circle" size={15} color={colors.wine} />}
                </View>
                <Text style={styles.postMeta}>{post.handle} · {post.time}</Text>
              </View>
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
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
            </View>
            <Pressable style={styles.featureArt} onPress={() => openCheese(cheese)}>
              {post.photoUrl ? <Image source={{ uri: post.photoUrl }} style={styles.postPhoto} /> : (
                <>
                  <View style={styles.artGlow} />
                  <CheeseArt name={cheese.name} color={cheese.color} size={132} />
                </>
              )}
              <View style={styles.artLabel}>
                <Text style={styles.artLabelOverline}>{cheese.style.toUpperCase()}</Text>
                <Text style={styles.artLabelTitle}>{cheese.name}</Text>
                <Text style={styles.artLabelMaker}>{cheese.creamery}</Text>
              </View>
            </Pressable>
            <View style={styles.postBody}>
              <View style={styles.postCheeseRow}>
                <View>
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
                  if (userId && supabase && post.id.includes('-')) {
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
                <Pressable style={styles.socialAction} onPress={() => post.id.includes('-') ? setCommentPost(post) : Alert.alert('Prototype post', 'Comments are available on live community tastings.')}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.ink} />
                  <Text style={styles.socialText}>{post.comments}</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Ionicons name="share-outline" size={20} color={colors.ink} />
              </View>
            </View>
          </View>
        );
      })}
      <CommentsModal post={commentPost} userId={userId} onClose={() => setCommentPost(null)} />
    </ScrollView>
  );
}

function CommentsModal({ post, userId, onClose }: { post: Post | null; userId?: string; onClose: () => void }) {
  const [comments, setComments] = useState<{ id: string; body: string; created_at: string; profiles: { display_name: string; handle: string } }[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!supabase || !post) return;
    const { data } = await supabase.from('comments').select('id,body,created_at,profiles:user_id(display_name,handle)').eq('tasting_id', post.id).order('created_at');
    setComments((data ?? []) as unknown as typeof comments);
  };

  useEffect(() => { load(); }, [post?.id]);

  const send = async () => {
    if (!supabase || !post || !userId || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({ tasting_id: post.id, user_id: userId, body: body.trim() });
    setSending(false);
    if (error) return Alert.alert('Could not comment', error.message);
    setBody('');
    load();
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

function DiscoverScreen({ openCheese, catalog, onNotifications }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[]; onNotifications: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Alpine', 'Blue Cheese', 'Cheddar', 'Fresh Cheese', 'Gouda', 'Hard Aged Cheese', 'Soft Cheese', 'Tomme Style', 'Washed Rind'];
  const results = useMemo(() => catalog.filter((cheese) => {
    const matchesQuery = `${cheese.name} ${cheese.creamery} ${cheese.location} ${cheese.style} ${cheese.category} ${cheese.flavorProfile.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'All' || cheese.category === filter;
    return matchesQuery && matchesFilter;
  }), [query, filter, catalog]);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <AppHeader title="Discover" subtitle="FIND YOUR NEXT FAVORITE" onNotifications={onNotifications} />
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

      <SectionHeader title={`${results.length} ${filter === 'All' ? 'cheeses' : filter}`} />
      <View style={styles.cheeseList}>
        {results.map((cheese) => (
          <Pressable key={cheese.id} style={styles.cheeseRow} onPress={() => openCheese(cheese)}>
            <CheeseArt name={cheese.name} color={cheese.color} size={70} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cheeseName}>{cheese.name}</Text>
              <Text style={styles.cheeseMaker}>{cheese.creamery}</Text>
              <View style={styles.cheeseMetaRow}>
                <Text style={styles.cheeseMeta}>{cheese.milkType} · {cheese.style}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 12 }}>
              <Rating value={cheese.rating} />
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </View>
          </Pressable>
        ))}
      </View>
      {!results.length && <View style={styles.emptyState}><Ionicons name="search-outline" size={36} color={colors.sage} /><Text style={styles.emptyStateTitle}>No cheeses found</Text><Text style={styles.emptyStateCopy}>Try another name, maker, region, or category.</Text></View>}
    </ScrollView>
  );
}

function LogScreen({ onComplete, catalog, userId, onNotifications }: { onComplete: () => void; catalog: Cheese[]; userId?: string; onNotifications: () => void }) {
  const [selected, setSelected] = useState<Cheese | null>(null);
  const [cheeseQuery, setCheeseQuery] = useState('');
  const [rating, setRating] = useState(4.5);
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const cheeseResults = useMemo(() => {
    const normalized = cheeseQuery.trim().toLowerCase();
    if (!normalized) return catalog.slice(0, 12);
    return catalog.filter((cheese) => `${cheese.name} ${cheese.creamery} ${cheese.location} ${cheese.category}`.toLowerCase().includes(normalized)).slice(0, 30);
  }, [catalog, cheeseQuery]);

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
      visibility: isPublic ? 'public' : 'private',
    }).select('id').single();
    if (!error && tasting && photo) {
      const extension = photo.mimeType.includes('png') ? 'png' : photo.mimeType.includes('webp') ? 'webp' : 'jpg';
      const storagePath = `${userId}/${tasting.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('tasting-photos')
        .upload(storagePath, decode(photo.base64), { contentType: photo.mimeType, upsert: false });
      if (uploadError) {
        setSaving(false);
        Alert.alert('Tasting saved without photo', uploadError.message);
        setNote('');
        setPhoto(null);
        onComplete();
        return;
      }
      await supabase.from('tasting_photos').insert({ tasting_id: tasting.id, storage_path: storagePath });
    }
    setSaving(false);
    if (error) {
      Alert.alert('Could not log tasting', error.message);
      return;
    }
    Alert.alert('Tasting logged', `${selected.name} has been added to your cheese diary${isPublic ? ' and shared with your circle' : ''}.`);
    setNote('');
    setPhoto(null);
    onComplete();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <AppHeader title="Log a tasting" subtitle="CAPTURE THE MOMENT" onNotifications={onNotifications} />
        <Text style={styles.fieldLabel}>WHAT ARE YOU TASTING?</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput value={cheeseQuery} onChangeText={setCheeseQuery} placeholder="Search cheese, maker, or category…" placeholderTextColor="#9B958A" style={styles.searchInput} />
          {cheeseQuery ? <Pressable onPress={() => setCheeseQuery('')}><Ionicons name="close-circle" size={21} color={colors.muted} /></Pressable> : null}
        </View>
        <Text style={styles.searchHint}>{cheeseQuery ? `${cheeseResults.length} matching cheeses` : 'Start typing or choose from the first 12 cheeses'}</Text>
        <View style={styles.cheesePickerResults}>
          {cheeseResults.map((cheese) => (
            <Pressable key={cheese.id} onPress={() => setSelected(cheese)} style={[styles.selectCheese, selected?.id === cheese.id && styles.selectCheeseActive]}>
              <CheeseArt name={cheese.name} color={cheese.color} size={44} />
              <View style={{ flex: 1 }}><Text style={styles.selectCheeseName}>{cheese.name}</Text><Text style={styles.selectCheeseMaker}>{cheese.creamery} · {cheese.category}</Text></View>
              {selected?.id === cheese.id && <View style={styles.selectedCheck}><Ionicons name="checkmark" size={12} color={colors.white} /></View>}
            </Pressable>
          ))}
        </View>
        {!cheeseResults.length && <Text style={styles.noSearchResults}>No matching cheeses. A cheesemonger can submit a missing catalog entry.</Text>}

        <View style={styles.ratingPanel}>
          <Text style={styles.fieldLabel}>YOUR RATING</Text>
          <Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)}>
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
          <View style={styles.addOn}><Ionicons name="location-outline" size={21} color={colors.wine} /><Text style={styles.addOnText}>Add location</Text><Ionicons name="chevron-forward" size={17} color={colors.muted} /></View>
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

function CellarScreen({ openCheese, catalog, userId, reload, onNotifications }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[]; userId?: string; reload: number; onNotifications: () => void }) {
  const [segment, setSegment] = useState<'Tasted' | 'Want to try'>('Tasted');
  const [entries, setEntries] = useState<CellarEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !userId || !catalog.length) {
      setEntries([]);
      return;
    }
    setLoading(true);
    supabase.from('tastings').select('rating,created_at,cheeses:cheese_id(slug)').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => {
        const grouped = new Map<string, { ratings: number[]; lastTasted: string }>();
        for (const row of data ?? []) {
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
        setLoading(false);
      });
  }, [userId, catalog, reload]);

  const stylesExplored = new Set(entries.map((entry) => entry.cheese.category)).size;
  const regionsExplored = new Set(entries.map((entry) => entry.cheese.location)).size;
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <AppHeader title="My cellar" subtitle="YOUR CHEESE JOURNEY" onNotifications={onNotifications} />
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
            <CheeseArt name={entry.cheese.name} color={entry.cheese.color} size={70} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cheeseName}>{entry.cheese.name}</Text>
              <Text style={styles.cheeseMaker}>{entry.cheese.creamery}</Text>
              <Text style={styles.cheeseMeta}>Tasted {entry.count} {entry.count === 1 ? 'time' : 'times'} · Last {new Date(entry.lastTasted).toLocaleDateString()}</Text>
            </View>
            <Rating value={entry.average} />
          </Pressable>
        ))}
        {!loading && ((segment === 'Tasted' && !entries.length) || segment === 'Want to try') && (
          <View style={styles.emptyState}>
            <Ionicons name={segment === 'Tasted' ? 'restaurant-outline' : 'bookmark-outline'} size={36} color={colors.sage} />
            <Text style={styles.emptyStateTitle}>{segment === 'Tasted' ? 'Your cellar is empty' : 'No saved cheeses yet'}</Text>
            <Text style={styles.emptyStateCopy}>{segment === 'Tasted' ? 'Your first logged tasting will appear here with your personal stats.' : 'Saved-cheese syncing is coming next.'}</Text>
          </View>
        )}
        {loading && <ActivityIndicator color={colors.wine} />}
      </View>
    </ScrollView>
  );
}

function ProfileScreen({ profile, signedIn, onManageCatalog, onNotifications }: { profile: UserProfile | null; signedIn: boolean; onManageCatalog: () => void; onNotifications: () => void }) {
  const role = profile?.role ?? 'turophile';
  const displayName = profile?.display_name ?? 'Guest Turophile';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'BT';
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
  }, [profile?.id]);

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <AppHeader onNotifications={onNotifications} />
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{initials}</Text></View>
        <Text style={styles.profileName}>{displayName}</Text>
        <Text style={styles.profileHandle}>{profile ? `@${profile.handle}${profile.location ? ` · ${profile.location}` : ''}` : 'Guest preview'}</Text>
        <View style={styles.roleBadge}><Ionicons name={role === 'admin' ? 'shield-checkmark' : role === 'cheesemonger' ? 'storefront' : 'sparkles'} size={14} color={colors.wine} /><Text style={styles.roleText}>{role === 'admin' ? 'Administrator' : role === 'cheesemonger' ? 'Verified Cheesemonger' : 'Turophile'}</Text></View>
        <Text style={styles.bio}>{profile?.bio || 'Your cheese journey starts with your first tasting.'}</Text>
        <View style={styles.followStats}>
          <Text style={styles.followStat}><Text style={styles.followStrong}>{stats.following}</Text>{'\n'}following</Text>
          <Text style={styles.followStat}><Text style={styles.followStrong}>{stats.followers}</Text>{'\n'}followers</Text>
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

function CheeseModal({ cheese, onClose }: { cheese: Cheese | null; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  if (!cheese) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalButton} onPress={onClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
            <Brand compact />
            <Pressable style={styles.modalButton} onPress={() => setSaved(!saved)}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={colors.wine} /></Pressable>
          </View>
          <View style={[styles.detailHero, { backgroundColor: cheese.color }]}>
            <View style={styles.detailOrb} />
            <CheeseArt name={cheese.name} color={cheese.color} size={190} />
            <Text style={styles.detailStyle}>{cheese.style.toUpperCase()}</Text>
          </View>
          <Text style={styles.detailTitle}>{cheese.name}</Text>
          <Text style={styles.detailMaker}>by {cheese.creamery}</Text>
          <View style={styles.detailRatingRow}>
            <Rating value={cheese.rating} large />
            <Text style={styles.detailLogs}>from {cheese.logs.toLocaleString()} tastings</Text>
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
          <View style={styles.detailActions}>
            <PrimaryButton label="Log a tasting" icon="add-circle-outline" onPress={() => Alert.alert('Ready to taste', `Open the Log tab to record your ${cheese.name}.`)} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NotificationsModal({ visible, userId, onClose }: { visible: boolean; userId?: string; onClose: () => void }) {
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
  };

  const message = (item: typeof items[number]) => {
    const name = item.actor?.display_name ?? 'Someone';
    if (item.kind === 'follow') return `${name} followed you.`;
    if (item.kind === 'like') return `${name} liked your tasting.`;
    if (item.kind === 'comment') return `${name} commented on your tasting.`;
    if (item.kind === 'cheese_approved') return 'Your cheese submission was approved.';
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
              <View style={styles.notificationIcon}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'comment' ? 'chatbubble-outline' : 'heart-outline'} size={19} color={colors.wine} /></View>
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

function Root({ profile, signedIn, userId }: { profile: UserProfile | null; signedIn: boolean; userId?: string }) {
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedCheese, setSelectedCheese] = useState<Cheese | null>(null);
  const [catalog, setCatalog] = useState<Cheese[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedReload, setFeedReload] = useState(0);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [catalogManagementOpen, setCatalogManagementOpen] = useState(false);
  const [catalogReload, setCatalogReload] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const openNotifications = () => signedIn ? setNotificationsOpen(true) : Alert.alert('Sign in required', 'Create an account to receive community notifications.');

  useEffect(() => {
    if (!supabase) return;
    supabase.from('cheeses').select('*').eq('status', 'published').order('name').then(({ data, error }) => {
      if (error || !data?.length) return;
      const live = data.map((row) => ({
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
        rating: 0,
        logs: 0,
        color: colors.gold,
      } satisfies Cheese));
      setCatalog(live);
    });
  }, [catalogReload]);

  useEffect(() => {
    if (!supabase || tab !== 'feed') return;
    setRefreshingFeed(true);
    supabase
      .from('tastings')
      .select('id,rating,notes,location_name,created_at,user_id,cheese_id,profiles:user_id(display_name,handle,role),cheeses:cheese_id(slug,name),tasting_photos(storage_path)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        setRefreshingFeed(false);
        if (error) return;
        if (!data?.length) {
          setFeedPosts([]);
          return;
        }
        Promise.all(data.map(async (row) => {
          const author = row.profiles as unknown as { display_name: string; handle: string; role: Role };
          const cheese = row.cheeses as unknown as { slug: string; name: string };
          const photos = row.tasting_photos as unknown as { storage_path: string }[];
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
            likes: 0,
            comments: 0,
            photoUrl: signed?.data?.signedUrl,
          };
        })).then(setFeedPosts);
      });
  }, [tab, feedReload]);

  const screen = tab === 'feed' ? <FeedScreen openCheese={setSelectedCheese} catalog={catalog} feedPosts={feedPosts} profile={profile} userId={userId} refreshing={refreshingFeed} onRefresh={() => setFeedReload((value) => value + 1)} onNotifications={openNotifications} />
    : tab === 'discover' ? <DiscoverScreen openCheese={setSelectedCheese} catalog={catalog} onNotifications={openNotifications} />
    : tab === 'log' ? <LogScreen onComplete={() => { setFeedReload((value) => value + 1); setTab('feed'); }} catalog={catalog} userId={userId} onNotifications={openNotifications} />
    : tab === 'cellar' ? <CellarScreen openCheese={setSelectedCheese} catalog={catalog} userId={userId} reload={feedReload} onNotifications={openNotifications} />
    : <ProfileScreen profile={profile} signedIn={signedIn} onManageCatalog={() => setCatalogManagementOpen(true)} onNotifications={openNotifications} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>{screen}</View>
      <View style={styles.tabBar}>
        {tabItems.map((item) => {
          const active = tab === item.id;
          const isLog = item.id === 'log';
          return (
            <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tabItem}>
              <View style={isLog ? styles.logButton : undefined}>
                <Ionicons name={active ? item.active : item.icon} size={isLog ? 27 : 22} color={isLog ? colors.white : active ? colors.wine : colors.muted} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive, isLog && { marginTop: 4 }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <CheeseModal cheese={selectedCheese} onClose={() => setSelectedCheese(null)} />
      {profile && userId && <CatalogManagement visible={catalogManagementOpen} role={profile.role} userId={userId} onClose={() => { setCatalogManagementOpen(false); setCatalogReload((value) => value + 1); }} />}
      <NotificationsModal visible={notificationsOpen} userId={userId} onClose={() => setNotificationsOpen(false)} />
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

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
    supabase.from('profiles').select('id,handle,display_name,bio,location,role,role_approved').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data as UserProfile | null));
  }, [session]);

  return (
    <SafeAreaProvider>
      {loadingSession ? (
        <SafeAreaView style={styles.authLoading}><ActivityIndicator color={colors.wine} /></SafeAreaView>
      ) : session || guest || !isSupabaseConfigured ? (
        <Root profile={profile} signedIn={Boolean(session)} userId={session?.user.id} />
      ) : (
        <AuthScreen onGuest={() => setGuest(true)} />
      )}
      <PasswordResetModal visible={passwordRecovery} onClose={() => setPasswordRecovery(false)} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  authLoading: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  resetPage: { flex: 1, backgroundColor: colors.paper, padding: 25, justifyContent: 'center' },
  resetIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  resetTitle: { color: colors.ink, fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 18 },
  resetCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginVertical: 10 },
  resetInput: { height: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, marginBottom: 10 },
  app: { flex: 1 },
  screenContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 0 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { width: 6, height: 6, borderRadius: 5, backgroundColor: colors.wine, position: 'absolute', right: 9, top: 8, borderWidth: 1, borderColor: colors.cream },
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
  postAvatarText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  postMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  followButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.blush, borderRadius: 12 },
  followText: { color: colors.wine, fontSize: 9, fontWeight: '800' },
  featureArt: { height: 215, backgroundColor: '#E9DFC9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  artGlow: { position: 'absolute', width: 270, height: 270, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.30)', top: -75, right: -20 },
  artLabel: { position: 'absolute', left: 18, bottom: 17, backgroundColor: 'rgba(255,252,246,0.93)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  artLabelOverline: { fontSize: 7, color: colors.wine, fontWeight: '900', letterSpacing: 1.3 },
  artLabelTitle: { fontSize: 18, color: colors.ink, fontWeight: '800', marginTop: 2 },
  artLabelMaker: { fontSize: 9, color: colors.muted, marginTop: 1 },
  postBody: { padding: 16 },
  postCheeseRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
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
  cheesePickerResults: { gap: 8, maxHeight: 310 },
  noSearchResults: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: 18 },
  filterRow: { gap: 8, paddingVertical: 16 },
  filterPill: { paddingHorizontal: 15, height: 35, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  filterPillActive: { backgroundColor: colors.wine, borderColor: colors.wine },
  filterText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  filterTextActive: { color: colors.white },
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
  profileInitials: { color: colors.white, fontSize: 24, fontWeight: '800' },
  profileName: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 13 },
  profileHandle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  roleBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.blush, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, marginTop: 10 },
  roleText: { color: colors.wine, fontWeight: '800', fontSize: 10 },
  bio: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 290, marginTop: 12 },
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
  detailStyle: { position: 'absolute', bottom: 18, color: 'rgba(255,255,255,0.9)', fontSize: 9, letterSpacing: 2, fontWeight: '900' },
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
});
