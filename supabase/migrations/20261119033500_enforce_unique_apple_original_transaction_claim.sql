-- Enforce global Apple original transaction ownership under concurrent requests.
-- Multiple NULL values remain permitted until the signed transaction is known.
-- A claim cannot reuse an original transaction across accounts or product IDs.
CREATE UNIQUE INDEX IF NOT EXISTS apple_purchase_claims_original_transaction_unique
ON public.apple_purchase_claims (original_transaction_id)
WHERE original_transaction_id IS NOT NULL;
