CREATE TABLE IF NOT EXISTS `athlete_market_values` (
  `id` bigint PRIMARY KEY auto_increment,
  `value_eur` bigint not null,
  `valued_on` varchar(20) not null,
  `team_name` varchar(160) default '',
  `provider` varchar(40) default 'transfermarkt',
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_market_values_athlete_values_natural` ON `athlete_market_values` (`athlete_id`, `provider`, `valued_on`);
CREATE INDEX `athlete_market_values_athlete_values_date` ON `athlete_market_values` (`athlete_id`, `valued_on`);
