import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * TeamInjury — who is unavailable, and how unavailable.
 *
 * The single largest source of information a book has that a pure price
 * model does not. A starting quarterback ruled out moves a line several
 * points, and a system reading only prices sees that move as a mystery to
 * be de-vigged rather than a fact to be priced.
 *
 * Rows are per capture, like {@link TeamStanding}: a decision made while
 * a player was listed questionable has to stay scoreable against what was
 * known then, not against the eventual ruling.
 *
 * `severity` is our own 0..1 reading of the feed's status text, because
 * every league words availability differently ("Out", "60-Day-IL",
 * "Doubtful") and a numeric field is what a signal can actually use.
 */
export default defineModel({
  name: 'TeamInjury',
  table: 'team_injuries',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    { name: 'team_injuries_team_captured', columns: ['sports_team_id', 'captured_at'] },
  ],

  attributes: {
    athleteName: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(120) },
      factory: faker => faker.person.fullName(),
    },
    /** The feed's own wording, kept verbatim for auditing the mapping below. */
    status: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(60) },
      factory: () => 'Out',
    },
    /** Body part or reason, when the feed gives one. */
    injuryType: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(80) },
      factory: () => '',
    },
    /**
     * 0 = available, 1 = certainly out. Derived from `status`; see
     * `Services/fundamentals/severity.ts` for the mapping and why it is
     * deliberately coarse.
     */
    severity: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float().min(0).max(1) },
      factory: () => 1,
    },
    source: {
      type: 'string',
      fillable: true,
      default: 'espn',
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => 'espn',
    },
    capturedAt: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => new Date().toISOString(),
    },
  },

  belongsTo: ['SportsTeam'],
} as const)
