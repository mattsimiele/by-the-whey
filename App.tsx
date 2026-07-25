import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { AuthScreen } from './src/AuthScreen';
import { Brand, CheeseArt, PrimaryButton, Rating, SectionHeader } from './src/components';
import { Cheese, cheeses, posts as seedPosts, Role } from './src/data';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { colors, shadow } from './src/theme';

type Tab = 'feed' | 'discover' | 'log' | 'cellar' | 'profile';
type UserProfile = { id: string; handle: string; display_name: string; role: Role; role_approved: boolean };

const tabItems: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'feed', label: 'Feed', icon: 'home-outline', active: 'home' },
  { id: 'discover', label: 'Discover', icon: 'search-outline', active: 'search' },
  { id: 'log', label: 'Log', icon: 'add', active: 'add' },
  { id: 'cellar', label: 'Cellar', icon: 'bookmark-outline', active: 'bookmark' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', active: 'person' },
];

function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {title ? (
        <View>
          <Text style={styles.eyebrow}>{subtitle}</Text>
          <Text style={styles.pageTitle}>{title}</Text>
        </View>
      ) : <Brand compact />}
      <Pressable style={styles.headerAction}>
        <Ionicons name="notifications-outline" size={21} color={colors.ink} />
        <View style={styles.notificationDot} />
      </Pressable>
    </View>
  );
}

