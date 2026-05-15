import { useState, useEffect } from "react";

export type ViewportInfo = {
  width: number;
  height: number;
  aspect: number;       // width / height
  isMobile: boolean;    // width < 768
  isSmallMobile: boolean; // width < 480
  scaleFactor: number;  // 1 = desktop, increases on small screens
};

export function useViewport(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1440;
    const h = typeof window !== "undefined" ? window.innerHeight : 900;
    const aspect = w / h;
    return {
      width: w,
      height: h,
      aspect,
      isMobile: w < 768,
      isSmallMobile: w < 480,
      scaleFactor: Math.max(1, 1.2 - (aspect - 16 / 9) * 0.2),
    };
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const aspect = w / h;
      setInfo({
        width: w,
        height: h,
        aspect,
        isMobile: w < 768,
        isSmallMobile: w < 480,
        scaleFactor: Math.max(0.75, Math.min(1.2, 1.2 - (aspect - 16 / 9) * 0.2)),
      });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return info;
}
