-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS p2_database;

-- Use the database
USE p2_database;

CREATE TABLE `integrations` (
  `integration_id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `server_id` varchar(255),
  `integration_name` varchar(255),
  `discord_channel` varchar(255)
);

CREATE TABLE `services` (
  `services_id` int UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `integration_id` int UNSIGNED,
  `service_name` varchar(255),
  `service_type` varchar(255),
  `description` varchar(255),
  FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`integration_id`) ON DELETE CASCADE
);

CREATE TABLE `google_webhooks` (
  `webhook_id` int UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `integration_id` int UNSIGNED,
  `resource_id` varchar(255),
  `channel_id` varchar(255),
  `synctoken` varchar(255),
  FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`integration_id`) ON DELETE CASCADE
);

CREATE TABLE `notifications` (
  `notification_id` int UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `integration_id` int UNSIGNED,
  `name` varchar(255),
  FOREIGN key (`integration_id`) REFERENCES `integrations` (`integration_id`) ON DELETE CASCADE
);

CREATE TABLE `tokens` (
  `token_id` int UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `integration_id` int UNSIGNED,
  `name` varchar(255),
  `key` varchar(255),
  FOREIGN KEY (`integration_id`) REFERENCES `integrations` (`integration_id`) ON DELETE CASCADE
);

-- Create indexes to speed up queries based on what is most commonly searched for

-- Indexes for integrations table
CREATE INDEX idx_server_id ON integrations (server_id); -- For checking if a server exists or deleting a server.
CREATE INDEX idx_server_id_integration_name ON integrations (server_id, integration_name); -- For retrieving the integration_id of a specific integration.

-- Indexes for tokens table
CREATE INDEX idx_integration_id_name ON tokens (integration_id, `name`); -- For retrieving/updating a specific token.
CREATE INDEX idx_integration_id ON tokens (integration_id); -- For retrieving all tokens associated with a specific integration.

-- Indexes for services table
CREATE INDEX idx_integration_id_service_type_service_name ON services (integration_id, service_type, `service_name`); -- For retrieving a specific service.

-- Indexes for notifications table
CREATE INDEX idx_integration_id ON notifications (integration_id); -- For retrieving all notifications associated with a specific integration.
CREATE INDEX idx_integration_id_name ON notifications (integration_id, `name`); -- For adding and removing a specific notification.

-- Indexes for google_webhooks table
CREATE INDEX idx_integration_id ON google_webhooks (integration_id); -- For retrieving all webhooks associated with a specific integration.
CREATE INDEX idx_synctoken_integration_id ON google_webhooks (synctoken, integration_id); -- For editing a specific webhook.