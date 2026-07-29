# Google sign-in setup

The mobile app uses Supabase OAuth with the `bythewhey://auth/callback` deep link. Google sign-in is available on both iOS and Android; the existing native Apple button remains iOS-only.

## 1. Apply the profile-name migration

Run `supabase/migrations/202607290001_social_profile_names.sql` in the Supabase SQL Editor. This lets new social accounts use the name supplied by Google or Apple while retaining the unique fallback handle.

## 2. Configure Google Auth Platform

In Google Cloud Console, open Google Auth Platform for the project that will own By the Whey authentication.

1. Branding:
   - App name: `By the Whey`
   - User support email: the Google account used for the project
   - Homepage: `https://www.thecurdnerd.com/by-the-whey`
   - Privacy policy: `https://www.thecurdnerd.com/by-the-whey`
   - Terms: `https://www.thecurdnerd.com/by-the-whey`
   - Developer contact: `support@thecurdnerd.com`
2. Audience: choose External. While testing, add every tester's Google email. Publish the app before public release.
3. Data Access: request only:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
4. Clients: create an OAuth client with application type `Web application`.
5. Add this exact authorized redirect URI:

```text
https://sxfulqjshurmegsvcsrm.supabase.co/auth/v1/callback
```

Copy the generated client ID and client secret. Never store the client secret in the app, `.env`, EAS public variables, or this repository.

## 3. Enable Google in Supabase

Open Supabase Dashboard → Authentication → Sign In / Providers → Google.

1. Enable the provider.
2. Paste the Google web client ID.
3. Paste the Google client secret.
4. Save.

Then open Authentication → URL Configuration and confirm that the redirect allow list includes:

```text
bythewhey://**
```

The production mobile callback resolves to:

```text
bythewhey://auth/callback
```

## 4. Apply platform builds

Because `expo-web-browser` is a native dependency, create new iOS and Android builds after configuration. An over-the-air JavaScript update alone is not sufficient for the first release containing Google sign-in.

## 5. Physical-device test matrix

Test all of the following before release:

- New Google account on iOS creates a profile with the Google display name.
- New Google account on Android creates the same profile behavior.
- Returning Google user reaches the same cellar and tastings.
- Canceling the Google sheet returns to the sign-in page without an error.
- Email/password sign-in still works.
- Sign in with Apple remains visible and functional on iOS.
- Sign in with Apple is not rendered on Android.
- Sign out followed by Google sign-in restores the same account.
- In-app account deletion removes a Google-created account and its associated content.
