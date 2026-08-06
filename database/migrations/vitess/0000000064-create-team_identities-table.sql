CREATE TABLE IF NOT EXISTS `team_identities` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `external_id` varchar(120) not null,
  `canonical_url` text default (''),
  `external_name` varchar(160) default '',
  `last_seen_at` varchar(40) default '',
  `sports_team_id` bigint REFERENCES `sports_teams`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `team_identities_provider_external` ON `team_identities` (`provider`, `external_id`);
CREATE INDEX `team_identities_team` ON `team_identities` (`sports_team_id`);
