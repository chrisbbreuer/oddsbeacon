CREATE TABLE IF NOT EXISTS `bookmakers` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `slug` varchar(100) not null,
  `kind` varchar(255) not null default 'sportsbook',
  `accent` varchar(40) default 'slate',
  `short` varchar(8) default '',
  `provider_key` varchar(80) default '',
  `region` varchar(10) default 'us',
  `sharp` tinyint(1) default 0,
  `consensus_weight` decimal(10,2) default 1,
  `active` tinyint(1) default 1,
  `url` varchar(200) default '',
  `last_seen_at` varchar(40) default '',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `bookmakers_slug` ON `bookmakers` (`slug`);
