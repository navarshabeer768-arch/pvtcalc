# E2E tests

These use two Playwright browser contexts (one per partner) against a real
Supabase project. They require:

1. A Supabase project with migrations applied and Edge Functions deployed.
2. Two seeded users (`scripts/seed-users.ts`) with unlock codes set
   (`scripts/set-unlock-code.ts`).
3. Env vars for the test run:

```
E2E_A_EMAIL=
E2E_A_CODE=
E2E_B_EMAIL=
E2E_B_CODE=
E2E_PASSWORD=
```

Run with `npx playwright test`.
