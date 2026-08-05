CREATE TABLE IF NOT EXISTS `athlete_injuries` (
  `id` bigint PRIMARY KEY auto_increment,
  `injury_type` varchar(160) not null,
  `started_on` varchar(20) default '',
  `ended_on` varchar(20) default '',
  `days_missed` integer default 0,
  `games_missed` integer default 0,
  `status` varchar(40) default 'resolved',
  `provider` varchar(40) default 'transfermarkt',
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_injuries_natural` ON `athlete_injuries` (`athlete_id`, `provider`, `started_on`, `injury_type`);
CREATE INDEX `athlete_injuries_dates` ON `athlete_injuries` (`athlete_id`, `started_on`, `ended_on`);
