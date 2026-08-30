# By the Whey

**Built by The Curd Nerd**

By the Whey is a cross-platform social cheese journal for discovering cheeses, logging tastings, and sharing recommendations with other turophiles.

> **Proprietary project:** This repository is publicly visible, but it is not open source. Copyright © 2026 The Curd Nerd LLC. All rights reserved. See [`LICENSE`](LICENSE) and [`RIGHTS.md`](RIGHTS.md) before using any code, catalog content, photography, artwork, or brand assets.

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
- Public web catalog with live search, nine style filters, community sorting, approved photography, and generated shareable cheese pages

## Run locally

On this Mac, launch the app with the included script:

```bash
./start-app.command
```

The script uses the bundled development runtime and installs anything missing automatically. Then press `i` for an iOS simulator, `a` for Android, or scan the displayed QR code with a compatible Expo development build.

If Node.js and pnpm are installed globally, `pnpm install` followed by `pnpm start` works as well.

Before creating a release build on this Mac, run:

```bash
./release-check.command
```

This uses the bundled Node/pnpm runtime, verifies the lockfile, runs automated release tests and TypeScript checking, and validates identifiers, artwork dimensions, legal links, and required public pages.

## Android beta release

Android EAS preview and production profiles, Play listing copy, Data Safety notes, content declarations, tester instructions, artwork, and the release runbook are ready. Start with [`docs/ANDROID_BETA_RELEASE.md`](docs/ANDROID_BETA_RELEASE.md).

## Web catalog management

The public catalog is available at `https://bythe-whey.com/catalog/`. Every published cheese has a generated, search-engine-friendly page at `/cheese/<slug>/` with live Supabase refresh, community ratings, approved photography, full catalog details, and an app deep link. Regenerate static metadata, pages, and the sitemap after publishing or renaming cheeses with:

```bash
pnpm web:catalog
```

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

- [x] Replace retired website links in the mobile signup/legal flows and Android release documents with dedicated `https://bythe-whey.com/` pages.
- [x] Restore a reproducible local dependency install, automated tests, TypeScript check, and one-command release preflight through `./release-check.command`.
- [x] Make Terms and Privacy tappable during account creation, require explicit acceptance, and record acceptance timestamps in authentication metadata.
- [ ] Complete the physical multi-account iPhone and Android matrix in [`docs/DEVICE_TEST_MATRIX.md`](docs/DEVICE_TEST_MATRIX.md), especially visibility, moderation, realtime notifications, interrupted uploads, and account deletion.
- [ ] Verify first and repeat Sign in with Apple, hidden-email accounts, name capture, and Apple token revocation on a physical iPhone/TestFlight build.
- [ ] Test iPad before launch. `supportsTablet` remains enabled by product choice, and the required layout pass is listed in [`docs/DEVICE_TEST_MATRIX.md`](docs/DEVICE_TEST_MATRIX.md).
- [ ] Complete App Store Connect privacy disclosures, the current age-rating questionnaire, content-rights answers, review contact, demo account/instructions, screenshots, description, keywords, and support/marketing/privacy URLs.
- [ ] Complete Google Play Data Safety, content rating, target audience, ads declaration, app access, store listing, screenshots, privacy URL, and account-deletion URL.
- [ ] If the Play developer account is a new personal account, complete a closed test with at least 12 continuously opted-in testers for 14 days before applying for production access.
- [ ] Assign a named moderation owner, review reports/photos daily during beta, and document response targets.
- [ ] Confirm that every catalog and store image is owned, licensed, or used with permission.
- [ ] Run a final release-candidate regression pass, freeze catalog/schema changes, build both platforms from the same commit, and record the exact build numbers submitted.

### Important quality work after the first beta

- [ ] Add automated tests for authentication callbacks, role access, tasting mutations, visibility, moderation, and account deletion. There is currently no automated test suite or CI release gate.
- [ ] Complete the physical accessibility pass in [`docs/ACCESSIBILITY_AUDIT.md`](docs/ACCESSIBILITY_AUDIT.md). The initial code-level labels, roles, states, and major icon-control fixes are implemented.
- [ ] Add privacy-conscious crash reporting before public launch, then update Apple/Google privacy disclosures if the tool collects diagnostics.
- [ ] Add true push notifications if testers need alerts while the app is closed; current notifications are realtime only while the app is active.
- [ ] Add comment editing.
- [ ] Add calculated palate insights once enough real tasting history exists.
- [ ] Continue replacing catalog placeholders with permission-cleared cheese photography.
- [ ] Consider pagination and image-performance work as the catalog and feed grow.

### Recommended next sequence

1. Run `./release-check.command` and produce one release-candidate build for both platforms.
2. Run the full three-role, iPhone/Android/iPad matrix and fix only release-blocking regressions.
3. Start or continue TestFlight and Google Play closed testing; collect feedback with build number, device, account role, steps, and screenshots.
4. Complete store disclosures, metadata, screenshots, demo access, and moderation operations while the beta is running.
5. Submit iOS when the physical Apple deletion test passes; apply for Google production access after its required closed-testing period.
6. Defer monetization until beta retention and logging behavior are understood. Premium palate insights, producer/retailer profiles, affiliate storefront links, and restrained sponsored discovery fit the product better than an ad-heavy feed.

The support contact is `support@thecurdnerd.com`. See [`docs/MODERATION.md`](docs/MODERATION.md) for the operational moderation workflow.

## Intellectual property

- Original By the Whey code, documentation, editorial content, and design implementation are proprietary and are not licensed for reuse.
- Original catalog descriptions and the protectable selection, coordination, and arrangement of the catalog are reserved to The Curd Nerd LLC to the extent owned and protectable by law.
- Individual facts, user-owned submissions, and third-party materials are not claimed as exclusive property of The Curd Nerd LLC.
- “By the Whey,” “The Curd Nerd,” the logos, and the cheese character may not be used to imply affiliation or endorsement.
- External contributions require a written ownership or licensing agreement before acceptance. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

For permissions or commercial licensing, contact `support@thecurdnerd.com`.

Release support documents:

- [`docs/RELEASE_CANDIDATE_CHECKLIST.md`](docs/RELEASE_CANDIDATE_CHECKLIST.md)
- [`docs/BETA_FEEDBACK_TEMPLATE.md`](docs/BETA_FEEDBACK_TEMPLATE.md)
- [`docs/IMAGE_RIGHTS_CHECKLIST.md`](docs/IMAGE_RIGHTS_CHECKLIST.md)
- [`docs/ACCESSIBILITY_AUDIT.md`](docs/ACCESSIBILITY_AUDIT.md)

The local `store-release-checklist/` directory contains Apple and Google Play field-by-field worksheets. It is intentionally excluded from Git so console notes and reviewer details cannot be committed accidentally.
