ALTER TABLE `carts` ADD CONSTRAINT `carts_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`);
ALTER TABLE `carts` ADD CONSTRAINT `carts_coupon_id_fk` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`);
