import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * TradingHalt — the global stop, and the record of who pulled it.
 *
 * A strategy can halt itself on its own limits, but that is per user and
 * only takes effect the next time that strategy runs. The case this
 * exists for is different: a venue returning nonsense prices, an
 * ingestion bug that has poisoned fair value, a deploy that needs to go
 * out with nothing in flight. In all of them the answer is "no orders
 * from anyone, now", and there was no way to say it.
 *
 * Append-only. Each halt and each resume is its own row, and the newest
 * row is the current state, so afterwards there is a record of when
 * trading stopped, who stopped it, and why — which is the first question
 * anyone asks about a gap in the order history.
 */
export default defineModel({
  name: 'TradingHalt',
  table: 'trading_halts',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    // True halts trading, false resumes it. Both are recorded, because
    // "when did it come back" matters as much as when it stopped.
    active: {
      type: 'boolean',
      fillable: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },
    reason: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(300) },
      factory: () => '',
    },
    // Who asked for it: an operator's name, or the system component that
    // tripped it. Free text on purpose — this is a note to whoever reads
    // it later, not a foreign key.
    actor: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(120) },
      factory: () => 'operator',
    },
  },
} as const)
