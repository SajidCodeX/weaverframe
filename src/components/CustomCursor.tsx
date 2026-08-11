import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function CustomCursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 w-3 h-3 bg-[#e5d9c5] rounded-full pointer-events-none z-[100] mix-blend-difference"
        animate={{
          x: mousePosition.x - 6,
          y: mousePosition.y - 6,
        }}
        transition={{ type: "tween", ease: "backOut", duration: 0 }}
      />
      <motion.div
        className="fixed top-0 left-0 w-10 h-10 border border-[#e5d9c5]/40 rounded-full pointer-events-none z-[99] mix-blend-difference hidden md:block"
        animate={{
          x: mousePosition.x - 20,
          y: mousePosition.y - 20,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.5 }}
      />
    </>
  );
}
