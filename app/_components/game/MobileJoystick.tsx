"use client";

import { useEffect, useRef, useState } from "react";

type Manager = ReturnType<typeof import("nipplejs").create>;

interface MobileJoystickProps {
  onMove: (nx: number, ny: number) => void;
  enabled?: boolean;
  className?: string;
}

export function MobileJoystick({ onMove, enabled = true, className = "" }: MobileJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<Manager | null>(null);
  const [mounted, setMounted] = useState(false);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!enabled || !zoneRef.current) return;

    let cancelled = false;

    import("nipplejs").then((nipplejs) => {
      if (cancelled || !zoneRef.current) return;

      const manager = nipplejs.create({
        zone: zoneRef.current,
        mode: "static",
        position: { left: "50%", top: "50%" },
        size: 100,
        threshold: 0.05,
        color: "rgba(255, 255, 255, 0.4)",
        restOpacity: 0.5,
        restJoystick: true,
        lockX: false,
        lockY: false,
      });

      managerRef.current = manager;

      const handleMove = (
        _evt: unknown,
        data: { vector: { x: number; y: number }; force: number },
      ) => {
        const nx = data.vector.x * data.force;
        const ny = data.vector.y * data.force;
        onMoveRef.current(nx, ny);
      };

      const handleEnd = () => {
        onMoveRef.current(0, 0);
      };

      manager.on("move", handleMove);
      manager.on("end", handleEnd);

      setMounted(true);
    });

    return () => {
      cancelled = true;
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      setMounted(false);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className={`pointer-events-auto touch-none select-none ${className}`}
      style={{ position: "absolute", left: 0, bottom: 10, width: 140, height: 140 }}
      aria-hidden
    >
      <div
        ref={zoneRef}
        className="h-full w-full"
        style={{
          position: "relative",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />
    </div>
  );
}
