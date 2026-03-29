-- Fix all views to respect RLS by using security_invoker = true
-- This ensures views run queries as the calling user, not the view owner
-- Without this, any authenticated user could see all users' data through views

-- 1. trust_balance_by_matter (must be recreated before trust_balance_by_client which depends on it)
DROP VIEW IF EXISTS trust_balance_by_client CASCADE;
DROP VIEW IF EXISTS trust_balance_by_matter CASCADE;

CREATE VIEW trust_balance_by_matter
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (matter_id)
    matter_id,
    client_id,
    user_id,
    running_balance AS current_balance,
    transaction_date AS last_transaction_date,
    created_at AS last_transaction_at
FROM trust_ledger
ORDER BY matter_id, created_at DESC, id DESC;

-- 2. trust_balance_by_client (depends on trust_balance_by_matter)
CREATE VIEW trust_balance_by_client
WITH (security_invoker = true)
AS
SELECT
    client_id,
    user_id,
    sum(current_balance) AS total_trust_balance,
    count(*) AS matter_count
FROM trust_balance_by_matter
GROUP BY client_id, user_id;

-- 3. trust_activity_summary
DROP VIEW IF EXISTS trust_activity_summary;

CREATE VIEW trust_activity_summary
WITH (security_invoker = true)
AS
SELECT
    user_id,
    client_id,
    matter_id,
    transaction_type,
    date_trunc('month', transaction_date::timestamp with time zone) AS month,
    count(*) AS transaction_count,
    sum(amount) AS total_amount
FROM trust_ledger
GROUP BY user_id, client_id, matter_id, transaction_type, date_trunc('month', transaction_date::timestamp with time zone);

-- 4. invoice_summary
DROP VIEW IF EXISTS invoice_summary;

CREATE VIEW invoice_summary
WITH (security_invoker = true)
AS
SELECT
    i.id,
    i.user_id,
    i.client_id,
    i.matter_id,
    i.invoice_number,
    i.status,
    i.issued_date,
    i.due_date,
    i.date_range_start,
    i.date_range_end,
    i.subtotal,
    i.tax_rate,
    i.tax_amount,
    i.total,
    i.amount_paid,
    i.balance_due,
    i.trust_applied,
    i.notes,
    i.payment_terms,
    i.payment_link,
    i.pdf_url,
    i.sent_at,
    i.viewed_at,
    i.paid_at,
    i.created_at,
    i.updated_at,
    c.name AS client_name,
    m.name AS matter_name,
    (SELECT count(*) FROM invoice_line_items li WHERE li.invoice_id = i.id) AS line_item_count,
    (SELECT count(*) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'completed') AS payment_count
FROM invoices i
JOIN clients c ON i.client_id = c.id
LEFT JOIN matters m ON i.matter_id = m.id;

-- 5. unbilled_entries
DROP VIEW IF EXISTS unbilled_entries;

CREATE VIEW unbilled_entries
WITH (security_invoker = true)
AS
SELECT
    e.id,
    e.user_id,
    e.client_id,
    e.invoice_id,
    e.start_at,
    e.end_at,
    e.duration_sec,
    e.notes,
    e.paused_at,
    e.total_paused_seconds,
    e.billed,
    e.created_at,
    e.matter_id,
    e.is_archived,
    e.archived,
    m.name AS matter_name,
    m.matter_number,
    m.hourly_rate AS matter_rate,
    c.name AS client_name,
    c.hourly_rate AS client_rate,
    COALESCE(m.hourly_rate, c.hourly_rate, 0::numeric) AS effective_rate,
    CASE
        WHEN e.duration_sec IS NOT NULL AND e.duration_sec > 0
            THEN GREATEST(ceil(e.duration_sec::numeric / 360::numeric) / 10::numeric, 0.1)
        WHEN e.end_at IS NOT NULL
            THEN GREATEST(ceil((EXTRACT(epoch FROM (e.end_at - e.start_at)) - COALESCE(e.total_paused_seconds, 0)::numeric) / 360::numeric) / 10::numeric, 0.1)
        ELSE 0::numeric
    END AS billed_hours
FROM entries e
JOIN matters m ON e.matter_id = m.id
JOIN clients c ON e.client_id = c.id
WHERE e.billed = false AND e.archived = false AND e.end_at IS NOT NULL AND e.invoice_id IS NULL;

-- Grant access to authenticated and anon roles
GRANT SELECT ON invoice_summary TO authenticated, anon;
GRANT SELECT ON unbilled_entries TO authenticated, anon;
GRANT SELECT ON trust_balance_by_matter TO authenticated, anon;
GRANT SELECT ON trust_balance_by_client TO authenticated, anon;
GRANT SELECT ON trust_activity_summary TO authenticated, anon;
