-- CloudLedger demo queries
-- Run against MySQL after schema.sql, objects.sql, and seed.sql have been applied.
USE cloudledger;

-- 1. JOIN: list every running instance with its client, tier, and data center.
SELECT
  si.instance_id,
  c.company_name,
  st.tier_name,
  dc.facility_name,
  r.region_name,
  si.current_status
FROM Server_Instances si
JOIN Clients c            ON c.client_id = si.client_id
JOIN Subscription_Tiers st ON st.tier_id = si.tier_id
JOIN Data_Centers dc       ON dc.dc_id = si.dc_id
JOIN Regions r             ON r.region_id = dc.region_id
WHERE si.current_status = 'Running';

-- 2. JOIN across the IAM junction: which employees can access which clients, in what role.
SELECT
  e.first_name, e.last_name, e.email,
  c.company_name,
  r.role_name
FROM Client_Access_Mapping cam
JOIN Employees e ON e.employee_id = cam.employee_id
JOIN Clients c    ON c.client_id = cam.client_id
JOIN Roles r      ON r.role_id = cam.role_id
ORDER BY c.company_name, r.role_name;

-- 3. GROUP BY: total number of instances per client, broken down by status.
SELECT
  c.company_name,
  si.current_status,
  COUNT(*) AS instance_count
FROM Server_Instances si
JOIN Clients c ON c.client_id = si.client_id
GROUP BY c.company_name, si.current_status
ORDER BY c.company_name;

-- 4. GROUP BY + HAVING: clients whose July 2026 invoice total exceeds $50.
SELECT
  c.company_name,
  SUM(i.total_amount) AS total_billed
FROM Invoices i
JOIN Clients c ON c.client_id = i.client_id
WHERE i.billing_month = '2026-07-01'
GROUP BY c.company_name
HAVING SUM(i.total_amount) > 50;

-- 5. Subquery (WHERE ... IN): clients that currently have at least one Running instance.
SELECT company_name, account_status
FROM Clients
WHERE client_id IN (
  SELECT DISTINCT client_id
  FROM Server_Instances
  WHERE current_status = 'Running'
);

-- 6. Correlated subquery: each instance next to the average hourly_cost of its own tier
--    (trivial here since cost is per-tier, but demonstrates the pattern for tier-relative pricing).
SELECT
  si.instance_id,
  st.tier_name,
  st.hourly_cost,
  (SELECT AVG(hourly_cost) FROM Subscription_Tiers) AS fleet_avg_hourly_cost
FROM Server_Instances si
JOIN Subscription_Tiers st ON st.tier_id = si.tier_id;

-- 7. Query the view: current month's running total per client, most expensive first.
SELECT * FROM vw_client_current_bill
ORDER BY running_total DESC;

-- 8. Call the stored procedure: (re)generate August 2026's invoice for Initech (client_id = 1).
CALL sp_generate_monthly_invoice(1, '2026-08-01');

-- 9. Aggregate with LEFT JOIN: total usage hours logged per instance, including instances
--    with no usage yet (would show NULL/0).
SELECT
  si.instance_id,
  c.company_name,
  ROUND(SUM(TIMESTAMPDIFF(SECOND, ul.start_time, COALESCE(ul.end_time, NOW())) / 3600.0), 2) AS hours_logged
FROM Server_Instances si
JOIN Clients c ON c.client_id = si.client_id
LEFT JOIN Usage_Logs ul ON ul.instance_id = si.instance_id
GROUP BY si.instance_id, c.company_name
ORDER BY hours_logged DESC;

-- 10. Subquery in SELECT: each client alongside their most recent invoice's payment status.
SELECT
  c.company_name,
  (
    SELECT i.payment_status
    FROM Invoices i
    WHERE i.client_id = c.client_id
    ORDER BY i.billing_month DESC
    LIMIT 1
  ) AS latest_payment_status
FROM Clients c;
