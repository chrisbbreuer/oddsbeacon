CREATE TABLE IF NOT EXISTS `team_standings` (
  `id` bigint PRIMARY KEY auto_increment,
  `wins` decimal(10,2) default 0,
  `losses` decimal(10,2) default 0,
  `ties` decimal(10,2) default 0,
  `games_played` decimal(10,2) default 0,
  `win_percent` decimal(10,2) default 0,
  `points_for` decimal(10,2) default 0,
  `points_against` decimal(10,2) default 0,
  `point_differential` decimal(10,2) default 0,
  `playoff_seed` decimal(10,2) default 0,
  `group_name` varchar(80) default '',
  `source` varchar(40) default 'espn',
  `captured_at` varchar(40) not null,
  `sports_team_id` bigint REFERENCES `sports_teams`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `team_standings_team_captured` ON `team_standings` (`sports_team_id`, `captured_at`);
