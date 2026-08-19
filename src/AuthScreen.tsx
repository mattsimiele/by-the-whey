import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, PrimaryButton } from './components';
import { storeAppleUserId } from './appleCredential';
import { EMAIL_CONFIRMATION_URL, PRIVACY_URL, TERMS_URL } from './config';
import { createLegalAcceptanceMetadata, normalizeHandle, parseAuthCallbackUrl } from './lib/coreTransforms';
import { supabase } from './lib/supabase';
import { colors, shadow } from './theme';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signIn' | 'signUp';

export function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<Mode>('signUp');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const appleSignInAvailable = Platform.OS === 'ios';

  const requireLegalAcceptance = () => {
    if (mode !== 'signUp' || legalAccepted) return true;
    Alert.alert('Review and accept', 'Accept the Terms of Use and Privacy Policy before creating an account.');
    return false;
  };

  const recordSocialAcceptance = async () => {
    if (mode !== 'signUp') return;
    const { error } = await supabase!.auth.updateUser({ data: createLegalAcceptanceMetadata() });
    if (error) throw error;
  };

  const openLegalPage = async (url: string, label: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(`${label} unavailable`, `Visit ${url} in your browser.`);
    }
  };

  const submit = async () => {
    if (!supabase) {
      Alert.alert('Configuration missing', 'Supabase has not been connected yet.');
      return;
    }
    if (!requireLegalAcceptance()) return;
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check your details', 'Enter a valid email and a password of at least 8 characters.');
      return;
    }
    if (mode === 'signUp' && (!displayName.trim() || !/^[a-z0-9_]{3,30}$/.test(handle.trim().toLowerCase()))) {
      Alert.alert('Check your profile', 'Add your name and a handle using 3–30 lowercase letters, numbers, or underscores.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: EMAIL_CONFIRMATION_URL,
            data: {
              display_name: displayName.trim(),
              handle: handle.trim().toLowerCase(),
              ...createLegalAcceptanceMetadata(),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert(
            'Check your inbox',
            'We sent you a verification email. Confirm your address, then return here and sign in.',
            [{ text: 'Got it', onPress: () => setMode('signIn') }],
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      Alert.alert('Could not continue', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!supabase || !email.trim()) {
      Alert.alert('Add your email', 'Enter the email address for your account first.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'bythewhey://reset-password',
    });
    Alert.alert(
      error ? 'Could not send reset email' : 'Check your inbox',
      error?.message ?? 'We sent a secure password-reset link to your email address.',
    );
  };

  const signInWithApple = async () => {
    if (!supabase) return;
    if (!requireLegalAcceptance()) return;
    setBusy(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;
      await recordSocialAcceptance();
      await storeAppleUserId(credential.user);
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      if (fullName && data.user) {
        const { error: profileNameError } = await supabase
          .from('profiles')
          .update({ display_name: fullName })
          .eq('id', data.user.id);
        if (profileNameError) throw profileNameError;

        // Updating auth metadata emits USER_UPDATED. Do this after the profile
        // row is saved so the app reloads the newly supplied Apple name.
        const { error: metadataNameError } = await supabase.auth.updateUser({
          data: { display_name: fullName, full_name: fullName },
        });
        if (metadataNameError) throw metadataNameError;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign-In failed', error instanceof Error ? error.message : 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    if (!requireLegalAcceptance()) return;
    setBusy(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google did not return a sign-in URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;

      const callback = parseAuthCallbackUrl(result.url);
      if (callback.error) throw new Error(callback.error);

      const code = callback.code;
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        await recordSocialAcceptance();
        return;
      }

      const accessToken = callback.accessToken;
      const refreshToken = callback.refreshToken;
      if (!accessToken || !refreshToken) throw new Error('Google sign-in did not return a valid session.');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      await recordSocialAcceptance();
    } catch (error) {
      Alert.alert('Google Sign-In failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandWrap}><Brand /></View>
        <View style={styles.hero}>
          <View style={styles.wheel}>
            <Image accessibilityLabel="By the Whey cheese character" source={require('../assets/by-the-whey-character.png')} style={styles.heroCharacter} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{mode === 'signUp' ? 'Find your next favorite.' : 'Welcome back.'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'signUp'
              ? 'Taste, remember, and share exceptional cheese with people who get it.'
              : 'Your cheese diary and community are waiting.'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modePicker}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signUp' }} onPress={() => setMode('signUp')} style={[styles.mode, mode === 'signUp' && styles.modeActive]}>
              <Text style={[styles.modeText, mode === 'signUp' && styles.modeTextActive]}>Create account</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signIn' }} onPress={() => setMode('signIn')} style={[styles.mode, mode === 'signIn' && styles.modeActive]}>
              <Text style={[styles.modeText, mode === 'signIn' && styles.modeTextActive]}>Sign in</Text>
            </Pressable>
          </View>

          {mode === 'signUp' && (
            <>
              <Text style={styles.label}>NAME</Text>
              <TextInput accessibilityLabel="Display name" value={displayName} onChangeText={setDisplayName} placeholder="How should we know you?" placeholderTextColor="#9B958A" style={styles.input} autoCapitalize="words" />
              <Text style={styles.label}>HANDLE</Text>
              <View style={styles.inputRow}>
                <Text style={styles.prefix}>@</Text>
                <TextInput accessibilityLabel="Handle" value={handle} onChangeText={(value) => setHandle(normalizeHandle(value))} placeholder="curd_lover" placeholderTextColor="#9B958A" style={styles.rowInput} autoCapitalize="none" />
              </View>
            </>
          )}

          <Text style={styles.label}>EMAIL</Text>
          <TextInput accessibilityLabel="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9B958A" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputRow}>
            <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#9B958A" style={styles.rowInput} secureTextEntry={!showPassword} autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'} />
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={10} onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} /></Pressable>
          </View>

          {mode === 'signUp' && (
            <View style={styles.legalBlock}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: legalAccepted }}
                accessibilityLabel="Accept the Terms of Use and Privacy Policy"
                onPress={() => setLegalAccepted((current) => !current)}
                style={styles.legalCheckRow}
              >
                <View style={[styles.checkbox, legalAccepted && styles.checkboxChecked]}>
                  {legalAccepted && <Ionicons name="checkmark" size={15} color={colors.white} />}
                </View>
                <Text style={styles.legalCopy}>I agree to the policies below and the Community Guidelines.</Text>
              </Pressable>
              <View style={styles.legalLinks}>
                <Pressable accessibilityRole="link" onPress={() => openLegalPage(TERMS_URL, 'Terms of Use')}><Text style={styles.legalLink}>Terms of Use</Text></Pressable>
                <Text style={styles.legalSeparator}>·</Text>
                <Pressable accessibilityRole="link" onPress={() => openLegalPage(PRIVACY_URL, 'Privacy Policy')}><Text style={styles.legalLink}>Privacy Policy</Text></Pressable>
              </View>
            </View>
          )}

          <View style={styles.submit}>
            {busy ? <View style={styles.loading}><ActivityIndicator color={colors.wine} /></View> : (
              <PrimaryButton label={mode === 'signUp' ? 'Join the cheese table' : 'Sign in'} icon="arrow-forward" onPress={submit} />
            )}
          </View>
          {mode === 'signIn' && <Pressable onPress={resetPassword} style={styles.forgot}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>}
          <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR</Text><View style={styles.orLine} /></View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={busy}
            onPress={signInWithGoogle}
            style={({ pressed }) => [styles.googleButton, pressed && styles.socialButtonPressed, busy && styles.socialButtonDisabled]}
          >
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>
          {appleSignInAvailable && (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={styles.appleButton}
                onPress={signInWithApple}
              />
            </>
          )}
          {mode === 'signIn' && <View style={styles.legalLinks}><Pressable accessibilityRole="link" onPress={() => openLegalPage(TERMS_URL, 'Terms of Use')}><Text style={styles.legalLink}>Terms</Text></Pressable><Text style={styles.legalSeparator}>·</Text><Pressable accessibilityRole="link" onPress={() => openLegalPage(PRIVACY_URL, 'Privacy Policy')}><Text style={styles.legalLink}>Privacy</Text></Pressable></View>}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Explore as a guest" onPress={onGuest} style={styles.guest}>
          <Text style={styles.guestText}>Explore as a guest</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.wine} />
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30 },
  brandWrap: { alignItems: 'center', marginBottom: 28 },
  hero: { alignItems: 'center' },
  wheel: { width: 126, height: 126, borderRadius: 63, backgroundColor: colors.blush, borderWidth: 1, borderColor: colors.sky, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroCharacter: { width: 108, height: 108 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 315, marginTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 18, marginTop: 25, ...shadow },
  modePicker: { flexDirection: 'row', height: 42, backgroundColor: colors.cream, padding: 4, borderRadius: 14, marginBottom: 10 },
  mode: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  modeActive: { backgroundColor: colors.white, ...shadow },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  modeTextActive: { color: colors.wine },
  label: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 14, marginBottom: 7 },
  input: { height: 49, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, fontSize: 13 },
  inputRow: { height: 49, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  prefix: { color: colors.wine, fontWeight: '800', fontSize: 14 },
  rowInput: { flex: 1, color: colors.ink, fontSize: 13 },
  submit: { marginTop: 20 },
  loading: { height: 52, alignItems: 'center', justifyContent: 'center' },
  legalBlock: { marginTop: 16, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.cream },
  legalCheckRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 23, height: 23, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkboxChecked: { borderColor: colors.wine, backgroundColor: colors.wine },
  legalCopy: { flex: 1, color: colors.ink, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  legalLinks: { minHeight: 36, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  legalLink: { color: colors.wine, fontSize: 10, fontWeight: '800', textDecorationLine: 'underline' },
  legalSeparator: { color: colors.muted, fontSize: 10 },
  forgot: { alignSelf: 'center', padding: 10 },
  forgotText: { color: colors.wine, fontSize: 11, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  googleButton: { width: '100%', height: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleButtonText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  socialButtonPressed: { opacity: 0.78 },
  socialButtonDisabled: { opacity: 0.55 },
  appleButton: { width: '100%', height: 50, marginTop: 10 },
  guest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, padding: 10 },
  guestText: { color: colors.wine, fontSize: 12, fontWeight: '800' },
});
