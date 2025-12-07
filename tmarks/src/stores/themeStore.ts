'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ColorTheme = 'default' | 'violet' | 'green' | 'orange';

interface ThemeStore {
  colorTheme: ColorTheme;
  setColorTheme: (colorTheme: ColorTheme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      colorTheme: 'default',
      setColorTheme: (colorTheme) => set({ colorTheme }),
    }),
    {
      name: 'color-theme-storage',
    },
  ),
);
