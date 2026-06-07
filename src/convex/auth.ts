/**
 * CRUD mutation for the Better Auth → Convex adapter.
 *
 * ## Setup
 *
 * 1. Copy this file to your Convex project (e.g. `convex/authAdapter.ts`)
 * 2. Add the auth tables to your schema (see `schema.ts`)
 * 3. Run `npx convex deploy`
 *
 * The function will be exposed as `betterAuthAdapter:crud`
 * and called automatically by the Better Auth adapter from your server.
 *
 * ## How it works
 *
 * This single mutation handles all CRUD operations that Better Auth needs:
 * - `create` → insert a document
 * - `findOne` → find one document by indexed field
 * - `findMany` → find multiple documents
 * - `update` / `updateMany` → patch documents
 * - `delete` / `deleteMany` → remove documents
 * - `count` → count matching documents
 *
 * It maps Better Auth model names to Convex table names:
 * - `user` → `authUsers`
 * - `session` → `authSessions`
 * - `account` → `authAccounts`
 * - `verification` → `authVerifications`
 *
 * ## Schema requirements
 *
 * Your Convex schema MUST include the auth tables. See `schema.ts`.
 */

import { mutation } from './_generated/server'
import { v } from 'convex/values'

// ---------------------------------------------------------------------------
// Model → table mapping
// ---------------------------------------------------------------------------

