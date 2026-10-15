# Local Firebase Emulator Guide

This guide is for teammates testing TrustHome locally. Use the Firebase emulators for routine development instead of signing into the shared Firebase project with a personal Gmail account.

## What is local

When the app runs through Vite, its Firebase Auth, Firestore, and Storage SDKs connect to local emulators by default. Emulator mode uses the demo project ID `demo-trusthome-local` and a fake client configuration. It has no live Firebase resources, so attempts to access a non-emulated Firebase service fail instead of falling back to `trusthome-ph`. Local accounts and records are not copied from Firebase Console and are not visible to other teammates.

Configured emulator endpoints:

| Service | Local endpoint |
|---|---|
| Authentication | `127.0.0.1:9099` |
| Firestore | `127.0.0.1:8082` |
| Storage | `127.0.0.1:9200` |

The Functions emulator is not started by the normal browser workflow. Local Firebase configuration is in `firebase.json` and `src/firebase.js`; `.firebaserc` retains `trusthome-ph` as the default for explicit Firebase CLI operations such as deployment.

## Start the app

Prerequisites: Node/npm, the Firebase CLI, and Java. From the repository root, use two terminals.

Terminal 1 starts the emulators. Leave it open while testing:

```powershell
npm run emulators
```

Wait until the CLI reports that the emulators are ready. Terminal 2 starts the app:

```powershell
npm run dev
```

Open the `Local` URL Vite prints, usually `http://localhost:5173/`. If that port is busy, Vite selects another one, such as `http://localhost:5174/`.

To stop local testing, press `Ctrl+C` in both terminals.

## Create a local test account

The emulator starts with an empty Authentication and Firestore database. Register an account using **Create one** on the app's login page. TrustHome creates a local user profile with the normal `user` role. The account is only stored in the local Auth emulator.

Use an obviously synthetic address such as `owner.local@example.test` and a test-only password that meets the form's eight-character minimum. The emulator does not send email, so a real mailbox is not needed. Teammates can create separate local accounts to test different user sessions; each person has their own emulator data.

Account contact sharing is implemented locally through opt-in `publicProfiles` fields. In emulator tests, use synthetic email/phone values and remember that opted-in values are public to any reader; a phone number that is not shared is not saved privately. See [Account Profile and Contact Preferences](Account_Profile_and_Contact_Preferences.md). For listing tests, set a synthetic display name before submission: the current listing flow can fall back to the Auth email for the publicly readable `ownerName` field. Never use real contact details in demo listings.

## Create a local admin account

Admin promotion must not be exposed as an app feature. Firestore Rules intentionally prevent a regular user from changing their own role. For local-only testing, use the Emulator Suite UI's privileged data tools:

1. Start the emulators and app as above, then register a synthetic account in the app.
2. Open the Emulator UI at `http://127.0.0.1:4000/auth`, find the new account, and copy its UID.
3. Open `http://127.0.0.1:4000/firestore`. Find `users/{UID}` created by the app, or create that document if it is missing.
4. Set `role` to `admin` and `status` to `active`. Keep the account's `name` and `email` fields if present.
5. Sign out and back in, or refresh the app. The auth context listens to the local Firestore profile and should expose the admin pages.

These steps modify only the local emulator. Do not use Firebase Console or the shared `trusthome-ph` project to grant a test account admin access.

### Google sign-in

The Google button can be used with the Auth Emulator's simulated Google provider flow. The emulator serves a local mock sign-in page and creates a mock identity. Do not enter your real Gmail password or rely on your personal Google account for this local test. If you only need to test the app's normal account flow, email/password registration is the simplest option.

## What local testing covers

- Sign up, sign in, and app flows that read/write Auth, Firestore, or Storage data.
- Booking confirmation concurrency and Firestore Rules can be checked with `npm run test:firestore-rules`; this uses a demo project ID.
- The experimental Storage Rules can be checked with `npm run test:storage-rules`; this uses a demo project ID and does not reflect the live Spark project's capabilities.
- Local data is separate from production. Do not expect a Firebase Console user, listing, or booking to appear in the emulator.

## Important boundaries

- Do not set `VITE_USE_SHARED_FIREBASE=true` for routine local testing. That switches all Firebase client services out of emulator mode and sends Auth, Firestore, Storage, and Functions SDK traffic to the shared `trusthome-ph` project. It is not an Auth-only switch.
- Listing photos and verification documents still upload to Cloudinary, not a local emulator. Use synthetic/sample files only; do not upload personal or sensitive images during routine local testing.
- The Firebase project is on Spark, and its Storage page says a billing account (Blaze) is required. The app does not use Firebase Storage for document uploads; the local Storage emulator is only for isolated Rules testing. Do not enable billing or interpret emulator tests as evidence that live document delivery works.
- A new local account has the ordinary `user` role. Admin pages will not be available unless a test admin profile is deliberately seeded into the local emulator; never promote a real production account for local testing.
- The app's normal browser workflow does not use the Functions emulator. Server-side function tests need their own emulator setup.

## Use the shared Firebase project

Only do this deliberately when you intend to work with shared project data. Create or edit the untracked root `.env.local` file with:

```dotenv
VITE_USE_SHARED_FIREBASE=true
```

Restart `npm run dev` after changing it. In this mode, app sign-up creates a real Firebase Authentication account and writes its Firestore profile to `trusthome-ph`; writes are shared with the team. Remove the variable and restart Vite to return to the `demo-trusthome-local` emulators. Do not use this mode for admin-role testing unless an authorized project admin has approved the real role change.

## Troubleshooting

**The browser says `127.0.0.1:9099` refused to connect.** The Auth Emulator is not running. Start `npm run emulators` in Terminal 1, wait for it to become ready, then close the failed popup and retry sign-in.

**The app says permission denied or cannot load data.** Confirm Terminal 1 is still running and check its logs. The emulators enforce the checked-in Firestore and Storage Rules; they do not automatically contain production users or records.

**The app opened on a different Vite port.** Use the exact `Local` URL printed by `npm run dev`; the default port may already be occupied.

## Reference

- Firebase documentation: [Connect your app to the Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- Project setup and commands: [README.md](../README.md)
