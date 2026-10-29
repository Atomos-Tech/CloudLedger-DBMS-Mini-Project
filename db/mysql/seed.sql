-- CloudLedger seed data
-- Run after schema.sql and objects.sql
-- All employee passwords below are the bcrypt hash of: "Password123!"
-- (generated with bcrypt, cost factor 10 — replace with your own hashes for real use)

USE cloudledger;

-- ============================================================
-- Regions & Data Centers
-- ============================================================

INSERT INTO Regions (region_name) VALUES
  ('us-east-1'),
  ('us-west-2'),
  ('eu-central-1');

INSERT INTO Data_Centers (region_id, facility_name, operational_status) VALUES
  (1, 'Ashburn DC1', 'Active'),
  (1, 'Ashburn DC2', 'Active'),
  (2, 'Oregon DC1', 'Active'),
  (3, 'Frankfurt DC1', 'Maintenance');

-- ============================================================
-- Clients
-- ============================================================

INSERT INTO Clients (company_name, billing_address, account_status) VALUES
  ('Initech LLC',         '123 Office Park, Austin, TX',        'Active'),    -- 1
  ('Globex Corporation',  '1 Globex Plaza, New York, NY',       'Active'),    -- 2
  ('Umbrella Analytics',  '400 Raccoon City Ave, Raleigh, NC',  'Suspended'), -- 3
  ('Hooli Cloud',         '900 Silicon Way, Palo Alto, CA',     'Active'),    -- 4
  ('Acme Robotics',       '55 Foundry Row, Detroit, MI',        'Active'),    -- 5
  ('Stark Cloud Systems', '10880 Malibu Point, Malibu, CA',     'Active'),    -- 6
  ('Wayne Compute',       '1007 Mountain Dr, Gotham, NJ',       'Active'),    -- 7
  ('Wonka Data Labs',     '1 Candy Factory Ln, Chicago, IL',    'Active');    -- 8

-- ============================================================
-- Roles & Employees
-- ============================================================

INSERT INTO Roles (role_name) VALUES
  ('Admin'),
  ('DevOps'),
  ('Billing');

-- password_hash values are bcrypt('Password123!', 10)
INSERT INTO Employees (first_name, last_name, email, password_hash) VALUES
  ('Ada',    'Ng',       'admin@cloudledger.dev',   '$2b$10$QNMEzZVL9NcOzoji1B.eiueGluRKv1hjFD8xGMIaOHRfqFlCicada'),
  ('Bilal',  'Rahman',   'bilal@cloudledger.dev',   '$2b$10$QNMEzZVL9NcOzoji1B.eiueGluRKv1hjFD8xGMIaOHRfqFlCicada'),
  ('Carmen', 'Diaz',     'carmen@cloudledger.dev',  '$2b$10$QNMEzZVL9NcOzoji1B.eiueGluRKv1hjFD8xGMIaOHRfqFlCicada'),
  ('Devon',  'Okafor',   'devon@cloudledger.dev',   '$2b$10$QNMEzZVL9NcOzoji1B.eiueGluRKv1hjFD8xGMIaOHRfqFlCicada');

-- Ada (employee_id=1) is a global Admin -> mapped to every client
INSERT INTO Client_Access_Mapping (client_id, employee_id, role_id) VALUES
  (1, 1, 1), (2, 1, 1), (3, 1, 1), (4, 1, 1), (5, 1, 1), (6, 1, 1), (7, 1, 1), (8, 1, 1),
  -- Bilal: DevOps scoped to Initech
  (1, 2, 2),
  -- Carmen: Billing scoped to Globex
  (2, 3, 3),
  -- Devon: DevOps scoped to Hooli Cloud
  (4, 4, 2);

-- ============================================================
-- Subscription Tiers
-- ============================================================

INSERT INTO Subscription_Tiers (tier_name, cpu_cores, ram_gb, hourly_cost) VALUES
  ('Micro',      1,  1,  0.0120),
  ('Standard',   2,  4,  0.0480),
  ('Performance',4,  16, 0.1920),
  ('Enterprise', 8,  32, 0.3840);

-- ============================================================
-- Server Instances
-- (Umbrella Analytics/client 3 is Suspended — trg_prevent_deploy_suspended_client
--  blocks any instance from being provisioned for it, so it intentionally has none.)
-- ============================================================

