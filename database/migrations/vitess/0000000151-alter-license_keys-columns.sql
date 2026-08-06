ALTER TABLE `license_keys` ADD CONSTRAINT `license_keys_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`);
ALTER TABLE `license_keys` ADD CONSTRAINT `license_keys_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`);
ALTER TABLE `license_keys` ADD CONSTRAINT `license_keys_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`);
