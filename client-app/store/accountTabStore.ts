import { create } from 'zustand';

export type AccountTab = 'datos' | 'pedidos' | 'listas' | 'reparto' | 'todos';

interface AccountTabStore {
  activeTab: AccountTab;
  setActiveTab: (tab: AccountTab) => void;
}

export const useAccountTabStore = create<AccountTabStore>((set) => ({
  activeTab: 'datos',
  setActiveTab: (tab: AccountTab) => set({ activeTab: tab }),
}));
