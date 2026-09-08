# Deploying the open check-in kiosk + reward options

This is a follow-up to `DEPLOY.md` (which is already deployed and live).
It adds:

- a `kioskLogin` Cloud Function and a matching `kiosk` claim in
  `firestore.rules`, so **Client Check-In needs no PIN at all**;
- three loyalty reward options instead of two;
- "fill in details" returning to the awaiting-checkout list;
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

1. Open `?admin=1` in a private window (so there's no saved session) and
   tap **Client Check-In**. It should go straight to the list with no PIN
   prompt.
2. Tap a client, confirm the check-in, see the greeting.
3. Under **Awaiting Checkout**, tap **Fill In Details**. This *does* ask
   for the admin PIN — it opens the client's full file. After the PIN it
   should land straight on that visit.
4. Add the service, tap **Save Notes**. It should drop you back on the
   check-in list with that client gone from Awaiting Checkout.
5. Open a client with 6+ visits: the reward box should offer three
   choices — 20% off hair services, 25% off spa services, free product.
6. Edit a client and check **United States** is in the country dropdown.

## What the kiosk token can and cannot do

Anyone who opens the check-in screen gets a `kiosk` token. The rules give
that claim exactly four things:

- read the client list (names and phones — needed to tap a name)
- read visit records (needed for the Awaiting Checkout list)
- create a check-in stub record (must be flagged `viaCheckin`, must carry
  no services, and may contain no other fields)
- change `checkinCounter` and `lastMilestoneWinner` in `settings/config`

It **cannot** edit or delete anything else, add or delete clients, change
prices, services, the schedule or licences, or read the admin PIN. All of
that still needs the admin claim, which still needs the admin PIN.
