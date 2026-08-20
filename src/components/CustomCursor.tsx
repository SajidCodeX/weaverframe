import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function CustomCursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Only bind on pointer-capable desktop devices
    if (typeof window === "undefined" || window.matchMedia("(pointer: coarse)").matches) return;

    let rafId: number | null = null;
    const updateMousePosition = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      });
    };

    window.addEventListener("mousemove", updateMousePosition, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  if (mousePosition.x === 0 && mousePosition.y === 0) return null;

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 w-2.5 h-2.5 bg-[#e5d9c5] rounded-full pointer-events-none z-[100] shadow-[0_0_8px_rgba(229,217,197,0.8)]"
        animate={{
          x: mousePosition.x - 5,
          y: mousePosition.y - 5,
        }}
        transition={{ type: "tween", ease: "linear", duration: 0 }}
      />
      <motion.div
        className="fixed top-0 left-0 w-9 h-9 border border-[#e5d9c5]/50 rounded-full pointer-events-none z-[99] hidden md:block shadow-[0_0_15px_rgba(201,168,76,0.15)]"
        animate={{
          x: mousePosition.x - 18,
          y: mousePosition.y - 18,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 28, mass: 0.1 }}
      />
    </>
  );
}
