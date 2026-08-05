CREATE TABLE IF NOT EXISTS `team_injuries` (
  `id` bigint PRIMARY KEY auto_increment,
  `athlete_name` varchar(120) not null,
  `status` varchar(60) default '',
  `injury_type` varchar(80) default '',
  `severity` decimal(10,2) default 0,
  `source` varchar(40) default 'espn',
  `captured_at` varchar(40) not null,
  `sports_team_id` bigint REFERENCES `sports_teams`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `team_injuries_team_captured` ON `team_injuries` (`sports_team_id`, `captured_at`);
