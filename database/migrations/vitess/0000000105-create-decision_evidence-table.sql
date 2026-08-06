CREATE TABLE IF NOT EXISTS `decision_evidence` (
  `id` bigint PRIMARY KEY auto_increment,
  `trade_decision_id` decimal(10,2) REFERENCES `trade_decisions`(`id`),
  `kind` varchar(40),
  `summary` varchar(400),
  `value` decimal(10,2),
  `contribution` decimal(10,2),
  `sample_size` decimal(10,2),
  `window_hours` decimal(10,2),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `decision_evidence_decision` ON `decision_evidence` (`trade_decision_id`);
