CREATE TABLE IF NOT EXISTS `fair_prices` (
  `id` bigint PRIMARY KEY auto_increment,
  `prob_consensus` decimal(10,2) not null default 0,
  `prob_sharp` decimal(10,2) default 0,
  `prob_multiplicative` decimal(10,2) default 0,
  `prob_power` decimal(10,2) default 0,
  `prob_shin` decimal(10,2) default 0,
  `method_spread` decimal(10,2) default 0,
  `fair_price` decimal(10,2) default 0,
  `best_price` decimal(10,2) default 0,
  `best_bookmaker_id` decimal(10,2) REFERENCES `bookmakers`(`id`) ON DELETE SET NULL,
  `edge_pct` decimal(10,2) default 0,
  `kelly_fraction` decimal(10,2) default 0,
  `overround_pct` decimal(10,2) default 0,
  `book_count` decimal(10,2) default 0,
  `sharp_book_count` decimal(10,2) default 0,
  `computed_at` varchar(40) not null,
  `selection_id` bigint REFERENCES `selections`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `fair_prices_selection` ON `fair_prices` (`selection_id`);
CREATE INDEX `fair_prices_edge` ON `fair_prices` (`edge_pct`);
