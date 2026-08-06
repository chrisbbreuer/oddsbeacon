CREATE TABLE IF NOT EXISTS `athlete_identities` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `external_id` varchar(120) not null,
  `canonical_url` varchar(500) not null,
  `external_name` varchar(160) default '',
  `aliases` text default ('[]'),
  `profile_facts` text default ('{}'),
  `last_seen_at` varchar(40) default '',
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_identities_provider_external` ON `athlete_identities` (`provider`, `external_id`);
CREATE INDEX `athlete_identities_athlete` ON `athlete_identities` (`athlete_id`);
