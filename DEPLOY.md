# Deploying the Firestore security fix

This branch adds real Firebase Authentication to login, locks down
`firestore.rules`, and adds two Cloud Functions (`clientLogin`, `adminLogin`,
plus `adminStatus` and a one-time `migrateAdminPin`). Follow this order —
each step depends on the one before it.

## 0. One-time setup (skip if already done)

```
npm install -g firebase-tools
firebase login
```

## 1. Deploy the Cloud Functions first

```
firebase deploy --only functions --project thl-3cdd0
```

The site keeps working exactly as it does today while this deploys — the
Firestore rules haven't changed yet, so nothing is gated on the new
functions until step 3.

## 2. Migrate the admin PIN

This moves the admin PIN out of `settings/config` (plaintext, about to
become readable by any signed-in client) into `secure/admin` (hashed,
salted, and locked to `allow read, write: if false` — only Cloud Functions
can ever touch it). It's a no-op if there's no PIN to migrate, and safe to
run more than once.

Easiest way: open the deployed `clientLogin`/`migrateAdminPin` function in
the Firebase console (Functions tab) and use "Test function" with an empty
`{}` payload, or run:

```
curl -X POST https://us-central1-thl-3cdd0.cloudfunctions.net/migrateAdminPin \
  -H "Content-Type: application/json" -d '{"data":{}}'
```

Check the response: `{"result":{"migrated":true}}` means it moved an
existing PIN; `{"migrated":false,"reason":"no-existing-pin"}` means there
was nothing to migrate (fine on a fresh project — the admin app will just
prompt for first-time PIN setup instead).

## 3. Deploy the new Firestore rules

```
firebase deploy --only firestore:rules --project thl-3cdd0
```

From this point on, the *old* `index.html` (still live on GitHub Pages
until you merge this branch) will no longer be able to log anyone in —
its login flow reads the whole `clients` collection directly, which the
new rules block. Move quickly to step 4, or expect a login outage on the
live site between steps 3 and 4.

## 4. Ship the new index.html

Merge this branch (`claude/firestore-security-auth-ftgah8`) into `main`.
GitHub Pages redeploys `index.html` automatically from `main`.

## 5. Smoke-test the live site

- Client: sign in with a real phone + PIN, confirm visit history and
  booking still work.
- Admin: go to `?admin=1`, sign in with the existing admin PIN (it still
  works — step 2 preserved it), confirm the client list, check-in, and
  reports all load.
- Confirm a client cannot see another client's data (there's no UI path
  to try someone else's ID, but you can verify in the Firebase console
  under Firestore > Rules Playground, or trust the automated test run
  described in the PR description).

## Rolling back

If something breaks after step 3/4: the fastest fix is usually forward,
not backward — the old `index.html`'s login flow cannot work under any
rules that actually restrict `clients` reads, so reverting rules to
`allow read, write: if true` (the original open state) is the only real
rollback, and that re-opens the exact hole this change closes. Prefer to
fix forward; ping the person who ran this migration if you get stuck.
