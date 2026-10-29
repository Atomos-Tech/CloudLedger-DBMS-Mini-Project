# CloudLedger Data Dictionary

## MySQL 8 — `cloudledger` (relational core)

### Regions
| Column | Type | Constraints |
|---|---|---|
| region_id | INT | PK, AUTO_INCREMENT |
| region_name | VARCHAR(50) | NOT NULL, UNIQUE |

### Data_Centers
| Column | Type | Constraints |
|---|---|---|
| dc_id | INT | PK, AUTO_INCREMENT |
| region_id | INT | NOT NULL, FK -> Regions(region_id) |
| facility_name | VARCHAR(100) | NOT NULL |
| operational_status | ENUM('Active','Maintenance','Offline') | NOT NULL, DEFAULT 'Active' |

### Clients
| Column | Type | Constraints |
|---|---|---|
| client_id | INT | PK, AUTO_INCREMENT |
| company_name | VARCHAR(100) | NOT NULL |
| billing_address | VARCHAR(255) | NULL |
| account_status | ENUM('Active','Suspended','Closed') | NOT NULL, DEFAULT 'Active' |

### Employees
| Column | Type | Constraints |
|---|---|---|
| employee_id | INT | PK, AUTO_INCREMENT |
| first_name | VARCHAR(50) | NOT NULL |
| last_name | VARCHAR(50) | NOT NULL |
| email | VARCHAR(100) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL — bcrypt hash, never plaintext |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### Roles
| Column | Type | Constraints |
|---|---|---|
| role_id | INT | PK, AUTO_INCREMENT |
| role_name | VARCHAR(30) | NOT NULL, UNIQUE — 'Admin', 'DevOps', 'Billing' |

### Client_Access_Mapping (junction: resolves Employees <-> Clients M:N)
| Column | Type | Constraints |
|---|---|---|
| client_id | INT | PK (composite), FK -> Clients(client_id), ON DELETE CASCADE |
| employee_id | INT | PK (composite), FK -> Employees(employee_id), ON DELETE CASCADE |
| role_id | INT | NOT NULL, FK -> Roles(role_id), ON DELETE RESTRICT |

### Subscription_Tiers
| Column | Type | Constraints |
|---|---|---|
| tier_id | INT | PK, AUTO_INCREMENT |
| tier_name | VARCHAR(50) | NOT NULL, UNIQUE |
| cpu_cores | INT | NOT NULL, CHECK (cpu_cores > 0) |
| ram_gb | INT | NOT NULL, CHECK (ram_gb > 0) |
| hourly_cost | DECIMAL(8,4) | NOT NULL, CHECK (hourly_cost >= 0) |

### Server_Instances
| Column | Type | Constraints |
|---|---|---|
| instance_id | INT | PK, AUTO_INCREMENT |
| client_id | INT | NOT NULL, FK -> Clients(client_id), ON DELETE CASCADE |
| tier_id | INT | NOT NULL, FK -> Subscription_Tiers(tier_id), ON DELETE RESTRICT |
| dc_id | INT | NOT NULL, FK -> Data_Centers(dc_id), ON DELETE RESTRICT |
| current_status | ENUM('Running','Stopped','Terminated') | NOT NULL, DEFAULT 'Stopped' |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

Indexes: `idx_si_client_status` on (client_id, current_status) — dashboard lookups of "my running instances."

### Usage_Logs
| Column | Type | Constraints |
|---|---|---|
| log_id | INT | PK, AUTO_INCREMENT |
| instance_id | INT | NOT NULL, FK -> Server_Instances(instance_id), ON DELETE CASCADE |
| start_time | DATETIME | NOT NULL |
| end_time | DATETIME | NULL, CHECK (end_time IS NULL OR end_time > start_time) |

Indexes: `idx_ul_instance` on (instance_id).

### Invoices
| Column | Type | Constraints |
|---|---|---|
| invoice_id | INT | PK, AUTO_INCREMENT |
| client_id | INT | NOT NULL, FK -> Clients(client_id), ON DELETE CASCADE |
| billing_month | DATE | NOT NULL |
| total_amount | DECIMAL(10,2) | NOT NULL, DEFAULT 0 — stored snapshot, intentionally denormalized |
| payment_status | ENUM('Pending','Paid','Overdue') | NOT NULL, DEFAULT 'Pending' |

Constraints: `UNIQUE(client_id, billing_month)`.

> `total_amount` is computed once by `sp_generate_monthly_invoice` and stored, not
> live-derived, so a settled invoice cannot silently change if historical usage
> logs are later edited. This is the one intentional denormalization in the schema.

---

## Advanced objects (MySQL)

- **Trigger** `trg_prevent_deploy_suspended_client` — BEFORE INSERT on Server_Instances; rejects the insert (`SIGNAL SQLSTATE '45000'`) if the target client's `account_status <> 'Active'`.
- **Trigger** `trg_close_usage_log_on_stop` — AFTER UPDATE on Server_Instances; when `current_status` transitions to Stopped/Terminated, sets `end_time = NOW()` on the open Usage_Logs row for that instance.
- **View** `vw_client_current_bill(client_id, company_name, running_total)` — live running total per client for the current calendar month, joining Usage_Logs -> Server_Instances -> Subscription_Tiers.
- **Stored procedure** `sp_generate_monthly_invoice(client_id, billing_month)` — sums usage cost for the given month inside a transaction and upserts the result into Invoices via `ON DUPLICATE KEY UPDATE`.

---

## PostgreSQL + pgvector — `cloudledger_vectors` (vector store)

### support_tickets
| Column | Type | Constraints |
|---|---|---|
| ticket_id | SERIAL | PK |
| client_id | INTEGER | NOT NULL — references MySQL `Clients.client_id` (application-level FK; cross-database, not enforceable in Postgres) |
| subject | TEXT | NOT NULL |
| body | TEXT | NOT NULL |
| embedding | VECTOR(384) | NOT NULL — output of `all-MiniLM-L6-v2` on `subject + body` |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

Indexes:
- `idx_support_tickets_client_id` — B-tree on client_id, for scoping search results to a client's own tickets.

No ANN index (ivfflat/HNSW) on `embedding`: at demo/seed scale (a few dozen
tickets), an ivfflat index with any meaningful `lists` value starves each
probe of candidates and silently drops most true neighbors (verified — with
`lists = 100` on 12 rows, a 5-result query returned only 1). A plain
sequential scan with the `<=>` operator is exact and fast enough below a
few tens of thousands of rows, so retrieval uses that instead. Add an ANN
index back once the table is large enough to need it, sized as
`lists = sqrt(row_count)`.

Retrieval uses the `<=>` cosine-distance operator; similarity is reported to the app as `1 - distance`.
