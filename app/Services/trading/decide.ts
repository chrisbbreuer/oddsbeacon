import type { Candidate } from './evidence'
import { anthropic } from '@stacksjs/ai'
import { log } from '@stacksjs/logging'

/**
 * The judgement layer.
 *
 * The quantitative work already happened in `evidence.ts`. What is left
 * is the part a model is actually better at than a formula: reading the
 * question, noticing that the flow behind a side is one account's
 * position rather than a consensus, and saying so in a sentence a person
 * can check.
 *
 * The model is constrained, not trusted:
 *
 *   - it only sees candidates our data produced, and can only accept or
 *     decline them — it cannot name a market or a side of its own
 *   - it may lower confidence but never raise it above what the evidence
 *     supports, so a persuasive paragraph cannot manufacture conviction
 *   - if it is unavailable, malformed, or slow, the deterministic scores
 *     stand on their own and the decision is recorded as `rules`
 *
 * That last property matters more than it looks: it means the AI is an
 * additional filter on top of the data, never a dependency the trading
 * loop needs in order to be correct.
 */

export interface Judgement {
  predictionMarketId: number
  accept: boolean
  /** Never above the candidate's own confidence. */
  confidence: number
  rationale: string
  /** Model id, or 'rules' when the deterministic path decided. */
  decidedBy: string
}

interface ModelVerdict {
  marketId: number
  accept: boolean
  confidence: number
  rationale: string
}

const MODEL = 'claude-sonnet-4-5-20250929'
/** Past this the trading pass is better off with the rules answer. */
const TIMEOUT_MS = 45_000

/**
 * Judge a candidate set.
 *
 * Returns one judgement per candidate, in the same order. Callers do not
 * need to know whether the AI ran — the shape is identical either way.
 */
export async function judgeCandidates(candidates: Candidate[]): Promise<Judgement[]> {
  if (candidates.length === 0)
    return []

  const fallback = candidates.map(rulesJudgement)
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    log.debug('[trading] no ANTHROPIC_API_KEY; deciding on the evidence scores alone')
    return fallback
  }

  try {
    const verdicts = await Promise.race([
      askModel(candidates, apiKey),
      new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ])

    if (!verdicts)
      throw new Error(`no response within ${TIMEOUT_MS}ms`)

    const byMarket = new Map(verdicts.map(v => [v.marketId, v]))

    return candidates.map((candidate) => {
      const verdict = byMarket.get(candidate.predictionMarketId)

      // A candidate the model did not rule on falls back rather than
      // being silently accepted: an omission is not an endorsement.
      if (!verdict)
        return rulesJudgement(candidate)

      return {
        predictionMarketId: candidate.predictionMarketId,
        accept: verdict.accept,
        // The ceiling. A model that argues itself into more conviction
        // than the data carries is exactly what this guards against.
        confidence: Math.min(candidate.confidence, clamp01(verdict.confidence)),
        rationale: verdict.rationale.slice(0, 1800),
        decidedBy: MODEL,
      }
    })
  }
  catch (error) {
    // A failed judgement is not a failed trading pass. The evidence
    // scores are a complete decision procedure on their own.
    log.warn(`[trading] AI judgement unavailable (${error instanceof Error ? error.message : String(error)}); using the evidence scores`)
    return fallback
  }
}

/**
 * The deterministic path: accept what the evidence already justifies.
 * Also the fallback, which is why it states its own reasoning in the
 * same shape rather than leaving `rationale` empty.
 */
