CREATE TABLE IF NOT EXISTS `club_valuations` (
  `id` bigint PRIMARY KEY auto_increment,
  `squad_value_eur` decimal(10,2) default 0,
  `squad_size` decimal(10,2) default 0,
  `average_age_years` decimal(10,2) default 0,
  `league_tier` decimal(10,2) default 0,
  `competition` varchar(120) default '',
  `source` varchar(40) default 'transfermarkt',
  `external_id` varchar(80) default '',
  `captured_at` varchar(40) not null,
  `sports_team_id` bigint REFERENCES `sports_teams`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `club_valuations_team_captured` ON `club_valuations` (`sports_team_id`, `captured_at`);
