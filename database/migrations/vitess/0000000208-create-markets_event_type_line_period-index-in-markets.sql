CREATE UNIQUE INDEX `markets_event_type_line_period` ON `markets` (`market_event_id`, `market_type`, `line_key`, `period`, `player_name`);
