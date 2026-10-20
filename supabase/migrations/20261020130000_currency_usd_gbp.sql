-- Transactions can be entered in US dollars or pounds as well as naira.
-- fx_ngn_per_cad stores how many units of the chosen currency equal 1 CAD.

alter type public.currency_code add value if not exists 'USD';
alter type public.currency_code add value if not exists 'GBP';

comment on column public.transactions.fx_ngn_per_cad is
  'Units of the transaction currency per 1 Canadian dollar. Required unless currency is CAD.';
