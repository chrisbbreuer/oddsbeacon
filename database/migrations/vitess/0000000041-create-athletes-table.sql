CREATE TABLE IF NOT EXISTS `athletes` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(160) not null,
  `search_key` varchar(180) not null,
  `given_name` varchar(100) default '',
  `family_name` varchar(100) default '',
  `date_of_birth` varchar(20) default '',
  `place_of_birth` varchar(160) default '',
  `nationality` varchar(100) default '',
  `second_nationality` varchar(100) default '',
  `position` varchar(100) default '',
  `secondary_positions` text default ('[]'),
  `height_cm` integer default 0,
  `preferred_foot` varchar(20) default '',
  `shirt_number` integer default 0,
  `joined_on` varchar(20) default '',
  `contract_expires_on` varchar(20) default '',
  `agent_name` varchar(160) default '',
  `outfitter` varchar(120) default '',
  `status` varchar(255) default 'active',
  `image_url` text default (''),
  `last_seen_at` varchar(40) default '',
  `sport_id` bigint REFERENCES `sports`(`id`),
  `sports_team_id` bigint REFERENCES `sports_teams`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `athletes_sport_search_key` ON `athletes` (`sport_id`, `search_key`);
CREATE INDEX `athletes_current_team` ON `athletes` (`sports_team_id`);
