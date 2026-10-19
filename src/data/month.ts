import { create } from 'zustand';

export function currentMonth(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}-01`;
}

export function formatMonthTitle(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${nextMonth}-01`;
}

type MonthState = {
  month: string;
  setMonth: (month: string) => void;
  next: () => void;
  previous: () => void;
};

export const useMonth = create<MonthState>((set) => ({
  month: currentMonth(),
  setMonth: (month) => set({ month }),
  next: () => set((state) => ({ month: shiftMonth(state.month, 1) })),
  previous: () => set((state) => ({ month: shiftMonth(state.month, -1) })),
}));
