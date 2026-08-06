ALTER TABLE `categorizable_models` ADD CONSTRAINT `categorizable_models_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`);
