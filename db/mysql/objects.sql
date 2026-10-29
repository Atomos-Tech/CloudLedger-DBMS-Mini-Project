-- CloudLedger advanced database objects: triggers, view, stored procedure
-- Run after schema.sql

USE cloudledger;

-- ============================================================
-- Triggers
-- ============================================================

DELIMITER $$

-- Reject provisioning a new instance for a client that is not Active
DROP TRIGGER IF EXISTS trg_prevent_deploy_suspended_client$$
CREATE TRIGGER trg_prevent_deploy_suspended_client
BEFORE INSERT ON Server_Instances
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);

  SELECT account_status INTO v_status
  FROM Clients
  WHERE client_id = NEW.client_id;

  IF v_status IS NULL OR v_status <> 'Active' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot provision an instance for a client that is not Active';
  END IF;
END$$

-- When an instance is stopped/terminated, close any open usage log
DROP TRIGGER IF EXISTS trg_close_usage_log_on_stop$$
CREATE TRIGGER trg_close_usage_log_on_stop
AFTER UPDATE ON Server_Instances
FOR EACH ROW
BEGIN
  IF NEW.current_status IN ('Stopped', 'Terminated')
     AND OLD.current_status <> NEW.current_status THEN
    UPDATE Usage_Logs
    SET end_time = NOW()
    WHERE instance_id = NEW.instance_id
      AND end_time IS NULL;
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- View: live running total for the current calendar month
-- ============================================================

DROP VIEW IF EXISTS vw_client_current_bill;
CREATE VIEW vw_client_current_bill AS
SELECT
  c.client_id,
  c.company_name,
  ROUND(SUM(
    GREATEST(
      0,
      TIMESTAMPDIFF(
        SECOND,
        GREATEST(ul.start_time, DATE_FORMAT(NOW(), '%Y-%m-01')),
        COALESCE(ul.end_time, NOW())
      )
    ) / 3600.0 * st.hourly_cost
  ), 2) AS running_total
FROM Clients c
JOIN Server_Instances si ON si.client_id = c.client_id
JOIN Subscription_Tiers st ON st.tier_id = si.tier_id
JOIN Usage_Logs ul ON ul.instance_id = si.instance_id
WHERE ul.end_time IS NULL
   OR ul.end_time >= DATE_FORMAT(NOW(), '%Y-%m-01')
GROUP BY c.client_id, c.company_name;

-- ============================================================
-- Stored Procedure: generate/refresh a monthly invoice
-- ============================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_generate_monthly_invoice$$
CREATE PROCEDURE sp_generate_monthly_invoice(
  IN p_client_id INT,
  IN p_billing_month DATE
)
BEGIN
  DECLARE v_month_start DATE;
  DECLARE v_month_end DATE;
  DECLARE v_total DECIMAL(10,2);

  SET v_month_start = DATE_FORMAT(p_billing_month, '%Y-%m-01');
  SET v_month_end   = LAST_DAY(v_month_start);

  START TRANSACTION;

  SELECT COALESCE(ROUND(SUM(
      TIMESTAMPDIFF(
        SECOND,
        GREATEST(ul.start_time, v_month_start),
        LEAST(COALESCE(ul.end_time, NOW()), v_month_end + INTERVAL 1 DAY)
      ) / 3600.0 * st.hourly_cost
    ), 2), 0)
  INTO v_total
  FROM Server_Instances si
  JOIN Subscription_Tiers st ON st.tier_id = si.tier_id
  JOIN Usage_Logs ul ON ul.instance_id = si.instance_id
  WHERE si.client_id = p_client_id
    AND ul.start_time <= v_month_end + INTERVAL 1 DAY
    AND (ul.end_time IS NULL OR ul.end_time >= v_month_start);

  INSERT INTO Invoices (client_id, billing_month, total_amount, payment_status)
  VALUES (p_client_id, v_month_start, v_total, 'Pending')
  ON DUPLICATE KEY UPDATE
    total_amount = v_total;

  COMMIT;
END$$

DELIMITER ;
