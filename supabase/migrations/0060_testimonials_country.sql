-- Add mandatory country field to testimonials table.
-- Applied live via MCP execute_sql on 2026-08-24.
alter table testimonials add column if not exists country text not null default '';
