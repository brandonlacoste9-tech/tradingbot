# PR1 — Auth + multi-user tenancy

## What shipped

| Piece | Detail |
|-------|--------|
| **Tenant isolation** | Proposals, journal, orders, audit scoped per `user_id` |
| **Per-user PaperSim** | Each user gets own $100k sim book |
| **Auth modes** | `AUTH_MODE=disabled` (default) or `clerk` |
| **Demo multi-user** | Header `X-User-Id` or UI “Switch user” |
| **Clerk ready** | JWT verify via JWKS when `AUTH_MODE=clerk` |
| **`GET /me`** | Current user profile |

## Auth modes

### `AUTH_MODE=disabled` (current Render default)

- Client sends `X-User-Id: <tenant>`
- UI “Switch user” stores id in `localStorage`
- Good for demos and testing isolation before Clerk keys

### `AUTH_MODE=clerk`

Set on API (Render):

```env
AUTH_MODE=clerk
CLERK_ISSUER=https://YOUR.clerk.accounts.dev
CLERK_JWKS_URL=https://YOUR.clerk.accounts.dev/.well-known/jwks.json
# optional:
# CLERK_AUDIENCE=
```

Frontend (Netlify):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

Then wire `setAuthToken(await session.getToken())` from Clerk (next PR if publishable key present).

## Verify isolation

```bash
curl -X POST $API/agent/chat -H "Content-Type: application/json" \
  -H "X-User-Id: alice" -d "{\"message\":\"Propose a limit buy of 1 share of SPY\"}"

curl $API/journal -H "X-User-Id: bob"
# bob journals empty
```

## Not in PR1 (next)

- Postgres persistence (survives restart) — PR2  
- Stripe billing — PR3  
- Full Clerk UI SignIn/SignUp components — when keys ready  
- Per-user Grok quotas — PR4  

## Storage note

PR1 uses **process memory** multi-tenant maps. Render free tier restarts clear state.  
PR2 moves paper books + journals to Postgres.
