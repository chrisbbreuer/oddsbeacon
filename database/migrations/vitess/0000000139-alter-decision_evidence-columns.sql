ALTER TABLE `decision_evidence` ADD CONSTRAINT `decision_evidence_trade_decision_id_fk` FOREIGN KEY (`trade_decision_id`) REFERENCES `trade_decisions`(`id`);
