ALTER TABLE `bookmakers` ADD COLUMN `transport` varchar(255) default '';
ALTER TABLE `bookmakers` ADD COLUMN `last_success_at` varchar(40) default '';
ALTER TABLE `bookmakers` ADD COLUMN `failure_streak` decimal(10,2) default 0;
