import { create } from 'zustand';

export type BudgetView = 'me' | 'household';

type ViewState = {
  view: BudgetView;
  setView: (view: BudgetView) => void;
};

export const useView = create<ViewState>((set) => ({
  view: 'household',
  setView: (view) => set({ view }),
}));
