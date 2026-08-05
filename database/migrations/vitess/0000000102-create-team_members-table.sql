CREATE TABLE IF NOT EXISTS `team_members` (
  `id` bigint PRIMARY KEY auto_increment,
  `team_id` integer not null REFERENCES `teams`(`id`),
  `user_id` integer not null REFERENCES `users`(`id`),
  `role` ENUM('owner', 'admin', 'member', 'viewer') not null default 'member',
  `status` ENUM('active', 'suspended') not null default 'active',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `team_members_team_user_unique` ON `team_members` (`team_id`, `user_id`);
CREATE INDEX `team_members_user_status_index` ON `team_members` (`user_id`, `status`);
CREATE UNIQUE INDEX `team_members_uuid_unique` ON `team_members` (`uuid`);
