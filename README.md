# Calculator

A private chat PWA for two people, disguised as a calculator. Built with
React + TypeScript + Vite + Tailwind on the frontend, Supabase (Postgres,
Auth, Realtime, Storage, Edge Functions) on the backend.

See the bottom of this file for the full "what's implemented / what's not"
report from the initial build.

## Local setup

```bash
npm install
cp .env.example .env            # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
cp .env.local.example .env.local  # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (local scripts only)
```

### Database + Edge Functions

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                       # applies supabase/migrations/*.sql
supabase functions deploy unlock
supabase functions deploy set-unlock-code
supabase secrets set ATTEMPT_HASH_SALT=$(openssl rand -hex 32)
```

In the Supabase dashboard: **Authentication → Providers → Email → disable
"Allow new users to sign up"** (public sign-ups must stay off — the two
users are created manually). Set **Site URL** to your deployed URL (and
`http://localhost:5173` while developing).

There is no email/password login anywhere in this app. Each person's
Supabase Auth account exists only so Row Level Security has an `auth.uid()`
to check — its password is a random value nobody ever sees or uses. The
**unlock code is the only credential**: entering the right one calls the
`unlock` Edge Function, which mints a real session server-side (via a
one-time magic-link token, using the service role) and hands it to the
client. See `supabase/functions/unlock/index.ts`.

### Create the two users and set unlock codes

```bash
npm run seed-users -- \
  --me-email you@example.com --me-name "Your Name" --me-pronoun He \
  --partner-email her@example.com --partner-name "Her Name" --partner-pronoun She

npm run set-unlock-code -- --email you@example.com --code 4821
npm run set-unlock-code -- --email her@example.com --code 173042
```

Each person can later change their own code from Settings → Privacy →
"Change unlock code" (requires knowing the current code and having an
active session).

### Run

```bash
npm run dev
```

### Test

```bash
npm run test                 # unit tests (Vitest)
npx playwright test          # E2E (Calculator tests run standalone; the
                              # two-person tests need E2E_* env vars — see e2e/README.md)
npm run build && npm run check-bundle-safety
```

## Deploy

