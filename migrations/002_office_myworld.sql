-- Migration: Office and MyWorld Features
-- Created: 2026-04-09

CREATE TABLE IF NOT EXISTS `agents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Agent ID',
  `name` VARCHAR(128) NOT NULL COMMENT 'Agent name',
  `type` VARCHAR(64) NOT NULL COMMENT 'Agent type',
  `config` JSON DEFAULT NULL COMMENT 'Agent configuration',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT 'Status: 1=active, 0=inactive',
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT 'Creator user ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation time',
  PRIMARY KEY (`id`),
  KEY `idx_agents_type` (`type`),
  KEY `idx_agents_status` (`status`),
  KEY `idx_agents_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI agents table';

CREATE TABLE IF NOT EXISTS `agent_templates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Template ID',
  `name` VARCHAR(128) NOT NULL COMMENT 'Template name',
  `description` TEXT DEFAULT NULL COMMENT 'Template description',
  `config_schema` JSON DEFAULT NULL COMMENT 'Configuration schema JSON',
  `icon` VARCHAR(512) DEFAULT NULL COMMENT 'Template icon URL or emoji',
  PRIMARY KEY (`id`),
  KEY `idx_agent_templates_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI agent templates table';

CREATE TABLE IF NOT EXISTS `companies` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Company ID',
  `name` VARCHAR(256) NOT NULL COMMENT 'Company name',
  `description` TEXT DEFAULT NULL COMMENT 'Company description',
  `logo` VARCHAR(512) DEFAULT NULL COMMENT 'Company logo URL',
  `settings` JSON DEFAULT NULL COMMENT 'Company settings',
  `owner_id` BIGINT UNSIGNED NOT NULL COMMENT 'Owner user ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation time',
  PRIMARY KEY (`id`),
  KEY `idx_companies_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Companies table';

CREATE TABLE IF NOT EXISTS `company_members` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Membership ID',
  `company_id` BIGINT UNSIGNED NOT NULL COMMENT 'Company ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
  `role` VARCHAR(32) NOT NULL COMMENT 'Member role: owner/admin/member',
  `permissions` JSON DEFAULT NULL COMMENT 'Member permissions',
  `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Join time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_company_members` (`company_id`, `user_id`),
  KEY `idx_company_members_user_id` (`user_id`),
  CONSTRAINT `fk_company_members_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Company members table';
