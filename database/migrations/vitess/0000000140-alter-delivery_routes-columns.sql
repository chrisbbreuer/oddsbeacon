ALTER TABLE `delivery_routes` ADD CONSTRAINT `delivery_routes_driver_id_fk` FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`);
