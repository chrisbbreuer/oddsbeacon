ALTER TABLE `shipping_rates` ADD CONSTRAINT `shipping_rates_shipping_method_id_fk` FOREIGN KEY (`shipping_method_id`) REFERENCES `shipping_methods`(`id`);
ALTER TABLE `shipping_rates` ADD CONSTRAINT `shipping_rates_shipping_zone_id_fk` FOREIGN KEY (`shipping_zone_id`) REFERENCES `shipping_zones`(`id`);
