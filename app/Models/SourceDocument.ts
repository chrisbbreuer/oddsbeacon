import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Content-addressed raw HTML retained so parser changes never require a refetch. */
export default defineModel({
  name: 'SourceDocument', table: 'source_documents', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'source_documents_version', columns: ['provider', 'url_hash', 'content_hash'], unique: true },
    { name: 'source_documents_url_fetched', columns: ['url_hash', 'fetched_at'] },
  ],
  attributes: {
    provider: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'transfermarkt' },
    kind: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'profile' },
    externalId: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    url: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(1000) }, factory: () => '' },
    urlHash: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().length(64) }, factory: () => '' },
    contentHash: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().length(64) }, factory: () => '' },
    storagePath: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(500) }, factory: () => '' },
    httpStatus: { type: 'integer', fillable: true, default: 200, validation: { rule: schema.number().min(0).max(599) }, factory: () => 200 },
    contentType: { type: 'string', fillable: true, default: 'text/html', validation: { rule: schema.string().max(160) }, factory: () => 'text/html' },
    etag: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(500) }, factory: () => '' },
    lastModified: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    byteLength: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    fetchedAt: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => new Date().toISOString() },
    parsedAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
    parserVersion: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
  },
} as const)
