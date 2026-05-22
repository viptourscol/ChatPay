-- Eliminar pagos duplicados (conservar el más antiguo por wompi_tx_id)
DELETE FROM subscription_payments
WHERE id NOT IN (
  SELECT DISTINCT ON (wompi_tx_id) id
  FROM subscription_payments
  ORDER BY wompi_tx_id, created_at ASC
);

-- Agregar constraint único para evitar duplicados futuros
ALTER TABLE subscription_payments
  ADD CONSTRAINT subscription_payments_wompi_tx_id_unique UNIQUE (wompi_tx_id);
