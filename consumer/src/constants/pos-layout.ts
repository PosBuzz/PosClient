export const POS_LAYOUT_STORAGE_KEY = "posLayout";

export type PosLayout = "classic" | "restaurant";

export const getPosLayout = (): PosLayout => {
  if (typeof window === "undefined") return "classic";
  return localStorage.getItem(POS_LAYOUT_STORAGE_KEY) === "restaurant"
    ? "restaurant"
    : "classic";
};

export const savePosLayout = (layout: PosLayout) => {
  localStorage.setItem(POS_LAYOUT_STORAGE_KEY, layout);
  window.dispatchEvent(
    new CustomEvent("pos-layout-change", { detail: layout }),
  );
};
