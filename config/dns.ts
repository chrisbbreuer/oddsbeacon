import type { DnsConfig } from '@stacksjs/types'

/**
 * **DNS Options**
 *
 * Deliberately empty.
 *
 * `buddy deploy` reconciles DNS twice: once from this file, and once from the
 * domains the sites in `config/cloud.ts` declare. The second pass is the one
 * that matters here — it points `predict.stacksjs.com` at whatever address the
 * box actually has, which is the only value that can be right.
 *
 * The scaffolded version of this file declared `A @ → 10.0.0.1` plus a `www`
 * alias. Records here are not scoped to our subdomain, so left in place those
 * get written to the live `stacksjs.com` zone — an apex A record aimed at
 * RFC1918 space, on a domain this project is a tenant of and does not own.
 *
 * Add records here only for names this project genuinely owns.
 */
export default {
  a: [],
  aaaa: [],
  cname: [],
  mx: [],
  txt: [],

  // Owned by the `stacks` project; stacksjs.com is served by Route53.
  nameservers: [],
} satisfies DnsConfig
