CREATE TABLE IF NOT EXISTS `sports_teams` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(120) not null,
  `search_key` varchar(120) not null,
  `short_name` varchar(60) default '',
  `abbreviation` varchar(8) default '',
  `aliases` text default '',
  `logo` text default '',
  `espn_id` varchar(40) default '',
  `record` varchar(40) default '',
  `sport_id` bigint REFERENCES `sports`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `sports_teams_sport_search_key` ON `sports_teams` (`sport_id`, `search_key`);
CREATE INDEX `sports_teams_espn_id` ON `sports_teams` (`espn_id`);
