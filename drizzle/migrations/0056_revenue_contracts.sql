ALTER TABLE public.finance_revenues
  ADD COLUMN contract_id uuid,
  ADD COLUMN contract_total numeric(14,2),
  ADD COLUMN contract_start date,
  ADD COLUMN contract_duration integer,
  ADD COLUMN contract_unit text;
ALTER TABLE public.finance_revenues ADD CONSTRAINT finance_revenues_contract_unit_chk
  CHECK (contract_unit IS NULL OR contract_unit IN ('days','months','years'));
ALTER TABLE public.finance_revenues ADD CONSTRAINT finance_revenues_contract_duration_chk
  CHECK (contract_duration IS NULL OR contract_duration > 0);
CREATE INDEX finance_revenues_contract ON public.finance_revenues(contract_id) WHERE contract_id IS NOT NULL;