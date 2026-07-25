# Android beta release runbook

## 1. Accounts

Create and verify:

- An Expo account at https://expo.dev
- A Google Play Console developer account
- The By the Whey app in Play Console with package `com.thecurdnerd.bythewhey`

## 2. Link the Expo project

From the project directory:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init
```

`eas init` adds the real Expo project ID to `app.json`. Never invent or copy a project ID from another app.

## 3. Configure build environment variables

In the Expo dashboard, create `preview` and `production` environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These are public client configuration values. Never add the Supabase service-role key.

## 4. Create an installable preview APK

```bash
pnpm dlx eas-cli build --platform android --profile preview
```

Install from the EAS build link and complete the critical rows in `docs/DEVICE_TEST_MATRIX.md`.

## 5. Create the Play Store AAB

```bash
pnpm dlx eas-cli build --platform android --profile production
```

EAS manages the Android signing keystore. Store recovery access to the Expo account securely.

## 6. Play Console setup

Complete:

- Store listing using `store/android/listing.md`
- App access using `store/android/app-access.md`
- Data Safety using `store/android/data-safety.md`
- Content rating
- Target audience
- Ads declaration: No for the current build
- Privacy-policy URL
- Account-deletion URL
- Countries/regions

Publish `public-site/by-the-whey` before entering its URLs.

## 7. Testing tracks

1. Upload the `.aab` to Internal testing.
2. Install from Google Play and run smoke tests.
3. Promote to Closed testing.
4. Invite testers using a Google Group or email list.
5. Send `store/android/tester-instructions.md`.
6. Keep the required testers continuously opted in for the required testing period.

New personal Play accounts may require at least 12 opted-in testers for 14 consecutive days before applying for production access. Confirm the requirement displayed in your Play Console.

## 8. Each beta update

1. Update release notes.
2. Commit and push the exact source.
3. Run type checking and Android export validation.
4. Build the production profile; EAS increments the remote Android version code.
5. Upload/promote the new AAB in the existing closed track.
6. Record device/build results and regressions.
