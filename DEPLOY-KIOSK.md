# Deploying the open check-in kiosk + reward options

This is a follow-up to `DEPLOY.md` (which is already deployed and live).
It adds:

- a `kioskLogin` Cloud Function and a matching `kiosk` claim in
  `firestore.rules`, so **Client Check-In needs no PIN at all**;
- the check-in screen starting **empty** - you search by name or phone
  number instead of the whole client list being on display;
- **Awaiting Checkout** showing only to a signed-in admin, plus a
  **Check-In & Checkouts** entry on the admin dashboard so you can work
  through checkouts back-to-back without logging out;
- three loyalty reward options instead of two;
- United States in the country list.

Only the first item touches Firebase. The other three are `index.html`
only and ship with the merge.

## Order

Deploy the function **before** the rules, and the rules **before**
`index.html`. Each step is safe on its own; the site keeps working
between them.

### 1. Deploy the new function

```
firebase deploy --only functions:kioskLogin --project thl-3cdd0
```

Nothing uses it yet — the live `index.html` doesn't know it exists.

If the deploy fails with an IAM / "Failed to set the IAM Policy" error,
it's the same org-policy issue we hit last time. After the function
exists, run:

```
gcloud run services add-iam-policy-binding kiosklogin \
  --region=us-central1 --project=thl-3cdd0 \
  --member=allUsers --role=roles/run.invoker
```

`kioskLogin` must be publicly callable — that is the whole point of a
kiosk with no login.

### 2. Deploy the rules

```
firebase deploy --only firestore:rules --project thl-3cdd0
```

The old live `index.html` never sends a kiosk token, so it is unaffected:
every existing grant in the rules is unchanged, the kiosk clauses are
purely additive.

### 3. Ship index.html

Merge this branch into `main`. GitHub Pages redeploys automatically.
Wait for the "pages build and deployment" run to go green before
retesting — a stale page will look like the change didn't work.

## Smoke test

### At the kiosk (no login)

1. Open `?admin=1` in a private window (so there's no saved session) and
   tap **Client Check-In**. It should go straight in with no PIN prompt,
   and the screen should be **empty** — no client names at all.
2. Type a name (2+ letters) or a phone number. Only matching clients
   appear. Full number or last 4 digits both work.
3. Tap the name, confirm the check-in, see the greeting.
4. Confirm **Awaiting Checkout** is NOT shown here — that list is only
   for you, when you're signed in.

### Your checkout round (signed in)

5. Tap **Nickita**, enter the admin PIN once.
6. On the dashboard, tap **✓ Check-In & Checkouts** — it shows how many
   are waiting. No logging out to get there.
7. Tap **Fill In Details** on the first one. No second PIN prompt.
8. Add the service, tap **Save Notes**. You land back on the checkout
   list with that client gone. Repeat for the next one.
9. **‹ Back** from that screen returns you to your dashboard, still
   signed in.

### The rest

10. Open a client with 6+ visits: the reward box should offer three
    choices — 20% off hair services, 25% off spa services, free product.
11. Edit a client and check **United States** is in the country dropdown.

## What the kiosk token can and cannot do

Anyone who opens the check-in screen gets a `kiosk` token. The rules give
that claim exactly four things:

- read the client list (the app only ever shows search matches, never the
  roster, but the token itself can read the collection — see below)
- read visit records (`Td` reads a client's prior visits to build their
  greeting)
- create a check-in stub record (must be flagged `viaCheckin`, must carry
  no services, and may contain no other fields)
- change `checkinCounter` and `lastMilestoneWinner` in `settings/config`

It **cannot** edit or delete anything else, add or delete clients, change
prices, services, the schedule or licences, or read the admin PIN. All of
that still needs the admin claim, which still needs the admin PIN.

### The honest limit

Hiding the roster behind a search box is a real improvement — a person
standing at the iPad can no longer read off your client list. But it is a
UI guard, not a wall. Someone who knows how to open browser developer
tools on that page could still call the database directly with the kiosk
token and pull names, phone numbers and visit notes.

Closing that properly means the kiosk talking to a Cloud Function that
only ever returns the one client being searched for, instead of talking to
Firestore directly. That's a bigger change and it is worth doing if the
iPad is ever left somewhere customers are alone with it. Say the word.
