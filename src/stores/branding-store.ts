import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BrandingColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
};

type BrandingState = {
  brandName: string;
  logoUrl: string;
  colors: BrandingColors;
  setBrandName: (name: string) => void;
  setLogoUrl: (url: string) => void;
  setColor: (key: keyof BrandingColors, value: string) => void;
  reset: () => void;
};

const DEFAULT_BRANDING: Omit<
  BrandingState,
  "setBrandName" | "setLogoUrl" | "setColor" | "reset"
> = {
  brandName: "Vennity",
  logoUrl: "",
  colors: {
    primary: "#a855f7",
    secondary: "#60a5fa",
    accent: "#f472b6",
    background: "#030712",
  },
};

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      ...DEFAULT_BRANDING,
      setBrandName: (brandName) => set({ brandName }),
      setLogoUrl: (logoUrl) => set({ logoUrl }),
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
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<BrandingState>;
        return {
          ...current,
          ...persistedState,
          colors: {
            ...current.colors,
            ...persistedState.colors,
          },
        };
      },
    }
  )
);
