# By the Whey

**Built by The Curd Nerd**

By the Whey is a cross-platform social cheese journal for discovering cheeses, logging tastings, and sharing recommendations with other turophiles.

## What is included

- Polished iOS and Android interface built with React Native and Expo
- Email/password, Google, and native Sign in with Apple authentication
- Public and following feeds with likes, comments, sharing, people search, and actionable in-app notifications
- Live catalog with 98 published cheeses, nine style categories, community ratings, filtering, sorting, and detailed cheese pages
- Guided tasting logger with half-star ratings, notes, visibility, photo, and typed location
- Personal Cellar with tasting history and want-to-try lists
- Editable profiles, avatars, public tasting histories, followers, and following
- Role-backed Turophile, Cheesemonger, and Admin experiences enforced by Supabase Row Level Security
- Reporting, blocking, moderation queues, photo review, account enforcement, and in-app account deletion
- Persistent catalog/feed caching with offline messaging and reconnection recovery
- Authenticated web Catalog Studio for catalog corrections and submission review

## Run locally

On this Mac, launch the app with the included script:

```bash
./start-app.command
```

The script uses the bundled development runtime and installs anything missing automatically. Then press `i` for an iOS simulator, `a` for Android, or scan the displayed QR code with a compatible Expo development build.

If Node.js and pnpm are installed globally, `pnpm install` followed by `pnpm start` works as well.

## Android beta release

Android EAS preview and production profiles, Play listing copy, Data Safety notes, content declarations, tester instructions, artwork, and the release runbook are ready. Start with [`docs/ANDROID_BETA_RELEASE.md`](docs/ANDROID_BETA_RELEASE.md).

## Web catalog management

The authenticated Catalog Studio is published at `https://bythe-whey.com/manage/`. It uses the same Supabase database and Row Level Security policies as the mobile app:

- Approved cheesemongers can browse the published catalog and submit complete new cheese records.
- Administrators can correct published records, review pending submissions, and approve or reject them.
- Turophile and unapproved accounts are denied access.

The website uses only the public Supabase publishable key. Never add a service-role key to `docs/` or any browser-delivered file.

## Store release automation

Run `pnpm release` to build iOS, automatically submit the successful build to TestFlight, and then build the Android App Bundle. The command uses the free-plan-compatible EAS CLI flow and only starts Android after the iOS build and handoff succeed. Production build numbers are incremented remotely by EAS. Android submission remains a separate step until the Google Play service-account key is uploaded to EAS.

## Product roles

- **Turophile:** browse the approved catalog, log tastings, follow people, and interact with posts.
- **Cheesemonger:** everything above, plus submit cheeses and maintain their own pending submissions.
- **Admin:** catalog moderation, submission review, account management, and content reports.

Production authorization must be enforced with database policies, not only hidden interface controls.

## Recommended backend

Supabase is the intended backend:

- Postgres for structured cheese and social data
- Auth for email, Google, and Apple sign-in
- Storage for tasting and cheese photos
- Realtime for feed interactions and notifications
- Row Level Security for role-aware permissions

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the proposed schema and policies.

### Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/202607250001_initial_schema.sql` in its SQL Editor.
3. Copy `.env.example` to `.env`.
4. Add the project URL and publishable key from Supabase Project Settings → API.
5. In Authentication → URL Configuration, set the Site URL to `https://bythe-whey.com/` and add `https://bythe-whey.com/**` plus `bythewhey://**` to the redirect allow list. This supports website authentication, keeps confirmation emails off localhost, and preserves in-app password recovery.
6. Follow [`docs/GOOGLE_AUTH_SETUP.md`](docs/GOOGLE_AUTH_SETUP.md) to enable Google sign-in for iOS and Android.

Never place a service-role key or database password in the mobile app.

## Mobile release audit

Last reviewed against the codebase and live backend on **August 9, 2026**. “Implemented” means production code and database support exist; it does not mean every path has passed physical-device testing.

### Implemented

- [x] Email signup, confirmation, sign-in, password recovery, and persistent sessions
- [x] Google sign-in on iOS and Android
- [x] Native Sign in with Apple, nonce verification, credential-state checks, first-login name capture, and missing-name recovery
- [x] Guest catalog browsing
- [x] Public/following feed filters, likes, comments, sharing, people search, follow/unfollow, and blocking
- [x] Actionable in-app notifications with realtime unread counts
- [x] Discover search, nine catalog categories, community averages, and sorting by rating, popularity, recency, or name
- [x] Tasting creation, half-star ratings, editing, deletion, typed locations, visibility controls, and moderated photos
- [x] Cellar history and want-to-try management
- [x] Editable profiles, avatars, public profiles, and follower/following lists
- [x] Cheesemonger submissions and Admin catalog correction/review tools
- [x] Reports for accounts, tastings, comments, and cheeses with selectable reasons
- [x] Admin photo moderation, report enforcement, warning, suspension, restoration, and account removal
- [x] In-app account deletion and Apple token-revocation function
- [x] Privacy, Terms, Guidelines, Support, and Account Deletion pages at `https://bythe-whey.com/`
- [x] Offline catalog/feed caching, retry states, and automatic reconnection refresh
- [x] iOS privacy manifest, camera/photo permission descriptions, EAS production profiles, and automatic iOS submission configuration
- [x] TypeScript configuration and a `pnpm typecheck` release script are present

### Release blockers and required verification

