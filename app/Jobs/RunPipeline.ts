import RunPipeline from '../Actions/Ingest/RunPipeline'

/**
 * The scheduled data loop.
 *
 * A thin wrapper over the action so the same sequence is reachable from
 * the scheduler, the CLI, and a test without any of them duplicating the
 * ordering that makes it correct.
 */
export default {
  handle: async () => RunPipeline.handle(),
}
