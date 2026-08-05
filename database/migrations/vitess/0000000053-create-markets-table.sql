CREATE TABLE IF NOT EXISTS `markets` (
  `id` bigint PRIMARY KEY auto_increment,
  `market_type` varchar(40) not null default 'h2h',
  `label` varchar(80) default '',
  `line` decimal(10,2),
  `line_key` varchar(20) not null default '',
  `period` varchar(20) not null default 'full_game',
  `player_name` varchar(120) default '',
  `complete` tinyint(1) default 1,
  `status` varchar(255) not null default 'open',
  `position` decimal(10,2) default 0,
  `market_event_id` bigint REFERENCES `market_events`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `markets_event_type_line_period` ON `markets` (`market_event_id`, `market_type`, `line_key`, `period`);
CREATE INDEX `markets_type` ON `markets` (`market_type`);
