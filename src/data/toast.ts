import { create } from 'zustand';

type ToastState = {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
};

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));
