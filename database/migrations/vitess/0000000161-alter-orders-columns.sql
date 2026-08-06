ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_coupon_id_fk` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`);
