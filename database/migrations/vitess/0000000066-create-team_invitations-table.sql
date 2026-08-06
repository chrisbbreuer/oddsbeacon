CREATE TABLE IF NOT EXISTS `team_invitations` (
  `id` bigint PRIMARY KEY auto_increment,
  `team_id` integer not null REFERENCES `teams`(`id`),
  `email` varchar(320) not null,
  `role` ENUM('admin', 'member', 'viewer') not null default 'member',
  `token_hash` varchar(64) not null,
  `invited_by_user_id` integer,
  `accepted_by_user_id` integer,
  `status` ENUM('pending', 'accepted', 'revoked', 'expired') not null default 'pending',
  `delivery_status` ENUM('pending', 'sent', 'failed') not null default 'pending',
  `delivery_error` text,
  `expires_at` datetime not null,
  `delivered_at` datetime,
  `accepted_at` datetime,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `team_invitations_token_hash_unique` ON `team_invitations` (`token_hash`);
CREATE INDEX `team_invitations_team_email_status_index` ON `team_invitations` (`team_id`, `email`, `status`);
CREATE UNIQUE INDEX `team_invitations_uuid_unique` ON `team_invitations` (`uuid`);
