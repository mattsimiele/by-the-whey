# Apple release checklist

## Sign in with Apple — physical device

1. Confirm the App ID `com.thecurdnerd.bythewhey` has Sign in with Apple enabled in the Apple Developer portal.
2. Confirm Apple is enabled in Supabase Authentication → Providers.
3. Create a development or TestFlight build; Expo Go is not sufficient for production entitlement verification.
4. On a physical iPhone, create a new account with Apple.
5. Verify the first authorization creates a profile and captures the name when Apple supplies it.
6. Sign out, relaunch, and sign in with Apple again. Verify the same account opens and no duplicate profile appears.
7. Test both “Share My Email” and “Hide My Email” with separate Apple test accounts.
8. Delete an Apple account in-app. The app must request Apple authorization again, revoke the Apple refresh token, delete uploaded media, and remove the Supabase account.

## Apple revocation function

Deploy `supabase/functions/revoke-apple-token` and set these Supabase function secrets:

- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_CLIENT_ID` (`com.thecurdnerd.bythewhey`)
- `APPLE_PRIVATE_KEY` (the full `.p8` key contents)

The function authenticates the current Supabase user, exchanges the fresh Apple authorization code, and revokes the resulting Apple refresh token before account deletion continues.

## App Privacy answers

Confirm these answers against the production build in App Store Connect:

- Tracking: No
- Data used for third-party advertising: No
- Data sold to data brokers: No
- Contact info: Name and Email Address, linked to the user, used for app functionality
- Identifiers: User ID, linked to the user, used for app functionality
- User content: Photos or Videos and Other User Content, linked to the user, used for app functionality
- Location: only user-entered tasting/profile text is stored; the app does not request device location
- Diagnostics: disclose only if production analytics or crash tooling is added later

The native privacy manifest in `app.json` mirrors the current implementation, but App Store Connect answers must still be completed manually.

## Permission descriptions

- Photo library: only when a person chooses a tasting or profile image
- Camera: only when a person chooses to take a tasting or profile image
- Microphone: not requested
- Device location: not requested
- Tracking permission: not requested

## Age rating

Recommended initial answers for the current app:

- User-generated content: Yes
- Messaging/chat: Yes (comments)
- Advertising: No for the current build
- Unrestricted web access: No
- Contests, gambling, loot boxes: No
- Alcohol, tobacco, or drug references: Infrequent/Mild because tasting pairings can mention wine, beer, cider, or spirits
- Mature, sexual, horror, violence, profanity: None, subject to moderated user-generated content

Use Apple’s calculated rating after entering these answers. Revisit the answers if advertising, direct messages, commerce, or less restrictive content features are added.
