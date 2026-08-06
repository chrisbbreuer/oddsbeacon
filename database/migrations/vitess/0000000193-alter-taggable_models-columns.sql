ALTER TABLE `taggable_models` ADD CONSTRAINT `taggable_models_tag_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`);
