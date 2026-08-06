CREATE TABLE IF NOT EXISTS `athlete_season_stats` (
  `id` bigint PRIMARY KEY auto_increment,
  `sports_team_id` bigint default 0,
  `season` varchar(20) not null,
  `competition` varchar(160) default '',
  `appearances` integer default 0,
  `starts` integer default 0,
  `minutes` integer default 0,
  `points` double precision default 0,
  `goals` integer default 0,
  `assists` integer default 0,
  `metrics` text default ('{}'),
  `provider` varchar(40) default 'transfermarkt',
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_season_stats_athlete_stats_natural` ON `athlete_season_stats` (`athlete_id`, `provider`, `season`, `competition`, `sports_team_id`);
CREATE INDEX `athlete_season_stats_athlete_stats_lookup` ON `athlete_season_stats` (`athlete_id`, `season`);
