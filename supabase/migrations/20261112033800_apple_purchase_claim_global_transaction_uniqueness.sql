-- A StoreKit transaction must have one owner globally, not merely per user.
-- The existing UNIQUE(user_id, transaction_id) allows simultaneous claims by
-- different users for the same transaction. This index closes that race.
-- The claim endpoint catches SQLSTATE 23505 and re-reads the winner.
CREATE UNIQUE INDEX IF NOT EXISTS apple_purchase_claims_transaction_id_global_unique
ON public.apple_purchase_claims (transaction_id);
