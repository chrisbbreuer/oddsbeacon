ALTER TABLE `odds` ADD COLUMN `link` varchar(300) default '';
ALTER TABLE `odds` ADD COLUMN `sid` varchar(80) default '';
ALTER TABLE `odds` ADD COLUMN `traded_volume` decimal(10,2) default 0;
