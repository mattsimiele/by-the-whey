# By the Whey

**Built by The Curd Nerd**

By the Whey is a cross-platform social cheese journal for discovering cheeses, logging tastings, and sharing recommendations with other turophiles.

## What is included

- Polished iOS/Android interface built with React Native and Expo
- Public/following community feeds with likes, comments, actionable notifications, and people search
- Searchable and filterable cheese catalog
- Cheese detail pages
- Guided tasting logger with rating, notes, visibility, photo, and location affordances
- Personal cellar with tasted and want-to-try lists
- Profile and palate summary
- Previewable Turophile, Cheesemonger, and Admin account experiences
- Representative catalog and community data for prototyping

## Run locally

On this Mac, launch the app with the included script:

```bash
./start-app.command
```

The script uses the bundled development runtime and installs anything missing automatically. Then press `i` for an iOS simulator, `a` for Android, or scan the displayed QR code with a compatible Expo development build.

If Node.js and pnpm are installed globally, `pnpm install` followed by `pnpm start` works as well.

## Android beta release

Android EAS preview and production profiles, Play listing copy, Data Safety notes, content declarations, tester instructions, artwork, and the release runbook are ready. Start with [`docs/ANDROID_BETA_RELEASE.md`](docs/ANDROID_BETA_RELEASE.md).

## Store release automation

Run `pnpm release` to start `.eas/workflows/release.yml`. The workflow builds iOS, uploads the successful build to TestFlight, and then builds the Android App Bundle. Production build numbers are incremented remotely by EAS. Android submission remains a separate step until the Google Play service-account key is uploaded to EAS.

## Product roles

- **Turophile:** browse the approved catalog, log tastings, follow people, and interact with posts.
- **Cheesemonger:** everything above, plus submit cheeses and maintain their own pending submissions.
- **Admin:** catalog moderation, submission review, account management, and content reports.

Production authorization must be enforced with database policies, not only hidden interface controls.

## Recommended backend

Supabase is the intended backend:

- Postgres for structured cheese and social data
- Auth for user accounts and Apple sign-in
- Storage for tasting and cheese photos
- Realtime for feed interactions and notifications
- Row Level Security for role-aware permissions

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the proposed schema and policies.

### Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/202607250001_initial_schema.sql` in its SQL Editor.
3. Copy `.env.example` to `.env`.
4. Add the project URL and publishable key from Supabase Project Settings → API.
5. In Authentication → URL Configuration, set the Site URL to `https://www.thecurdnerd.com/by-the-whey` and add `https://www.thecurdnerd.com/by-the-whey**` plus `bythewhey://**` to the redirect allow list. This keeps confirmation emails off localhost while preserving in-app password recovery.

Never place a service-role key or database password in the mobile app.

## Product roadmap

### Safety and App Store requirements

- [x] Report users, tastings, comments, and cheeses.
- [x] Block and unblock users.
- [x] Admin report-review dashboard.
- [x] In-app account deletion.
- [x] Privacy policy page and public URL.
- [x] Terms of use.
- [x] Support/contact page and public URL.
- [x] Community guidelines.
- [x] Photo/content moderation process.
- [x] Server-side text filtering and pre-publication admin review for uploaded photos.
- [x] Profile and tasting visibility review.
- [x] Add Apple token revocation during in-app account deletion.
- [ ] Deploy/configure the Apple revocation Edge Function and verify Sign in with Apple on a physical device.
- [x] Add native privacy manifest declarations and clear camera/photo permission descriptions.
- [ ] Complete App Store Connect privacy disclosures and age-rating questionnaire.

The support contact is `support@thecurdnerd.com`. Privacy, Terms, Guidelines, Support, and Account Deletion are published together at `https://www.thecurdnerd.com/by-the-whey` and also exist in-app. Sign in with Apple must be verified after the Apple Developer enrollment is active. See [`docs/MODERATION.md`](docs/MODERATION.md) for the operational moderation workflow.

### Remaining product polish

- [x] Editable profiles and profile photos.
- [x] Public user profiles and follower/following management.
- [x] Tasting editing, visibility changes, and photo replacement.
- [x] Accurate live notification badges.
- [x] Half-star rating selection.
- [x] Discover sorting by rating, popularity, recency, and name.
- [x] Core loading, retry, and empty states.
- [ ] Calculated palate insights.
- [ ] Comment editing.
- [x] Real catalog photography upload, display, and admin image moderation.
- [x] Persistent offline catalog/feed caching with automatic reconnection recovery.
- [ ] Complete the physical multi-account iPhone and Android matrix in [`docs/DEVICE_TEST_MATRIX.md`](docs/DEVICE_TEST_MATRIX.md).
- [ ] TestFlight/internal testing, App Store metadata, screenshots, privacy disclosures, and review submission.

Monetization should follow product validation. Premium palate insights, producer/retailer profiles, affiliate storefront links, and tasteful sponsored discovery placements fit the concept better than an ad-heavy feed.
