CREATE TABLE IF NOT EXISTS `athlete_career_records` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `category` varchar(60) not null,
  `external_id` varchar(64) not null,
  `title` varchar(240) default '',
  `season` varchar(20) default '',
  `competition` varchar(160) default '',
  `sports_team_id` bigint default 0,
  `team_name` varchar(160) default '',
  `occurred_on` varchar(20) default '',
  `ended_on` varchar(20) default '',
  `details` text default '{}',
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_career_records_natural` ON `athlete_career_records` (`athlete_id`, `provider`, `category`, `external_id`);
CREATE INDEX `athlete_career_records_timeline` ON `athlete_career_records` (`athlete_id`, `category`, `occurred_on`);
