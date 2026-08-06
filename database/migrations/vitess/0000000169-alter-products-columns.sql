ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`);
ALTER TABLE `products` ADD CONSTRAINT `products_manufacturer_id_fk` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`);