- [ ] Replace remaining `https://www.thecurdnerd.com/by-the-whey` links in the mobile signup/legal flows and Android store documents with the corresponding `https://bythe-whey.com/` pages.
- [ ] Restore a reproducible local dependency install and typecheck. The current checked-out `node_modules` was created by a different pnpm runtime, so this audit could not complete `pnpm typecheck` without pnpm attempting to repair dependencies from the registry.
- [ ] Make Terms of Use and Privacy Policy tappable during account creation and add an explicit acceptance control or recorded acceptance before a user can upload public content.
- [ ] Complete the physical multi-account iPhone and Android matrix in [`docs/DEVICE_TEST_MATRIX.md`](docs/DEVICE_TEST_MATRIX.md), especially visibility, moderation, realtime notifications, interrupted uploads, and account deletion.
- [ ] Verify first and repeat Sign in with Apple, hidden-email accounts, name capture, and Apple token revocation on a physical iPhone/TestFlight build.
- [ ] Decide whether to support iPad at launch. `supportsTablet` is currently enabled; either test and prepare iPad presentation/screenshots or disable it before the release candidate.
- [ ] Complete App Store Connect privacy disclosures, the current age-rating questionnaire, content-rights answers, review contact, demo account/instructions, screenshots, description, keywords, and support/marketing/privacy URLs.
- [ ] Complete Google Play Data Safety, content rating, target audience, ads declaration, app access, store listing, screenshots, privacy URL, and account-deletion URL.
- [ ] If the Play developer account is a new personal account, complete a closed test with at least 12 continuously opted-in testers for 14 days before applying for production access.
- [ ] Assign a named moderation owner, review reports/photos daily during beta, and document response targets.
- [ ] Confirm that every catalog and store image is owned, licensed, or used with permission.
- [ ] Run a final release-candidate regression pass, freeze catalog/schema changes, build both platforms from the same commit, and record the exact build numbers submitted.

### Important quality work after the first beta

- [ ] Add automated tests for authentication callbacks, role access, tasting mutations, visibility, moderation, and account deletion. There is currently no automated test suite or CI release gate.
- [ ] Run a dedicated accessibility pass for VoiceOver/TalkBack labels, dynamic text, contrast, focus order, and touch-target size.
- [ ] Add privacy-conscious crash reporting before public launch, then update Apple/Google privacy disclosures if the tool collects diagnostics.
- [ ] Add true push notifications if testers need alerts while the app is closed; current notifications are realtime only while the app is active.
- [ ] Add comment editing.
- [ ] Add calculated palate insights once enough real tasting history exists.
- [ ] Continue replacing catalog placeholders with permission-cleared cheese photography.
- [ ] Consider pagination and image-performance work as the catalog and feed grow.

### Recommended next sequence

1. Fix the stale domain links and explicit Terms/Privacy acceptance.
2. Produce one release-candidate build for both platforms.
3. Run the full three-role, two-device matrix and fix only release-blocking regressions.
4. Start or continue TestFlight and Google Play closed testing; collect feedback with build number, device, account role, steps, and screenshots.
5. Complete store disclosures, metadata, screenshots, demo access, and moderation operations while the beta is running.
6. Submit iOS when the physical Apple deletion test passes; apply for Google production access after its required closed-testing period.
7. Defer monetization until beta retention and logging behavior are understood. Premium palate insights, producer/retailer profiles, affiliate storefront links, and restrained sponsored discovery fit the product better than an ad-heavy feed.

The support contact is `support@thecurdnerd.com`. See [`docs/MODERATION.md`](docs/MODERATION.md) for the operational moderation workflow.

## Instagram launch kit

### Account setup

- **Display name:** By the Whey | Cheese App
- **Category:** App / Food & Drink
- **Website:** `https://bythe-whey.com/`
- **Contact:** `support@thecurdnerd.com`
- **Suggested bio:** `Your cheese memory, beautifully organized. 🧀 Taste, rate, remember & share. Built by @thecurdnerd. Beta testing on iPhone + Android.`

### First-post caption

> Meet **By the Whey** — a modern cheese journal and community built by The Curd Nerd.
>
> Rate what you taste in half stars, keep thoughtful notes, remember where you found it, build your personal cellar, and discover what other cheese people love. Our growing catalog goes deeper than a name and a rating, with makers, milk, style, origin, age, flavor, story, and pairings.
>
> We are currently testing on iPhone and Android with a small group of turophiles and cheesemongers. Follow along as we polish the app, photograph the catalog, and get ready to open the cheese table.
>
> Want to help test? Visit **bythe-whey.com** or send us a message.
>
> Built by **The Curd Nerd**.

### Short beta-recruiting caption

> Calling all cheese people 🧀 By the Whey is looking for thoughtful beta testers on iPhone and Android. Log tastings, build your cellar, discover new wheels, and tell us what needs to be sharper. Join at **bythe-whey.com**.

### Content pillars

- **Cheese of the week:** one catalog cheese, its story, flavor profile, and pairings
- **Build in public:** feature previews, beta improvements, and honest behind-the-scenes progress
- **How to taste:** approachable education about milk, rind, texture, aroma, style, and pairing
- **Community cellar:** tester discoveries and tasting notes shared with permission
- **Meet the maker:** creamery stories and producer photography used with permission

### Voice and visual direction

Write like a knowledgeable cheesemonger at a beautiful neighborhood cheese bar: warm, curious, specific, and never snobby. Favor real cheese photography, the existing burgundy/cream/gold palette, concise captions, and useful tasting language. Avoid generic AI imagery and overloading every post with hashtags.

### Starter hashtags

`#ByTheWhey #TheCurdNerd #CheeseApp #CheeseLover #Turophile #CheeseTasting #CheeseBoard #ArtisanCheese #Cheesemonger #EatMoreCheese`
