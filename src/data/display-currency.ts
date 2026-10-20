import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { CURRENCIES, formatCAD, formatCADWhole, formatMoney, type CurrencyCode } from '../lib/money';
import { supabase } from '../lib/supabase';
import { useMyPrivate } from './profile';
import { rateForCurrency, useFxQuotes, useSettings } from './settings';

export type DisplayCurrency = {
  // The currency amounts are shown in. Falls back to CAD while the chosen currency has no rate.
  currency: CurrencyCode;
  chosen: CurrencyCode;
  // Currencies that can be used right now: CAD plus any with a rate.
  available: CurrencyCode[];
  rateFor: (currency: CurrencyCode) => number | null;
  toDisplay: (cad: number) => number;
  toCad: (amount: number, currency: CurrencyCode) => number | null;
  format: (cad: number, options?: { whole?: boolean }) => string;
};

export function useDisplayCurrency(): DisplayCurrency {
  const mine = useMyPrivate();
  const quotes = useFxQuotes();
  const settings = useSettings();
  const chosen = mine.data?.display_currency ?? 'CAD';
  const override = settings.data?.fx_override_ngn_per_cad;

  const rateFor = useCallback(
    (currency: CurrencyCode) => rateForCurrency(currency, quotes.data, override),
    [quotes.data, override],
  );

  return useMemo(() => {
    const chosenRate = rateFor(chosen);
    const currency: CurrencyCode = chosenRate == null ? 'CAD' : chosen;
    const rate = chosenRate ?? 1;
    const toDisplay = (cad: number) => cad * rate;

    return {
      currency,
      chosen,
      available: CURRENCIES.filter((code) => rateFor(code) != null),
      rateFor,
      toDisplay,
      toCad: (amount, from) => {
        const fromRate = rateFor(from);
        return fromRate == null ? null : Math.round((amount / fromRate) * 100) / 100;
      },
      format: (cad, options) => {
        const whole = options?.whole ?? false;
        if (currency === 'CAD') {
          return whole ? formatCADWhole(cad) : formatCAD(cad);
        }
        // Converted at the latest rate, so mark it as an estimate.
        return `≈${formatMoney(toDisplay(cad), currency, whole)}`;
      },
    };
  }, [chosen, rateFor]);
}

export function useSetDisplayCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      const { error } = await supabase.rpc('set_my_display_currency', { p_currency: currency });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member-private'] });
    },
  });
}
