import { useEffect, useState } from "react";

export type Orientation = "portrait" | "landscape";

export function usePrintOrientation(): {
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
} {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === "undefined") return "landscape";
    const stored = window.localStorage.getItem("print-orientation");
    return stored === "portrait" ? "portrait" : "landscape";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("print-orientation", orientation);
    const id = "print-page-size-style";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    const margin =
      orientation === "landscape" ? "8mm 8mm 10mm 8mm" : "10mm 10mm 12mm 10mm";
    el.textContent = `@page { size: A4 ${orientation}; margin: ${margin}; }`;
    return () => {
      // Style is kept across re-renders to ensure print consistency
    };
  }, [orientation]);

  useEffect(() => {
    return () => {
      const el = document.getElementById("print-page-size-style");
      if (el) el.remove();
    };
  }, []);

  return { orientation, setOrientation };
}
