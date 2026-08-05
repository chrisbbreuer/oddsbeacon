CREATE TABLE IF NOT EXISTS `athlete_team_memberships` (
  `id` bigint PRIMARY KEY auto_increment,
  `started_on` varchar(20) default '',
  `ended_on` varchar(20) default '',
  `squad_number` integer default 0,
  `role` varchar(40) default 'player',
  `competition` varchar(160) default '',
  `source` varchar(40) default 'transfermarkt',
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `sports_team_id` bigint REFERENCES `sports_teams`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_team_memberships_athlete_memberships_natural` ON `athlete_team_memberships` (`athlete_id`, `sports_team_id`, `started_on`);
CREATE INDEX `athlete_team_memberships_athlete_memberships_team_dates` ON `athlete_team_memberships` (`sports_team_id`, `started_on`, `ended_on`);
