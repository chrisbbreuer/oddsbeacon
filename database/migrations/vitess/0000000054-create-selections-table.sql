CREATE TABLE IF NOT EXISTS `selections` (
  `id` bigint PRIMARY KEY auto_increment,
  `label` varchar(120) not null,
  `side` varchar(20) not null,
  `point` decimal(10,2),
  `point_key` varchar(20) not null default '',
  `position` decimal(10,2) default 0,
  `sports_team_id` decimal(10,2) REFERENCES `sports_teams`(`id`) ON DELETE SET NULL,
  `outcome` decimal(10,2) not null default -1,
  `graded_at` varchar(40) default '',
  `market_id` bigint REFERENCES `markets`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `selections_market_side_point` ON `selections` (`market_id`, `side`, `point_key`);
CREATE INDEX `selections_team` ON `selections` (`sports_team_id`);
