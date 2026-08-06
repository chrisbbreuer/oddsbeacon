ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`);
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`);
