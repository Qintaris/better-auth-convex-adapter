import { createAdapterFactory } from 'better-auth/adapters'

/**
 * Configuration for the Convex adapter.
 */
export type ConvexAdapterConfig = {
  /**
   * Your Convex deployment URL.
   * Usually the `VITE_CONVEX_URL` environment variable.
   * Example: `https://your-project.convex.cloud`
   */
  convexUrl: string

  /**
   * Your Convex deploy key with admin privileges.
   * Usually the `CONVEX_DEPLOY_KEY` environment variable.
   * Needed to authenticate server-to-server calls to Convex.
   */
  deployKey: string
}

/**
 * Call a Convex mutation via its HTTP API.
 * Avoids requiring the Convex client library on the server side.
 */
async function callConvexMutation(
  convexUrl: string,
  deployKey: string,
  functionPath: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${deployKey}`,
      'Convex-Client': 'better-auth-convex-adapter/1.0',
    },
    body: JSON.stringify({
      path: functionPath,
      format: 'json',
      args: [args],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Convex mutation failed (${response.status}): ${text}`)
  }

  const result = (await response.json()) as {
    status: string
    value?: unknown
    errorMessage?: string
  }

  if (result.status === 'error') {
    throw new Error(`Convex mutation error: ${result.errorMessage}`)
  }

  return result.value
}

/**
 * Creates a Better Auth adapter backed by Convex.
 *
 * ## Quick start
 *
 * 1. **Add auth tables to your Convex schema** (see `src/convex/schema.ts`)
 * 2. **Deploy the Convex auth function** (see `src/convex/auth.ts`)
 * 3. **Configure Better Auth**:
 *
 * ```ts
 * import { betterAuth } from 'better-auth'
 * import { convexAdapter } from 'better-auth-convex-adapter'
 *
 * export const auth = betterAuth({
 *   database: convexAdapter({
 *     convexUrl: process.env.VITE_CONVEX_URL!,
 *     deployKey: process.env.CONVEX_DEPLOY_KEY!,
 *   }),
 *   emailAndPassword: { enabled: true },
 *   // ... your other config
 * })
 * ```
 */
export function convexAdapter(config: ConvexAdapterConfig) {
  const { convexUrl, deployKey } = config

  if (!convexUrl || !deployKey) {
    throw new Error(
      'ConvexAdapter: convexUrl and deployKey are required.\n' +
      '  convexUrl → your Convex deployment URL (e.g. VITE_CONVEX_URL)\n' +
      '  deployKey → your Convex deploy key (e.g. CONVEX_DEPLOY_KEY)',
    )
  }

  return createAdapterFactory({
    config: {
      adapterId: 'convex',
      adapterName: 'Convex Adapter',
      usePlural: false,

      // Convex supports booleans, dates, and JSON natively.
      supportsBooleans: true,
      supportsDates: true,
      supportsJSON: true,

      // Convex uses string IDs (UUIDs).
      supportsNumericIds: false,
      supportsUUIDs: true,

      // Let Convex's `insert()` generate document IDs.
      disableIdGeneration: true,
    },
    adapter: () => {
      const CRUD_PATH = 'betterAuthAdapter:crud'

      const crud = (operation: string, payload: Record<string, unknown>) =>
        callConvexMutation(convexUrl, deployKey, CRUD_PATH, {
          operation,
          ...payload,
        })

      return {
        create: async ({ model, data }) =>
          crud('create', { model, data }),

        findOne: async ({ model, where, select }) =>
          crud('findOne', { model, where, select }),

        findMany: async ({ model, where, limit, sortBy, offset }) =>
          crud('findMany', { model, where, limit, sortBy, offset }),

        update: async ({ model, where, update }) =>
          crud('update', { model, where, data: update }),

        updateMany: async ({ model, where, update }) =>
          crud('updateMany', { model, where, data: update }),

        delete: async ({ model, where }) =>
          crud('delete', { model, where }),

        deleteMany: async ({ model, where }) =>
          crud('deleteMany', { model, where }),

        count: async ({ model, where }) =>
          crud('count', { model, where }),
      }
    },
  })
}
