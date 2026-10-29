-- CloudLedger relational core (MySQL 8)
-- Run this file to create the schema from scratch.

CREATE DATABASE IF NOT EXISTS cloudledger;
USE cloudledger;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Client_Access_Mapping;
DROP TABLE IF EXISTS Invoices;
DROP TABLE IF EXISTS Usage_Logs;
DROP TABLE IF EXISTS Server_Instances;
DROP TABLE IF EXISTS Subscription_Tiers;
DROP TABLE IF EXISTS Employees;
DROP TABLE IF EXISTS Roles;
DROP TABLE IF EXISTS Clients;
DROP TABLE IF EXISTS Data_Centers;
DROP TABLE IF EXISTS Regions;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Module 1: Infrastructure
-- ============================================================

CREATE TABLE Regions (
  region_id   INT AUTO_INCREMENT PRIMARY KEY,
  region_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE Data_Centers (
  dc_id               INT AUTO_INCREMENT PRIMARY KEY,
  region_id           INT NOT NULL,
  facility_name       VARCHAR(100) NOT NULL,
  operational_status  ENUM('Active','Maintenance','Offline') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_dc_region FOREIGN KEY (region_id) REFERENCES Regions(region_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Module 2: Clients & IAM
-- ============================================================

CREATE TABLE Clients (
  client_id       INT AUTO_INCREMENT PRIMARY KEY,
  company_name    VARCHAR(100) NOT NULL,
  billing_address VARCHAR(255),
  account_status  ENUM('Active','Suspended','Closed') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB;

CREATE TABLE Employees (
  employee_id   INT AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(50) NOT NULL,
  last_name     VARCHAR(50) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Roles (
  role_id   INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE Client_Access_Mapping (
  client_id   INT NOT NULL,
  employee_id INT NOT NULL,
  role_id     INT NOT NULL,
  PRIMARY KEY (client_id, employee_id),
  CONSTRAINT fk_cam_client   FOREIGN KEY (client_id)   REFERENCES Clients(client_id)     ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cam_employee FOREIGN KEY (employee_id) REFERENCES Employees(employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cam_role     FOREIGN KEY (role_id)     REFERENCES Roles(role_id)         ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Module 3: Compute Engine
-- ============================================================

CREATE TABLE Subscription_Tiers (
  tier_id     INT AUTO_INCREMENT PRIMARY KEY,
  tier_name   VARCHAR(50) NOT NULL UNIQUE,
  cpu_cores   INT NOT NULL CHECK (cpu_cores > 0),
  ram_gb      INT NOT NULL CHECK (ram_gb > 0),
  hourly_cost DECIMAL(8,4) NOT NULL CHECK (hourly_cost >= 0)
) ENGINE=InnoDB;

CREATE TABLE Server_Instances (
  instance_id    INT AUTO_INCREMENT PRIMARY KEY,
  client_id      INT NOT NULL,
  tier_id        INT NOT NULL,
  dc_id          INT NOT NULL,
  current_status ENUM('Running','Stopped','Terminated') NOT NULL DEFAULT 'Stopped',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_si_client FOREIGN KEY (client_id) REFERENCES Clients(client_id)             ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_si_tier   FOREIGN KEY (tier_id)   REFERENCES Subscription_Tiers(tier_id)    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_si_dc     FOREIGN KEY (dc_id)     REFERENCES Data_Centers(dc_id)            ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_si_client_status (client_id, current_status)
) ENGINE=InnoDB;

-- ============================================================
-- Module 4: Monetization
-- ============================================================

CREATE TABLE Usage_Logs (
  log_id      INT AUTO_INCREMENT PRIMARY KEY,
  instance_id INT NOT NULL,
  start_time  DATETIME NOT NULL,
  end_time    DATETIME NULL,
  CONSTRAINT fk_ul_instance FOREIGN KEY (instance_id) REFERENCES Server_Instances(instance_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_ul_time_order CHECK (end_time IS NULL OR end_time > start_time),
  INDEX idx_ul_instance (instance_id)
) ENGINE=InnoDB;

CREATE TABLE Invoices (
  invoice_id     INT AUTO_INCREMENT PRIMARY KEY,
  client_id      INT NOT NULL,
  billing_month  DATE NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status ENUM('Pending','Paid','Overdue') NOT NULL DEFAULT 'Pending',
  CONSTRAINT fk_inv_client FOREIGN KEY (client_id) REFERENCES Clients(client_id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_client_month (client_id, billing_month)
) ENGINE=InnoDB;
