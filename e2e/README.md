# E2E tests

These use two Playwright browser contexts (one per partner) against a real
Supabase project. There's no email/password login in this app — the
unlock code alone both unlocks the calculator and signs the matching user
in (the `unlock` Edge Function mints a session server-side). So all these
tests need is:

1. A Supabase project with migrations applied and Edge Functions deployed.
2. Two seeded users (`scripts/seed-users.ts`) with unlock codes set
   (`scripts/set-unlock-code.ts`).
3. Env vars for the test run:

```
E2E_A_CODE=
E2E_B_CODE=
```

Run with `npx playwright test`.
