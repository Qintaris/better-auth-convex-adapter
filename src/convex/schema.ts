/**
 * Better Auth tables to add to your Convex schema.
 *
 * ## Usage
 *
 * Copy the tables below into your `convex/schema.ts` file:
 *
 * ```ts
 * import { defineSchema, defineTable } from 'convex/server'
 * import { v } from 'convex/values'
 *
 * export default defineSchema({
 *   // ... your existing tables ...
 *
 *   // --- Better Auth tables ---
 *   // (paste the definitions below)
 * })
 * ```
 *
 * Every table is indexed on the fields Better Auth queries most,
 * ensuring fast lookups without .filter().
 */

// ---------------------------------------------------------------------------
// authUsers
// ---------------------------------------------------------------------------
// defineTable({
//   id: v.string(),
//   name: v.optional(v.string()),
//   email: v.string(),
//   emailVerified: v.boolean(),
//   image: v.optional(v.string()),
//   createdAt: v.number(),
//   updatedAt: v.number(),
// })
//   .index('by_auth_id', ['id'])
//   .index('by_email', ['email']),

// ---------------------------------------------------------------------------
// authSessions
// ---------------------------------------------------------------------------
// defineTable({
//   id: v.string(),
//   userId: v.string(),
//   expiresAt: v.number(),
//   token: v.string(),
//   ipAddress: v.optional(v.string()),
//   userAgent: v.optional(v.string()),
//   createdAt: v.number(),
//   updatedAt: v.number(),
// })
//   .index('by_auth_id', ['id'])
//   .index('by_token', ['token'])
//   .index('by_user_id', ['userId']),

// ---------------------------------------------------------------------------
// authAccounts
// ---------------------------------------------------------------------------
// defineTable({
//   id: v.string(),
//   providerId: v.string(),
//   accountId: v.string(),
//   userId: v.string(),
//   accessToken: v.optional(v.string()),
//   refreshToken: v.optional(v.string()),
//   idToken: v.optional(v.string()),
//   accessTokenExpiresAt: v.optional(v.number()),
//   refreshTokenExpiresAt: v.optional(v.number()),
//   scope: v.optional(v.string()),
//   password: v.optional(v.string()),
//   createdAt: v.number(),
//   updatedAt: v.number(),
// })
//   .index('by_auth_id', ['id'])
//   .index('by_user_id', ['userId'])
//   .index('by_provider', ['providerId', 'accountId']),

// ---------------------------------------------------------------------------
// authVerifications
// ---------------------------------------------------------------------------
// defineTable({
//   id: v.string(),
//   identifier: v.string(),
//   value: v.string(),
//   expiresAt: v.number(),
//   createdAt: v.number(),
//   updatedAt: v.number(),
// })
//   .index('by_auth_id', ['id'])
//   .index('by_identifier', ['identifier']),
