CREATE TABLE IF NOT EXISTS `ai_insights` (
  `id` bigint PRIMARY KEY auto_increment,
  `kind` varchar(40) not null default 'candidate_review',
  `selection_id` decimal(10,2) REFERENCES `selections`(`id`) ON DELETE CASCADE,
  `market_event_id` decimal(10,2) REFERENCES `market_events`(`id`) ON DELETE CASCADE,
  `feature_hash` varchar(80) not null default '',
  `stance` varchar(255) default 'pass',
  `stated_prob` decimal(10,2) default 0,
  `confidence` decimal(10,2) default 0,
  `summary` text default '',
  `rationale` varchar(255) default '',
  `caveats` text default '',
  `model` varchar(80) default '',
  `prompt_tokens` decimal(10,2) default 0,
  `completion_tokens` decimal(10,2) default 0,
  `cost_usd` decimal(10,2) default 0,
  `latency_ms` decimal(10,2) default 0,
  `outcome` decimal(10,2) not null default -1,
  `brier_score` decimal(10,2) default 0,
  `graded_at` varchar(40) default '',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `ai_insights_selection_created` ON `ai_insights` (`selection_id`, `created_at`);
CREATE INDEX `ai_insights_feature_hash` ON `ai_insights` (`feature_hash`);
CREATE INDEX `ai_insights_event` ON `ai_insights` (`market_event_id`);
