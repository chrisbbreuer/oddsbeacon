import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Durable work item and retry checkpoint for slow immutable-history ingestion. */
export default defineModel({
  name: 'BackfillTask', table: 'backfill_tasks', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'backfill_tasks_natural', columns: ['provider', 'kind', 'external_id'], unique: true },
    { name: 'backfill_tasks_claim', columns: ['status', 'available_at', 'priority'] },
  ],
  attributes: {
    provider: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'transfermarkt' },
    kind: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'athlete' },
    externalId: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(160) }, factory: faker => faker.string.alphanumeric(12) },
    url: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(1000) }, factory: () => '' },
    status: { type: 'string', fillable: true, default: 'pending', validation: { rule: schema.enum(['pending', 'running', 'completed', 'failed', 'exhausted']) }, factory: () => 'pending' },
    priority: { type: 'integer', fillable: true, default: 100, validation: { rule: schema.number().min(0) }, factory: () => 100 },
    attempts: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    availableAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
    lockedAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
    lockToken: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(64) }, factory: () => '' },
    completedAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
    lastError: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(2000) }, factory: () => '' },
    documentHash: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(64) }, factory: () => '' },
    payload: { type: 'string', fillable: true, default: '{}', validation: { rule: schema.string().max(16000) }, factory: () => '{}' },
  },
} as const)
