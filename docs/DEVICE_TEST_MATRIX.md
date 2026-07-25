# Multi-account device test matrix

Run this matrix with at least three non-production accounts:

- `admin`: approved administrator
- `monger`: approved cheesemonger
- `taster`: standard turophile

Use one physical iPhone and one physical Android phone. Repeat the critical rows on a second account/device simultaneously where noted.

| Area | iPhone | Android | Accounts | Expected result |
| --- | --- | --- | --- | --- |
| Email signup, verification, sign-in, sign-out | Required | Required | taster | One profile is created and the session survives relaunch |
| Sign in with Apple | Required | N/A | new Apple account | First and repeat sign-in open the same profile |
| Profile and avatar edit | Required | Required | all | Changes appear on feed and public profile |
| Follow/unfollow and follower removal | Required | Required | two devices | Both lists and notification badge update |
| Public/followers/private tasting visibility | Required | Required | two devices | Only eligible accounts can read each tasting |
| Half-star rating and tasting edit/delete | Required | Required | taster | Feed, Cellar, and averages refresh correctly |
| Tasting photo moderation | Required | Required | taster + admin | Pending photo is owner-only; approval publishes it; rejection removes it |
| Catalog photo moderation | Required | Required | monger + admin | Pending photo is not public; approval replaces placeholders; rejection removes the object |
| Existing catalog photo upload | Required | Required | admin | Search, upload, refresh, and image display succeed |
| Reports and enforcement | Required | Required | taster + admin | Reason is saved; remove/warn/suspend actions have their stated effects |
| Suspended-account enforcement | Required | Required | suspended user | User is signed out, public content is hidden, and direct writes are rejected |
| Notifications | Required | Required | two devices | Unread count updates without manual reload |
| Offline cold/relaunch behavior | Required | Required | any | Last catalog/feed appears with an offline banner |
| Connection recovery | Required | Required | any | Disable network, open app, restore network, and confirm automatic refresh |
| Slow/interrupted photo upload | Required | Required | monger/taster | A clear error appears and no broken database record remains |
| Account deletion | Required | Required | disposable accounts | Media and account data are removed |
| Apple account deletion/revocation | Required | N/A | disposable Apple account | Reauthentication occurs and deletion completes only after revocation |

## Connection-loss passes

Test each of these once on iPhone and Android:

1. Launch online, load Feed and Discover, force-close, enable airplane mode, relaunch.
2. Start a refresh online, disable the connection mid-request, then restore it.
3. Leave the app backgrounded while offline, restore the connection, then foreground it.
4. Attempt a tasting, comment, follow, and photo upload while offline. Each mutation must fail clearly without showing false success.
5. After reconnection, confirm no duplicate tasting, comment, follow, or photo record was created.

Record device model, OS version, build number, account role, pass/fail, and a screenshot for each failure.