INSERT INTO Server_Instances (client_id, tier_id, dc_id, current_status, created_at) VALUES
  (1, 2, 1, 'Running',    '2026-08-01 09:00:00'), -- 1
  (1, 1, 1, 'Stopped',    '2026-08-03 11:00:00'), -- 2
  (2, 3, 3, 'Running',    '2026-08-05 08:30:00'), -- 3
  (2, 2, 2, 'Terminated', '2026-07-20 10:00:00'), -- 4
  (4, 4, 2, 'Running',    '2026-08-10 14:00:00'), -- 5
  (1, 3, 2, 'Running',    '2026-06-15 09:00:00'), -- 6
  (1, 2, 3, 'Terminated', '2026-06-01 08:00:00'), -- 7
  (2, 1, 1, 'Running',    '2026-07-01 07:00:00'), -- 8
  (2, 4, 3, 'Stopped',    '2026-08-12 09:00:00'), -- 9
  (4, 2, 1, 'Terminated', '2026-06-05 06:00:00'), -- 10
  (4, 1, 4, 'Running',    '2026-08-15 10:00:00'), -- 11
  (5, 2, 1, 'Running',    '2026-08-02 09:00:00'), -- 12
  (5, 1, 2, 'Stopped',    '2026-07-10 09:00:00'), -- 13
  (6, 3, 3, 'Running',    '2026-08-06 11:00:00'), -- 14
  (6, 4, 1, 'Running',    '2026-06-20 10:00:00'), -- 15
  (7, 2, 2, 'Terminated', '2026-07-05 09:00:00'), -- 16
  (7, 1, 1, 'Running',    '2026-08-18 12:00:00'), -- 17
  (8, 3, 4, 'Running',    '2026-08-08 09:00:00'), -- 18
  (8, 2, 3, 'Stopped',    '2026-06-25 09:00:00'); -- 19

-- ============================================================
-- Usage Logs
-- ============================================================

INSERT INTO Usage_Logs (instance_id, start_time, end_time) VALUES
  (1,  '2026-08-01 09:00:00', NULL),
  (2,  '2026-08-03 11:00:00', '2026-08-03 18:00:00'),
  (3,  '2026-08-05 08:30:00', NULL),
  (4,  '2026-07-20 10:00:00', '2026-07-22 10:00:00'),
  (5,  '2026-08-10 14:00:00', NULL),
  (6,  '2026-06-15 09:00:00', NULL),
  (7,  '2026-06-01 08:00:00', '2026-06-10 08:00:00'),
  (8,  '2026-07-01 07:00:00', NULL),
  (9,  '2026-08-12 09:00:00', '2026-08-14 09:00:00'),
  (10, '2026-06-05 06:00:00', '2026-06-20 06:00:00'),
  (11, '2026-08-15 10:00:00', NULL),
  (12, '2026-08-02 09:00:00', NULL),
  (13, '2026-07-10 09:00:00', '2026-07-15 09:00:00'),
  (14, '2026-08-06 11:00:00', NULL),
  (15, '2026-06-20 10:00:00', NULL),
  (16, '2026-07-05 09:00:00', '2026-07-25 09:00:00'),
  (17, '2026-08-18 12:00:00', NULL),
  (18, '2026-08-08 09:00:00', NULL),
  (19, '2026-06-25 09:00:00', '2026-06-28 09:00:00');

-- ============================================================
-- Invoices — generated transactionally via the stored procedure
-- for every Active client across the last three billing months.
-- ============================================================

CALL sp_generate_monthly_invoice(1, '2026-06-01');
CALL sp_generate_monthly_invoice(1, '2026-07-01');
CALL sp_generate_monthly_invoice(1, '2026-08-01');
CALL sp_generate_monthly_invoice(2, '2026-06-01');
CALL sp_generate_monthly_invoice(2, '2026-07-01');
CALL sp_generate_monthly_invoice(2, '2026-08-01');
CALL sp_generate_monthly_invoice(4, '2026-06-01');
CALL sp_generate_monthly_invoice(4, '2026-07-01');
CALL sp_generate_monthly_invoice(4, '2026-08-01');
CALL sp_generate_monthly_invoice(5, '2026-06-01');
CALL sp_generate_monthly_invoice(5, '2026-07-01');
CALL sp_generate_monthly_invoice(5, '2026-08-01');
CALL sp_generate_monthly_invoice(6, '2026-06-01');
CALL sp_generate_monthly_invoice(6, '2026-07-01');
CALL sp_generate_monthly_invoice(6, '2026-08-01');
CALL sp_generate_monthly_invoice(7, '2026-06-01');
CALL sp_generate_monthly_invoice(7, '2026-07-01');
CALL sp_generate_monthly_invoice(7, '2026-08-01');
CALL sp_generate_monthly_invoice(8, '2026-06-01');
CALL sp_generate_monthly_invoice(8, '2026-07-01');
CALL sp_generate_monthly_invoice(8, '2026-08-01');

-- The procedure always inserts as 'Pending'. Settle older months so the
-- billing page shows a realistic mix of Paid / Pending / Overdue.
UPDATE Invoices SET payment_status = 'Paid'
  WHERE billing_month = '2026-06-01' AND total_amount > 0;

UPDATE Invoices SET payment_status = 'Overdue'
  WHERE billing_month = '2026-07-01' AND client_id IN (2, 7) AND total_amount > 0;

UPDATE Invoices SET payment_status = 'Paid'
  WHERE billing_month = '2026-07-01' AND client_id NOT IN (2, 7) AND total_amount > 0;

-- August (current month) is left 'Pending' — the billing cycle is still open.
