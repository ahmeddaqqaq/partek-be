-- Rule: only one product_images row per product may have is_hero = true.
CREATE UNIQUE INDEX product_images_one_hero_per_product
  ON product_images (product_id)
  WHERE is_hero;

-- Rule: a product must carry at least one of the two prices.
ALTER TABLE products
  ADD CONSTRAINT products_at_least_one_price
  CHECK (exw_price_sar IS NOT NULL OR d2d_price_sar IS NOT NULL);

-- Rule: direct POs come from a cart; RFQ POs come from an RFQ and a bid.
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_source_type_integrity
  CHECK (
    (source_type = 'direct' AND cart_id IS NOT NULL)
    OR
    (source_type = 'rfq' AND rfq_id IS NOT NULL AND bid_id IS NOT NULL)
  );

-- Rule: audit_logs is append-only. This trigger is the outer layer; the
-- Prisma client extension in Task 10 is the inner one. The trigger also
-- catches raw SQL, psql sessions, and any future non-Prisma consumer.
CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'check_violation',
          CONSTRAINT = 'audit_logs_append_only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- Deferred foreign keys for the user-reference columns that were left as
-- plain uuid in the Prisma schema (see Task 4 note).
ALTER TABLE vendors
  ADD CONSTRAINT vendors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE vendors
  ADD CONSTRAINT vendors_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE clients
  ADD CONSTRAINT clients_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE client_users
  ADD CONSTRAINT client_users_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE vendor_documents
  ADD CONSTRAINT vendor_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE vendor_documents
  ADD CONSTRAINT vendor_documents_validated_by_fkey
  FOREIGN KEY (validated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE delivery_agents
  ADD CONSTRAINT delivery_agents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

-- Postgres does NOT create an index for a foreign key column. Both of these
-- are on the authorization path -- "which vendor does this user own" and
-- "which clients is this user a member of" run on essentially every request
-- from a vendor or client account. client_users already has a unique index
-- on (client_id, user_id), but user_id is not its leftmost column, so a
-- lookup by user_id alone cannot use it.
CREATE INDEX vendors_user_id_idx ON vendors (user_id);
CREATE INDEX client_users_user_id_idx ON client_users (user_id);

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- Rule: a vehicle's model must belong to that vehicle's make.
-- Escalated at Task 5 review, resolved here. vehicles carries make_id and
-- model_id as two independent foreign keys, so nothing stops a row claiming
-- make = Toyota while model_id points at a Honda Civic. The Phase 3b import
-- resolver matches on make + model + year, so a mismatched row would silently
-- associate parts with the wrong car. Prisma cannot express a composite
-- foreign key spanning two of its own relations, so it is enforced here.
--
-- The UNIQUE on (id, make_id) is redundant for uniqueness -- id is already
-- the primary key -- but Postgres requires a unique constraint covering
-- exactly the referenced column list before it will accept the composite FK.
ALTER TABLE vehicle_models
  ADD CONSTRAINT vehicle_models_id_make_id_key UNIQUE (id, make_id);

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_model_belongs_to_make
  FOREIGN KEY (model_id, make_id) REFERENCES vehicle_models (id, make_id);
