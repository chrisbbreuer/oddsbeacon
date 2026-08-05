CREATE TABLE IF NOT EXISTS `categorizable_models` (
  `id` bigint PRIMARY KEY auto_increment,
  `category_id` bigint not null REFERENCES `categories`(`id`),
  `categorizable_id` bigint not null,
  `categorizable_type` varchar(255) not null default 'posts',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `categorizable_models_category_id_categorizable_id_categ_166kkzm` ON `categorizable_models` (`category_id`, `categorizable_id`, `categorizable_type`);
