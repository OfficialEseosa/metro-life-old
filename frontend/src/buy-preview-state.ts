import { create } from "zustand";
import type { FurnitureProduct, Furnishing } from "./home-design";

export const useBuyPreview = create<{
  product: FurnitureProduct | null;
  moving: Furnishing | null;
  point: { x: number; z: number };
  rotation: number;
  inside: boolean;
  busy: boolean;
  wallPreview: string | null;
  floorPreview: string | null;
  choose: (product: FurnitureProduct, item?: Furnishing) => void;
  clear: () => void;
}>((set) => ({
  product: null,
  moving: null,
  point: { x: 0, z: 0 },
  rotation: 0,
  inside: true,
  busy: false,
  wallPreview: null,
  floorPreview: null,
  choose: (product, item) =>
    set({
      product,
      moving: item ?? null,
      point: item ? { x: item.x, z: item.z } : { x: 0, z: 0 },
      rotation: item?.rotation ?? 0,
      inside: true,
    }),
  clear: () =>
    set({
      product: null,
      moving: null,
      inside: true,
      wallPreview: null,
      floorPreview: null,
    }),
}));