const MODEL_TABLE_MAP: Record<string, string> = {
  user: 'authUsers',
  session: 'authSessions',
  account: 'authAccounts',
  verification: 'authVerifications',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WhereClause = {
  field: string
  value: unknown
  operator?: string
  connector?: string
}

// ---------------------------------------------------------------------------
// Index lookup — avoids .filter() which can be unreliable via HTTP API
// ---------------------------------------------------------------------------

function findBestIndex(
  table: string,
  where: WhereClause[],
): { index: string; query: (q: any) => any } | null {
  const singleEq = where.length === 1 && (!where[0].operator || where[0].operator === 'eq')
  if (!singleEq) return null

  const field = where[0].field
  const value = where[0].value

  switch (table) {
    case 'authUsers':
      if (field === 'id') return { index: 'by_auth_id', query: (q: any) => q.eq('id', value as string) }
      if (field === 'email') return { index: 'by_email', query: (q: any) => q.eq('email', value as string) }
      break
    case 'authSessions':
      if (field === 'id') return { index: 'by_auth_id', query: (q: any) => q.eq('id', value as string) }
      if (field === 'token') return { index: 'by_token', query: (q: any) => q.eq('token', value as string) }
      if (field === 'userId') return { index: 'by_user_id', query: (q: any) => q.eq('userId', value as string) }
      break
    case 'authAccounts':
      if (field === 'id') return { index: 'by_auth_id', query: (q: any) => q.eq('id', value as string) }
      if (field === 'userId') return { index: 'by_user_id', query: (q: any) => q.eq('userId', value as string) }
      break
    case 'authVerifications':
      if (field === 'id') return { index: 'by_auth_id', query: (q: any) => q.eq('id', value as string) }
      if (field === 'identifier') return { index: 'by_identifier', query: (q: any) => q.eq('identifier', value as string) }
      break
  }

  return null
}

// ---------------------------------------------------------------------------
// Filter predicate builder (fallback when no index matches)
// ---------------------------------------------------------------------------

function buildFilterPredicate(where: WhereClause[]) {
  return (q: any) => {
    for (let i = 0; i < where.length; i++) {
      const clause = where[i]
      const op = clause.operator || 'eq'

      let pred: any
      switch (op) {
        case 'eq':
          pred = q.eq(q.field(clause.field), clause.value)
          break
        case 'ne':
          pred = q.neq(q.field(clause.field), clause.value)
          break
        case 'lt':
          pred = q.lt(q.field(clause.field), clause.value)
          break
        case 'lte':
          pred = q.lte(q.field(clause.field), clause.value)
          break
        case 'gt':
          pred = q.gt(q.field(clause.field), clause.value)
          break
        case 'gte':
          pred = q.gte(q.field(clause.field), clause.value)
          break
        case 'in':
          pred = q.or(
            ...((clause.value as unknown[]) || []).map((v: unknown) =>
              q.eq(q.field(clause.field), v),
            ),
          )
          break
        case 'not_in':
          pred = q.and(
            ...((clause.value as unknown[]) || []).map((v: unknown) =>
              q.neq(q.field(clause.field), v),
            ),
          )
          break
        default:
          pred = q.eq(q.field(clause.field), clause.value)
      }

      if (i === 0) continue
      return q.and(pred)
    }
  }
}

// ---------------------------------------------------------------------------
// Query helper — uses .withIndex() when possible, falls back to .filter()
// then in-memory filtering
// ---------------------------------------------------------------------------

async function query(ctx: any, table: string, where: WhereClause[]) {
  const index = findBestIndex(table, where)
  if (index) {
    return ctx.db.query(table).withIndex(index.index, index.query).collect()
  }

  try {
    return await ctx.db.query(table).filter(buildFilterPredicate(where)).collect()
  } catch {
    const all = await ctx.db.query(table).collect()
    return all.filter((d: any) =>
      where.every((clause) => {
        const val = d[clause.field]
        const op = clause.operator || 'eq'
        if (op === 'eq') return val === clause.value
        if (op === 'ne') return val !== clause.value
        return String(val) === String(clause.value)
      }),
    )
  }
}

async function findOne(ctx: any, table: string, where: WhereClause[]) {
  const index = findBestIndex(table, where)
  if (index) {
    return ctx.db.query(table).withIndex(index.index, index.query).first()
  }

  try {
    return await ctx.db.query(table).filter(buildFilterPredicate(where)).first()
  } catch {
    const results = await query(ctx, table, where)
    return results[0] ?? null
  }
}

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

export const crud = mutation({
  args: {
    operation: v.string(),
    model: v.string(),
    data: v.optional(v.any()),
    where: v.optional(
      v.array(
        v.object({
          field: v.string(),
          value: v.any(),
          operator: v.optional(v.string()),
          connector: v.optional(v.string()),
        }),
      ),
    ),
    limit: v.optional(v.number()),
    sortBy: v.optional(
      v.object({
        field: v.string(),
        direction: v.optional(v.string()),
      }),
    ),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const table = MODEL_TABLE_MAP[args.model]
    if (!table) {
      throw new Error(`Unknown Better Auth model: ${args.model}. Expected one of: ${Object.keys(MODEL_TABLE_MAP).join(', ')}`)
    }

    const where = (args.where as WhereClause[]) || []

    switch (args.operation) {
      // ── CREATE ──────────────────────────────────────────────
      case 'create': {
        const data = args.data as Record<string, unknown>
        const now = Date.now()
        const id = await ctx.db.insert(table, {
          ...data,
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
        })
        return ctx.db.get(id)
      }

      // ── FIND ONE ────────────────────────────────────────────
      case 'findOne': {
        if (where.length === 0) return null
        return findOne(ctx, table, where)
      }

      // ── FIND MANY ───────────────────────────────────────────
      case 'findMany': {
        let results = await query(ctx, table, where)

        if (args.sortBy) {
          results.sort((a: any, b: any) => {
            const cmp = a[args.sortBy!.field] < b[args.sortBy!.field] ? -1
              : a[args.sortBy!.field] > b[args.sortBy!.field] ? 1 : 0
            return args.sortBy!.direction === 'desc' ? -cmp : cmp
          })
        }

        if (args.offset) results = results.slice(args.offset)
        if (args.limit && args.limit > 0) results = results.slice(0, args.limit)

        return results
      }

      // ── UPDATE ──────────────────────────────────────────────
      case 'update': {
        const target = await findOne(ctx, table, where)
        if (!target) return null
        await ctx.db.patch(target._id, {
          ...(args.data as Record<string, unknown>),
          updatedAt: Date.now(),
        })
        return ctx.db.get(target._id)
      }

      // ── UPDATE MANY ─────────────────────────────────────────
      case 'updateMany': {
        const results = await query(ctx, table, where)
        const updateData = args.data as Record<string, unknown>
        const now = Date.now()
        for (const doc of results) {
          await ctx.db.patch(doc._id, { ...updateData, updatedAt: now })
        }
        return results.length
      }

      // ── DELETE ──────────────────────────────────────────────
      case 'delete': {
        const target = await findOne(ctx, table, where)
        if (target) await ctx.db.delete(target._id)
        return
      }

      // ── DELETE MANY ─────────────────────────────────────────
      case 'deleteMany': {
        const results = await query(ctx, table, where)
        for (const doc of results) {
          await ctx.db.delete(doc._id)
        }
        return results.length
      }

      // ── COUNT ───────────────────────────────────────────────
      case 'count': {
        const results = await query(ctx, table, where)
        return results.length
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}. Expected one of: create, findOne, findMany, update, updateMany, delete, deleteMany, count`)
    }
  },
})
