CREATE TABLE IF NOT EXISTS `sports` (
  `id` bigint PRIMARY KEY auto_increment,
  `slug` varchar(40) not null,
  `title` varchar(80) not null,
  `grouping` varchar(60) not null,
  `espn_path` varchar(80) default '',
  `odds_api_key` varchar(80) default '',
  `active` tinyint(1) default 1,
  `position` decimal(10,2) default 0,
  `non_sporting` tinyint(1) default 0,
  `tier` decimal(10,2) default 0,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `sports_slug` ON `sports` (`slug`);