- **Frontend:** Vercel or Netlify. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_APP_NAME` as production env vars. Do **not** set `VITE_DEV_UNLOCK_CODE`
  in production — the build fails on purpose if it's present.
- **Backend:** `supabase db push` + `supabase functions deploy` against your
  linked project, same as local setup above.
- Update the Supabase project's **Site URL** and **Redirect URLs** to your
  production domain.

---

## Final report

### What was implemented

- **Calculator disguise**: real tokenizer/shunting-yard evaluator (no
  `eval`/`Function`), chaining, operator replacement, divide-by-zero →
  `Error`, backspace, decimal point, random ≤3-digit practice line that
  regenerates on load and after each attempt.
- **Unlock flow**: digits-only 4–8 length input silently checked against
  the `unlock` Edge Function; correct code unlocks, wrong code behaves like
  ordinary arithmetic, escalating server-enforced lockout (30s → 1m → 5m →
  15m) mirrored in the UI. No wording ever reveals a "chat code" concept.
- **Stealth hardening**: single `/` route with in-memory view switching,
  hash-only chunk names (verified in the production build output), neutral
  `calc-*` storage/IndexedDB keys, calculator-only manifest/icons/title,
  re-lock on `visibilitychange`/`pagehide`, configurable auto-lock timer,
  install prompts only inside Settings.
- **Auth**: no email/password login anywhere. The unlock code is the only
  credential; a correct code either reuses an existing Supabase session or
  (on a fresh device) has the `unlock` Edge Function mint one server-side
  via a one-time magic-link token minted with the service role — RLS stays
  fully intact (`auth.uid()` is populated normally) without a password ever
  existing on the wire. `set-unlock-code` Edge Function for in-app code
  changes, local `scripts/seed-users.ts` / `scripts/set-unlock-code.ts` for
  initial setup.
- **Database + RLS + Storage**: full schema from the spec (all 15 tables),
  indexes, `search_tsv` generated column + GIN index, `is_conversation_member`
  helper, column-restricting triggers on `messages`/`profiles`, RLS on every
  table (zero policies on `unlock_codes`/`unlock_attempts`), four private
  storage buckets with path-based ownership/membership policies, Realtime
  publication on the four live tables.
- **Chat core**: realtime text messaging (single channel: Postgres Changes +
  Broadcast typing + Presence), cursor-paginated virtualized history,
  date separators, reply/quote-and-jump, edit, delete-for-me/everyone,
  reactions, pin (shared), favorite (per-user), read receipts (sent/
  delivered/read) respecting the privacy toggles, presence + "is typing"
  with pronoun labels, full-text search.
- **Media**: image picker with client-side compression + EXIF strip via
  canvas re-encode, inline display via signed URLs; voice recording via
  `MediaRecorder` with the webm/opus → mp4 fallback for iOS Safari, playback
  with seek.
- **Couple space**: nickname/tagline/relationship-start editor with a live
  days-together counter; memories (title/description/date) and special
  dates (with yearly-recurrence countdown) as simple CRUD screens.
- **Settings**: theme (4 presets via CSS variables + custom), font size,
  privacy toggles, auto-lock timeout, change-code flow, storage usage +
  cache-clear actions, no notification settings anywhere.
- **Offline**: app-shell-only service worker (Workbox), AES-GCM-encrypted
  IndexedDB cache of the last ~200 messages using a non-extractable
  WebCrypto key, idempotent outbox for offline text sends, online/offline
  banner.
- **Diagnostics**: hidden screen (7 taps on the version number, gated by
  `DEV`/`VITE_ENABLE_DIAGNOSTICS`) showing connection, Realtime, storage,
  user, display mode, service worker, network, DB latency, outbox size.
- **Tests**: Vitest unit tests for the evaluator, question generator, lock
  state machine, and date grouping (22 passing); an RLS integration suite
  (`supabase/tests/rls.test.ts`) that runs against a real seeded project;
  Playwright E2E covering the calculator flows (passing, run live) plus a
  two-person suite for unlock/send/edit/delete/reply/react/typing/offline
  (gated on env vars — see `e2e/README.md`); a bundle-safety script that
  fails the build on any push/notification API reference or leaked secret.

### What's simplified or not implemented, honestly

- **Backgrounds/avatars upload UI**: the storage buckets, policies, and
  service functions exist, but there's no dedicated "pick a background
  image" or "upload avatar" screen yet — couple background/tagline text
  fields are wired, image upload for them is not.
- **Custom accent color picker**: the `theme: 'custom'` option and
  `accent_color` column exist; there's no color-picker UI yet.
- **Media viewer**: images open inline but the pinch-zoom/swipe-to-close
  fullscreen viewer isn't built (`onOpenMedia` is a no-op placeholder).
- **iOS `visualViewport` keyboard handling**: not implemented; the composer
  uses `env(safe-area-inset-bottom)` but hasn't been tuned against a real
  iOS standalone PWA keyboard.
- **Desktop drag-and-drop images / keyboard shortcuts beyond Enter/Shift+Enter**:
  not implemented.
- **`beforeinstallprompt` capture for the in-app Android/desktop install
  button**: not wired up; only the "no install UI before unlock" rule is
  enforced.
- Search, pinned, and favorites screens are functional but simple (no
  highlight-in-context, no date/media-type filters yet — the DB/index side
  supports them).

### Environment variables

See `.env.example` and `.env.local.example`. Edge Function secret:
`ATTEMPT_HASH_SALT` (set via `supabase secrets set`).

### Remaining limitations (stated honestly, as required)

- Messages are **not end-to-end encrypted**. They're stored in Supabase
  Postgres/Storage and readable by the project owner (RLS protects the two
  users from each other's private data and from outsiders, not from the
  database administrator).
- The calculator disguise deters a casual glance at the phone; it does not
  protect against someone who has the unlocked device and opens developer
  tools or inspects local storage.
- iOS PWAs have OS-level limits on background execution and can evict
  storage (including the IndexedDB message cache) under memory pressure.
