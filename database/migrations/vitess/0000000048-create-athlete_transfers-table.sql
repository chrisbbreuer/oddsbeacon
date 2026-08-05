CREATE TABLE IF NOT EXISTS `athlete_transfers` (
  `id` bigint PRIMARY KEY auto_increment,
  `from_sports_team_id` bigint default 0,
  `to_sports_team_id` bigint default 0,
  `from_team_name` varchar(160) default '',
  `to_team_name` varchar(160) default '',
  `kind` varchar(40) default 'transfer',
  `season` varchar(20) default '',
  `transferred_on` varchar(20) default '',
  `fee_eur` bigint default 0,
  `market_value_eur` bigint default 0,
  `provider` varchar(40) default 'transfermarkt',
  `external_id` varchar(200) not null,
  `athlete_id` bigint REFERENCES `athletes`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `athlete_transfers_natural` ON `athlete_transfers` (`athlete_id`, `provider`, `external_id`);
CREATE INDEX `athlete_transfers_date` ON `athlete_transfers` (`athlete_id`, `transferred_on`);
