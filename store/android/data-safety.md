# Google Play Data Safety worksheet

Confirm these answers against the exact production build before submitting.

## Collection and sharing

- Does the app collect or share required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS/TLS through Supabase)
- Can users request deletion? **Yes**, in-app and through the public deletion page
- Is data sold? **No**
- Is data used for advertising? **No**

## Data types

| Google Play category | Collected | Shared | Required | Purpose |
| --- | --- | --- | --- | --- |
| Name | Yes | No | Account profile name may be pseudonymous | Account management, app functionality |
| Email address | Yes | No | Yes for email accounts; Apple relay may be used | Authentication, account management |
| User IDs | Yes | No | Yes | Authentication, app functionality, fraud prevention |
| Photos | Optional | No | No | Profile, tasting, and catalog photos |
| Other user-generated content | Optional | No | No | Tastings, notes, comments, cheese submissions |
| Approximate/precise location | No device collection | No | No | The app stores only location text entered manually |
| App interactions | Yes | No | Part of service use | Likes, follows, saved cheeses, notifications |
| Diagnostics | No currently | No | No | Revisit if crash or analytics software is added |

Supabase processes data as a service provider to operate authentication, database, and storage. Treat processor disclosures according to Google Play’s current Data Safety instructions rather than declaring a sale or independent third-party sharing.

## Security practices

- Authentication tokens persist in encrypted platform/app storage through the Supabase client.
- Database Row Level Security limits access by account and role.
- Uploaded public photos are moderated before public display where applicable.
- Users can report, block, delete individual content, and permanently delete their account.
