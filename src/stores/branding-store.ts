import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";

export type BrandingColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
};

type BrandingState = {
  brandName: string;
  logoUrl: string;
  mode: ThemeMode;
  colors: BrandingColors;
  setBrandName: (name: string) => void;
  setLogoUrl: (url: string) => void;
  setMode: (mode: ThemeMode) => void;
  setColor: (key: keyof BrandingColors, value: string) => void;
  reset: () => void;
};

const DEFAULT_BRANDING: Omit<
  BrandingState,
  "setBrandName" | "setLogoUrl" | "setMode" | "setColor" | "reset"
> = {
  brandName: "Vennity",
  logoUrl: "",
  mode: "system",
  colors: {
    primary: "#c65d43",
    secondary: "#2e7c7a",
    accent: "#e2a34c",
    background: "#f7f2ea",
    surface: "#fff8ef",
  },
};

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      ...DEFAULT_BRANDING,
      setBrandName: (brandName) => set({ brandName }),
      setLogoUrl: (logoUrl) => set({ logoUrl }),
      setMode: (mode) => set({ mode }),
      setColor: (key, value) =>
        set((state) => ({
          colors: {
            ...state.colors,
            [key]: value,
          },
        })),
      reset: () => set(DEFAULT_BRANDING),
    }),
    {
      name: "vennity-branding",
    }
  )
);
