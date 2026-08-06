import type { DatabaseConfig } from '@stacksjs/types'
import type { SupportedDialect } from 'bun-query-builder'
import { env } from '@stacksjs/env'
/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: env.DB_CONNECTION as SupportedDialect || 'sqlite',

  connections: {
    sqlite: {
      // SQLite requires a file path, not a database name
      database: env.DB_DATABASE_PATH || 'database/stacks.sqlite',
      prefix: '',
    },

    dynamodb: {
      key: env.AWS_ACCESS_KEY_ID || '',
      secret: env.AWS_SECRET_ACCESS_KEY || '',
      region: env.AWS_DEFAULT_REGION || 'us-east-1',
      prefix: env.DB_DATABASE || 'stacks',
      endpoint: env.DB_PORT ? `http://localhost:${env.DB_PORT}` : 'http://localhost:8000',
    },

    mysql: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },

    vitess: {
      name: env.DB_DATABASE || 'predicthq',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 15306,
      username: env.DB_USERNAME || 'predicthq',
      password: env.DB_PASSWORD || '',
      prefix: '',
      // PredictHQ deliberately starts on one unsharded keyspace. This keeps
      // routing and identifier allocation simple while retaining a clean
      // path to horizontal sharding once the workload justifies it.
      //
      // Read from the environment rather than hardcoded, because this is
      // not only a connection setting: `DB_VITESS_SHARDED` is what the
      // migration generator reads to decide whether the keyspace can use
      // AUTO_INCREMENT and foreign keys, and it assumes **sharded** when
      // the variable is absent. A generator run without it emits DDL for
      // a keyspace we do not have — tables whose ids nothing allocates —
      // and the resulting file looks perfectly ordinary. Keeping the two
      // on one variable means the schema cannot disagree with the cluster
      // about what kind of cluster it is.
      sharded: String(env.DB_VITESS_SHARDED ?? 'false').toLowerCase() === 'true',
    },

    postgres: {
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 5432,
      username: env.DB_USERNAME || '',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },
  },

  migrations: 'migrations',
  migrationLocks: 'migration_locks',

  /**
   * Query Logging Configuration
   *
   * This section configures the database query monitoring system.
   */
  queryLogging: {
    /**
     * Enable query logging to database
     */
    enabled: env.DB_QUERY_LOGGING_ENABLED ?? true,

    /**
     * The threshold in milliseconds to mark a query as slow
     */
    slowThreshold: env.DB_QUERY_LOGGING_SLOW_THRESHOLD || 100,

    /**
     * How many days to keep query logs
     */
    retention: env.DB_QUERY_LOGGING_RETENTION_DAYS || 7,

    /**
     * How often to run the pruning job in hours
     */
    pruneFrequency: env.DB_QUERY_LOGGING_PRUNE_FREQUENCY || 24,

    /**
     * Patterns to exclude from logging
     */
    excludedQueries: [
      // Don't log the query_logs table itself to avoid recursion
      'query_logs',
    ],

    /**
     * Query analysis configuration
     */
    analysis: {
      /**
       * Enable detailed query analysis
       */
      enabled: env.DB_QUERY_LOGGING_ANALYSIS_ENABLED ?? true,

      /**
       * Analyze all queries, not just slow ones
       */
      analyzeAll: env.DB_QUERY_LOGGING_ANALYZE_ALL ?? false,

      /**
       * Collect EXPLAIN plans for SELECT queries
       */
      explainPlan: env.DB_QUERY_LOGGING_EXPLAIN_PLAN ?? true,

      /**
       * Generate optimization suggestions
       */
      suggestions: env.DB_QUERY_LOGGING_SUGGESTIONS ?? true,
    },
  },
} satisfies DatabaseConfig
