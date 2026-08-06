ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`);
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`);
