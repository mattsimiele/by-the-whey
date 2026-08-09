# Mobile release-candidate checklist

## Freeze and verify

- [ ] Choose the release commit and stop non-blocking feature work
- [ ] Run `pnpm install --frozen-lockfile`
- [ ] Run `pnpm release:preflight`
- [ ] Confirm no production secrets or service-role keys are present in client files
- [ ] Confirm package version and release notes
- [ ] Confirm Supabase migrations and Edge Functions match production
- [ ] Confirm `https://bythe-whey.com/` legal/support pages are live

## Physical-device pass

- [ ] Complete [`DEVICE_TEST_MATRIX.md`](DEVICE_TEST_MATRIX.md) on iPhone and Android
- [ ] Complete an iPad layout pass because tablet support remains enabled
- [ ] Verify Apple first/repeat sign-in, hidden email, name capture, and deletion/revocation
- [ ] Verify Google first/repeat sign-in on both mobile platforms
- [ ] Test airplane-mode launch, reconnection, and interrupted image uploads
- [ ] Test Turophile, Cheesemonger, and Admin permissions with separate accounts
- [ ] Resolve every Blocker and High issue or document an explicit release decision

## Store handoff

- [ ] Capture screenshots from the release candidate with permission-cleared content
- [ ] Complete the private files in `store-release-checklist/`
- [ ] Record iOS build number and Android version code
- [ ] Upload builds made from the same source commit
- [ ] Supply reviewer/test credentials that contain no personal data
- [ ] Confirm privacy, support, terms, and deletion URLs in both consoles
- [ ] Assign the moderation owner and begin the published response schedule

## After upload

- [ ] Install the store-distributed TestFlight/internal-test build, not only a local build
- [ ] Repeat authentication, tasting, photo, notification, and deletion smoke tests
- [ ] Record tester feedback using [`BETA_FEEDBACK_TEMPLATE.md`](BETA_FEEDBACK_TEMPLATE.md)
- [ ] Tag the submitted commit only after the build identifiers are confirmed

