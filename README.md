# By the Whey

**Built by The Curd Nerd**

By the Whey is a cross-platform social cheese journal for discovering cheeses, logging tastings, and sharing recommendations with other turophiles.

## What is included

- Polished iOS/Android interface built with React Native and Expo
- Community feed with interactive likes
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

Never place a service-role key or database password in the mobile app.

## Product roadmap

### Safety and App Store requirements

- [x] Report users, tastings, comments, and cheeses.
- [x] Block and unblock users.
- [x] Admin report-review dashboard.
- [x] In-app account deletion.
- [ ] Privacy policy page and public URL.
- [x] Terms of use.
- [ ] Support/contact page and public URL.
- [x] Community guidelines.
- [x] Photo/content moderation process.
- [ ] Automated or pre-publication filtering for objectionable user content.
- [x] Profile and tasting visibility review.
- [ ] Verify Sign in with Apple on a physical device with production Apple configuration and revoke Apple tokens during account deletion.

The Privacy and Support pages now exist in-app, but their public URLs and final contact address must still be added before TestFlight/App Review. Sign in with Apple must be verified after the Apple Developer enrollment is active. See [`docs/MODERATION.md`](docs/MODERATION.md) for the operational moderation workflow.

### Remaining product polish

- Editable profiles and profile photos.
- Calculated palate insights.
- Public user profiles and follower/following management.
- Tasting and comment editing.
- Accurate live notification badges.
- Real catalog photography and image moderation.
- Robust loading, offline, and error states.
- Multi-account iPhone and Android testing.
- TestFlight/internal testing, App Store metadata, screenshots, privacy disclosures, and review submission.

Monetization should follow product validation. Premium palate insights, producer/retailer profiles, affiliate storefront links, and tasteful sponsored discovery placements fit the concept better than an ad-heavy feed.
