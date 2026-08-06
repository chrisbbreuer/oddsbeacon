ALTER TABLE `waitlist_products` ADD CONSTRAINT `waitlist_products_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`);
ALTER TABLE `waitlist_products` ADD CONSTRAINT `waitlist_products_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`);