function rulesJudgement(candidate: Candidate): Judgement {
  const top = [...candidate.evidence]
    .filter(item => item.contribution !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .map(item => item.summary)

  return {
    predictionMarketId: candidate.predictionMarketId,
    accept: candidate.edge > 0,
    confidence: candidate.confidence,
    rationale: top.length > 0
      ? `Fair value ${(candidate.fairValue * 100).toFixed(1)}% vs ${(candidate.marketPrice * 100).toFixed(1)}% quoted, from: ${top.join('; ')}.`
      : `Fair value ${(candidate.fairValue * 100).toFixed(1)}% vs ${(candidate.marketPrice * 100).toFixed(1)}% quoted.`,
    decidedBy: 'rules',
  }
}

async function askModel(candidates: Candidate[], apiKey: string): Promise<ModelVerdict[]> {
  anthropic.configure({
    apiKey,
    model: MODEL,
    maxTokens: 4096,
  })

  const result = await anthropic.chat([
    { role: 'user', content: buildPrompt(candidates) },
  ])

  const text = typeof result === 'string' ? result : String((result as { content?: string })?.content ?? '')

  return parseVerdicts(text, candidates)
}

/**
 * The prompt states the constraint explicitly rather than relying on the
 * parser to enforce it alone. A model told it may only decline is much
 * less likely to produce output the parser has to throw away.
 */
function buildPrompt(candidates: Candidate[]): string {
  const blocks = candidates.map(c => [
    `## market_id: ${c.predictionMarketId}`,
    `venue: ${c.venue}`,
    `question: ${c.question}`,
    `proposed side: ${c.side}`,
    `venue price: ${(c.marketPrice * 100).toFixed(1)}%`,
    `our fair value: ${(c.fairValue * 100).toFixed(1)}%`,
    `edge: ${(c.edge * 100).toFixed(1)} points`,
    `evidence confidence: ${c.confidence.toFixed(2)}`,
    `liquidity: $${c.liquidity.toFixed(0)}`,
    'evidence:',
    ...c.evidence.map(e => `  - [${e.kind}] ${e.summary} (moved fair value ${(e.contribution * 100).toFixed(2)} points, n=${e.sampleSize})`),
  ].join('\n')).join('\n\n')

  return [
    'You are reviewing prediction-market trade candidates. Each was produced by a quantitative model from our own ingested trade tape. Your job is to catch the ones the numbers get wrong.',
    '',
    'Rules you must follow:',
    '- You may only ACCEPT or DECLINE the candidates below. Never propose a different market, a different side, or a different price.',
    '- Your confidence may be LOWER than the evidence confidence, never higher. If you disagree with the evidence, decline instead of arguing for more conviction.',
    '- Decline when the evidence is thin (small n), when the signals contradict each other, when the flow looks like one account rather than a consensus, or when the question resolves on something the trade tape cannot see.',
    '- Judge every candidate. Omitting one is not the same as declining it.',
    '',
    'Respond with JSON only — an array, no prose, no code fence:',
    '[{"marketId": 123, "accept": true, "confidence": 0.71, "rationale": "one or two sentences"}]',
    '',
    '# Candidates',
    '',
    blocks,
  ].join('\n')
}

/**
 * Pull the verdict array out of the reply.
 *
 * Models wrap JSON in prose or a fence often enough that finding the
 * outermost array is worth doing; anything referencing a market we did
 * not ask about is dropped, since a hallucinated id is the one failure
 * this layer must not pass through.
 */
function parseVerdicts(text: string, candidates: Candidate[]): ModelVerdict[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start)
    throw new Error('no JSON array in the response')

  const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed))
    throw new Error('response was not an array')

  const known = new Set(candidates.map(c => c.predictionMarketId))
  const verdicts: ModelVerdict[] = []

  for (const row of parsed) {
    if (typeof row !== 'object' || row === null)
      continue

    const record = row as Record<string, unknown>
    const marketId = Number(record.marketId)

    if (!known.has(marketId))
      continue

    verdicts.push({
      marketId,
      accept: record.accept === true,
      confidence: clamp01(Number(record.confidence)),
      rationale: typeof record.rationale === 'string' ? record.rationale : '',
    })
  }

  if (verdicts.length === 0)
    throw new Error('no verdicts referenced a known candidate')

  return verdicts
}

function clamp01(value: number): number {
  if (!Number.isFinite(value))
    return 0
  return Math.min(1, Math.max(0, value))
}