function FeedScreen({ openCheese, catalog, feedPosts, userId }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[]; feedPosts: typeof seedPosts; userId?: string }) {
  const [liked, setLiked] = useState<string[]>([]);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <AppHeader />
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>SATURDAY, JULY 25</Text>
          <Text style={styles.heroTitle}>Good evening, Matt.</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>MS</Text></View>
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
        <View style={styles.promptDivider} />
        <View style={styles.promptStats}>
          <Text style={styles.promptStat}><Text style={styles.promptStatStrong}>28</Text> cheeses tasted</Text>
          <View style={styles.miniDot} />
          <Text style={styles.promptStat}><Text style={styles.promptStatStrong}>7</Text> styles explored</Text>
        </View>
      </View>

      <SectionHeader title="From your circle" action="See all" />
      {feedPosts.map((post) => {
        const cheese = catalog.find((item) => item.id === post.cheeseId) ?? cheeses.find((item) => item.id === post.cheeseId)!;
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
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
            </View>
            <Pressable style={styles.featureArt} onPress={() => openCheese(cheese)}>
              <View style={styles.artGlow} />
              <CheeseArt name={cheese.name} color={cheese.color} size={132} />
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
                <View style={styles.socialAction}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.ink} />
                  <Text style={styles.socialText}>{post.comments}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Ionicons name="share-outline" size={20} color={colors.ink} />
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function DiscoverScreen({ openCheese, catalog }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Cow', 'Goat', 'Blue', 'Washed rind'];
  const results = useMemo(() => catalog.filter((cheese) => {
    const matchesQuery = `${cheese.name} ${cheese.creamery} ${cheese.location} ${cheese.style} ${cheese.flavorProfile.join(' ')}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'All' || cheese.milkType.includes(filter) || cheese.style === filter;
    return matchesQuery && matchesFilter;
  }), [query, filter, catalog]);

  return (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <AppHeader title="Discover" subtitle="FIND YOUR NEXT FAVORITE" />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Cheese, maker, region…" placeholderTextColor="#9B958A" style={styles.searchInput} />
        <Ionicons name="scan-outline" size={21} color={colors.wine} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterPill, filter === item && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!query && filter === 'All' && (
        <>
          <Text style={styles.discoveryLabel}>FEATURED THIS WEEK</Text>
          <Pressable style={styles.featuredCard} onPress={() => openCheese(catalog.find((cheese) => cheese.id === 'rogue-river') ?? catalog[0]!)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.featuredKicker}>A RARE SEASONAL BLUE</Text>
              <Text style={styles.featuredTitle}>Rogue River{'\n'}Blue</Text>
              <Text style={styles.featuredCopy}>Pear brandy, fig, and hazelnut wrapped in Syrah leaves.</Text>
              <Text style={styles.featuredLink}>Meet the cheese  →</Text>
            </View>
            <CheeseArt name="Rogue River Blue" color="#7C8794" size={118} />
          </Pressable>
        </>
      )}

      <SectionHeader title={query ? `${results.length} results` : 'Popular near you'} action="View map" />
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
    </ScrollView>
  );
}

function LogScreen({ onComplete, catalog, userId }: { onComplete: () => void; catalog: Cheese[]; userId?: string }) {
  const [selected, setSelected] = useState<Cheese>(catalog[0] ?? cheeses[0]!);
  const [rating, setRating] = useState(4.5);
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!supabase || !userId) {
      Alert.alert('Account required', 'Create or sign in to an account before logging a tasting.');
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
    const { error } = await supabase.from('tastings').insert({
      user_id: userId,
      cheese_id: cheese.id,
      rating,
      notes: note.trim(),
      visibility: isPublic ? 'public' : 'private',
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could not log tasting', error.message);
      return;
    }
    Alert.alert('Tasting logged', `${selected.name} has been added to your cheese diary${isPublic ? ' and shared with your circle' : ''}.`);
    setNote('');
    onComplete();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <AppHeader title="Log a tasting" subtitle="CAPTURE THE MOMENT" />
        <Text style={styles.fieldLabel}>WHAT ARE YOU TASTING?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
          {catalog.map((cheese) => (
            <Pressable key={cheese.id} onPress={() => setSelected(cheese)} style={[styles.selectCheese, selected.id === cheese.id && styles.selectCheeseActive]}>
              <CheeseArt name={cheese.name} color={cheese.color} size={52} />
              <Text numberOfLines={1} style={styles.selectCheeseName}>{cheese.name}</Text>
              {selected.id === cheese.id && <View style={styles.selectedCheck}><Ionicons name="checkmark" size={12} color={colors.white} /></View>}
            </Pressable>
          ))}
        </ScrollView>

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
          {selected.flavorProfile.map((item) => <Pressable key={item} onPress={() => setNote((current) => `${current}${current ? ', ' : ''}${item.toLowerCase()}`)} style={styles.noteChip}><Text style={styles.noteChipText}>+ {item}</Text></Pressable>)}
        </View>

        <View style={styles.addOns}>
          <View style={styles.addOn}><Ionicons name="camera-outline" size={21} color={colors.wine} /><Text style={styles.addOnText}>Add photos</Text><Ionicons name="chevron-forward" size={17} color={colors.muted} /></View>
          <View style={styles.addOn}><Ionicons name="location-outline" size={21} color={colors.wine} /><Text style={styles.addOnText}>Add location</Text><Ionicons name="chevron-forward" size={17} color={colors.muted} /></View>
          <Pressable style={styles.addOn} onPress={() => setIsPublic(!isPublic)}>
            <Ionicons name={isPublic ? 'people-outline' : 'lock-closed-outline'} size={21} color={colors.wine} />
            <View style={{ flex: 1 }}><Text style={styles.addOnText}>{isPublic ? 'Share with your circle' : 'Keep this tasting private'}</Text><Text style={styles.addOnSub}>Tap to change visibility</Text></View>
            <View style={[styles.switch, isPublic && styles.switchActive]}><View style={[styles.switchKnob, isPublic && styles.switchKnobActive]} /></View>
          </Pressable>
        </View>
        {saving ? <ActivityIndicator color={colors.wine} /> : <PrimaryButton label="Log this tasting" icon="checkmark-circle-outline" onPress={submit} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CellarScreen({ openCheese, catalog }: { openCheese: (cheese: Cheese) => void; catalog: Cheese[] }) {
  const [segment, setSegment] = useState<'Tasted' | 'Want to try'>('Tasted');
  const list = segment === 'Tasted' ? catalog.slice(0, 4) : catalog.slice(3);
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <AppHeader title="My cellar" subtitle="YOUR CHEESE JOURNEY" />
      <View style={styles.cellarSummary}>
        <View><Text style={styles.summaryNumber}>28</Text><Text style={styles.summaryLabel}>TASTED</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryNumber}>7</Text><Text style={styles.summaryLabel}>STYLES</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryNumber}>6</Text><Text style={styles.summaryLabel}>REGIONS</Text></View>
      </View>
      <View style={styles.segment}>
        {(['Tasted', 'Want to try'] as const).map((item) => (
          <Pressable key={item} onPress={() => setSegment(item)} style={[styles.segmentItem, segment === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, segment === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.cheeseList}>
        {list.map((cheese, index) => (
          <Pressable key={cheese.id} style={styles.cheeseRow} onPress={() => openCheese(cheese)}>
            <CheeseArt name={cheese.name} color={cheese.color} size={70} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cheeseName}>{cheese.name}</Text>
              <Text style={styles.cheeseMaker}>{cheese.creamery}</Text>
              <Text style={styles.cheeseMeta}>{segment === 'Tasted' ? `Tasted ${index + 2} times · Last July ${18 - index}` : cheese.location}</Text>
            </View>
            {segment === 'Tasted' ? <Rating value={Math.max(4.1, cheese.rating - 0.1)} /> : <Ionicons name="bookmark" size={20} color={colors.wine} />}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function ProfileScreen({ profile, signedIn }: { profile: UserProfile | null; signedIn: boolean }) {
  const role = profile?.role ?? 'turophile';
  const displayName = profile?.display_name ?? 'Guest Turophile';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'BT';
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <AppHeader />
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{initials}</Text></View>
        <Text style={styles.profileName}>{displayName}</Text>
        <Text style={styles.profileHandle}>{profile ? `@${profile.handle}` : 'Guest preview'} · Philadelphia, PA</Text>
        <View style={styles.roleBadge}><Ionicons name={role === 'admin' ? 'shield-checkmark' : role === 'cheesemonger' ? 'storefront' : 'sparkles'} size={14} color={colors.wine} /><Text style={styles.roleText}>{role === 'admin' ? 'Administrator' : role === 'cheesemonger' ? 'Verified Cheesemonger' : 'Turophile'}</Text></View>
        <Text style={styles.bio}>Always looking for the next perfect wedge. Creator of By the Whey.</Text>
        <View style={styles.followStats}>
          <Text style={styles.followStat}><Text style={styles.followStrong}>142</Text>{'\n'}following</Text>
          <Text style={styles.followStat}><Text style={styles.followStrong}>318</Text>{'\n'}followers</Text>
          <Text style={styles.followStat}><Text style={styles.followStrong}>28</Text>{'\n'}tastings</Text>
        </View>
      </View>

      <SectionHeader title="Your palate" />
      <View style={styles.palateCard}>
        <View style={styles.palateRow}><Text style={styles.palateLabel}>Bold & funky</Text><Text style={styles.palateValue}>82%</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: '82%' }]} /></View>
        <View style={styles.palateRow}><Text style={styles.palateLabel}>Creamy & soft</Text><Text style={styles.palateValue}>71%</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: '71%', backgroundColor: colors.gold }]} /></View>
        <View style={styles.palateRow}><Text style={styles.palateLabel}>Nutty & aged</Text><Text style={styles.palateValue}>64%</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: '64%', backgroundColor: colors.sage }]} /></View>
      </View>

      <SectionHeader title="Account access" />
      <Text style={styles.roleHelper}>Your role is secured by Supabase and can only be changed by an administrator.</Text>
      {role !== 'turophile' && (
        <View style={styles.rolePanel}>
          <Ionicons name={role === 'admin' ? 'settings-outline' : 'add-circle-outline'} size={24} color={colors.wine} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rolePanelTitle}>{role === 'admin' ? 'Manage the community' : 'Contribute to the catalog'}</Text>
            <Text style={styles.rolePanelCopy}>{role === 'admin' ? 'Review cheese submissions, moderate reports, and manage accounts.' : 'Submit missing cheeses and track their review status.'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.wine} />
        </View>
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

function Root({ profile, signedIn, userId }: { profile: UserProfile | null; signedIn: boolean; userId?: string }) {
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedCheese, setSelectedCheese] = useState<Cheese | null>(null);
  const [catalog, setCatalog] = useState<Cheese[]>(cheeses);
  const [feedPosts, setFeedPosts] = useState(seedPosts);

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
        age: row.age_description,
        flavorProfile: row.flavor_profile,
        story: row.story_notes,
        pairings: row.pairings,
        rating: 0,
        logs: 0,
        color: colors.gold,
      } satisfies Cheese));
      const liveSlugs = new Set(live.map((item) => item.id));
      setCatalog([...live, ...cheeses.filter((item) => !liveSlugs.has(item.id))]);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('tastings')
      .select('id,rating,notes,location_name,created_at,user_id,cheese_id,profiles:user_id(display_name,handle,role),cheeses:cheese_id(slug,name)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error || !data?.length) return;
        const livePosts = data.map((row) => {
          const author = row.profiles as unknown as { display_name: string; handle: string; role: Role };
          const cheese = row.cheeses as unknown as { slug: string; name: string };
          const initials = author.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
          const minutes = Math.max(1, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000));
          return {
            id: row.id,
            user: author.display_name,
            handle: `@${author.handle}`,
            initials,
            role: author.role,
            cheeseId: cheese.slug,
            rating: Number(row.rating),
            note: row.notes || `Tasted ${cheese.name}.`,
            place: row.location_name || 'Location not added',
            time: minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`,
            likes: 0,
            comments: 0,
          };
        });
        setFeedPosts([...livePosts, ...seedPosts]);
      });
  }, []);

  const screen = tab === 'feed' ? <FeedScreen openCheese={setSelectedCheese} catalog={catalog} feedPosts={feedPosts} userId={userId} />
    : tab === 'discover' ? <DiscoverScreen openCheese={setSelectedCheese} catalog={catalog} />
    : tab === 'log' ? <LogScreen onComplete={() => setTab('feed')} catalog={catalog} userId={userId} />
    : tab === 'cellar' ? <CellarScreen openCheese={setSelectedCheese} catalog={catalog} />
    : <ProfileScreen profile={profile} signedIn={signedIn} />;

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
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setGuest(false);
      if (!nextSession) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setProfile(null);
      return;
    }
    supabase.from('profiles').select('id,handle,display_name,role,role_approved').eq('id', session.user.id).single()
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  authLoading: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
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
  featureArt: { height: 215, backgroundColor: '#E9DFC9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
  searchBox: { height: 52, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 9, ...shadow },
  searchInput: { flex: 1, paddingHorizontal: 10, color: colors.ink, fontSize: 14 },
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
  selectCheese: { width: 104, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 10, gap: 8 },
  selectCheeseActive: { borderWidth: 2, borderColor: colors.wine },
  selectCheeseName: { fontSize: 11, fontWeight: '800', color: colors.ink },
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
  switch: { width: 40, height: 23, borderRadius: 13, backgroundColor: colors.line, padding: 3 },
  switchActive: { backgroundColor: colors.wine },
  switchKnob: { width: 17, height: 17, backgroundColor: colors.white, borderRadius: 9 },
  switchKnobActive: { marginLeft: 17 },
  cellarSummary: { marginTop: 10, padding: 20, borderRadius: 20, backgroundColor: colors.wine, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
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
  palateCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, marginBottom: 25 },
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
