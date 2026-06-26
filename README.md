# Better Auth × Convex Adapter 🏔️

**Use [Better Auth](https://www.better-auth.com/) with [Convex](https://www.convex.dev/) as your database.**

No more juggling two databases. Auth data lives alongside your app data — same deployment, same DX, one less thing to manage.

## Why?

Better Auth is the best auth framework for TypeScript. Convex is the best real-time database. But they don't speak the same language out of the box — Better Auth expects SQL, Convex is NoSQL.

This adapter is the bridge. It implements Better Auth's official `createAdapterFactory` interface, translating every auth operation into Convex mutations. Users, sessions, accounts, and verifications are stored in your existing Convex deployment — no external SQL database required.

## Features

- **Single database** — auth and app data in one Convex project
- **Official API** — uses Better Auth's `createAdapterFactory`, the same interface as Prisma, Drizzle, and Kysely adapters
- **Indexed queries** — all Better Auth lookups use `withIndex()` for reliability via Convex's HTTP API
- **Resilient** — falls back to `.filter()` and in-memory filtering if indexed queries can't satisfy the query
- **TypeScript** — full type inference through Better Auth
- **Edge-ready** — works on Vercel Edge, Netlify, Cloudflare, any `fetch()`-capable runtime

## Quick Start

### 1. Install

```bash
npm install better-auth-convex-adapter
```

### 2. Add auth tables to your Convex schema

In `convex/schema.ts`:

```ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ... your app tables ...

  // ── Better Auth tables ──────────────────────────────────────
  authUsers: defineTable({
    id: v.string(),
    name: v.optional(v.string()),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['id'])
    .index('by_email', ['email']),

  authSessions: defineTable({
    id: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['id'])
    .index('by_token', ['token'])
    .index('by_user_id', ['userId']),

  authAccounts: defineTable({
    id: v.string(),
    providerId: v.string(),
    accountId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['id'])
    .index('by_user_id', ['userId'])
    .index('by_provider', ['providerId', 'accountId']),

  authVerifications: defineTable({
    id: v.string(),
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['id'])
    .index('by_identifier', ['identifier']),
})
```

### 3. Deploy the Convex auth function

Copy `src/convex/auth.ts` from this package (or [from GitHub](https://github.com/Qintaris/better-auth-convex-adapter/blob/main/src/convex/auth.ts)) to your `convex/` directory. This file is a Convex project source file, not a compiled package export, because it imports your local `convex/_generated/server` module:

```bash
cp node_modules/better-auth-convex-adapter/src/convex/auth.ts convex/authAdapter.ts
```

Then deploy:

```bash
npx convex deploy
```

This exposes the `betterAuthAdapter:crud` mutation that the adapter calls at runtime.

### 4. Wire Better Auth

```ts
import { betterAuth } from 'better-auth'
import { convexAdapter } from 'better-auth-convex-adapter'
import { tanstackStartCookies } from 'better-auth/tanstack-start'  // optional

export const auth = betterAuth({
  database: convexAdapter({
    // Your Convex deployment URL — usually from VITE_CONVEX_URL
    convexUrl: process.env.VITE_CONVEX_URL!,
    // Your Convex deploy key with admin privileges
    deployKey: process.env.CONVEX_DEPLOY_KEY!,
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Optional: social providers
  socialProviders: {
    // google: { clientId: '...', clientSecret: '...' },
  },

  // Optional: TanStack Start / SSR cookies
  plugins: [tanstackStartCookies()],
})
```

### 5. Set environment variables

On your hosting platform (Vercel, Netlify, etc.):

```
VITE_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-project|base64key
```

**Important:** `CONVEX_DEPLOY_KEY` must have **admin privileges** so the adapter can call Convex mutations from your server. Never expose it to browser/client code.

## How it works

```
Browser ──POST──→ Your Server (Better Auth handler)
                     │
                     │  adapter.create({ model: 'user', data: {...} })
                     ▼
           Convex HTTP API (/api/mutation)
                     │
                     ▼
           betterAuthAdapter:crud mutation
                     │
                     ├─ .withIndex() for indexed fields (id, email, token, userId, identifier)
                     ├─ .filter() fallback for non-indexed queries
                     └─ in-memory fallback if all else fails
                     │
                     ▼
           authUsers / authSessions / authAccounts / authVerifications
```

## API

### `convexAdapter(config)`

Creates a Better Auth database adapter.

**Parameters:**

| Parameter    | Type     | Description |
|-------------|----------|-------------|
| `convexUrl` | `string` | Your Convex deployment URL (e.g. `https://my-project.convex.cloud`) |
| `deployKey` | `string` | Convex deploy key with admin access (e.g. `prod:my-project\|base64...`) |

**Returns:** A Better Auth adapter factory ready to pass as `database` in your `betterAuth()` config.

## Requirements

- `better-auth` ≥ 1.6.0
- `convex` ≥ 1.40.0
- Node.js 18+ / Edge Runtime with `fetch`

## Caveats

- **Convex mutations have a 5-second timeout.** Auth operations are fast (single document reads/writes) so this is rarely an issue, but be aware for bulk operations or large deployments.
- **`CONVEX_DEPLOY_KEY` is sensitive.** Treat it like a database password. Use environment-specific keys (dev vs. prod), never commit it to source control, and never expose it through `NEXT_PUBLIC_*`, `VITE_*`, or any other client-side environment variable.

## Why not the Kysely adapter + a separate SQL database?

You can! Better Auth's official Kysely adapter works great with Turso, Neon, PlanetScale, etc. If you're comfortable running two databases, that's a valid path.

But if you're already on Convex and want fewer moving parts, this adapter gives you:

- **One deployment** — auth data is backed up alongside app data, same CI/CD, same dashboard
- **One billing** — no separate database to provision or monitor
- **Same DX** — you already know how to query and mutate Convex data

## Support

If this adapter saves you time, you can support the project with a donation:

[Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=95T36AZHYRJ82)

## License

MIT © [Qintaris](https://github.com/Qintaris)
