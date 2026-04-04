"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";

export default function CthulhuLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [glowIntensity, setGlowIntensity] = useState(0.3);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.sqrt((e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2);
    setGlowIntensity(Math.max(0.3, 1 - dist / 400));
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div ref={containerRef} className="relative select-none" style={{ width: "200px", height: "200px" }}>
      {/* Glow rings */}
      <div
        className="absolute inset-[-40px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(77,232,224,${glowIntensity * 0.15}) 0%, transparent 70%)`,
          animation: "pulse-glow 3s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-[-60px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(93,219,110,${glowIntensity * 0.08}) 0%, transparent 60%)`,
          animation: "pulse-glow 4s ease-in-out infinite reverse",
        }}
      />

      {/* Logo with glow + float */}
      <div
        style={{
          animation: "float 6s ease-in-out infinite",
          filter: `
            invert(1) brightness(1.8)
            drop-shadow(0 0 ${10 + glowIntensity * 25}px rgba(77, 232, 224, ${glowIntensity}))
            drop-shadow(0 0 ${5 + glowIntensity * 12}px rgba(93, 219, 110, ${glowIntensity * 0.5}))
          `,
        }}
      >
        <Image src="/cthulu-logo.png" alt="Cthulu Lab" width={200} height={200} priority draggable={false} />
      </div>
    </div>
  );
}
