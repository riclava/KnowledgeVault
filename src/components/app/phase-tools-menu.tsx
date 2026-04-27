"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";

export function ToolsMenu({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="true"
        className={buttonVariants({
          size: "sm",
          variant: active ? "secondary" : "outline",
        })}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal data-icon="inline-start" />
        更多工具
      </button>

      {open ? (
        <nav
          id={menuId}
          aria-label="更多工具"
          className="absolute right-0 top-full z-20 mt-2 grid w-[18rem] gap-1 rounded-xl border bg-background p-2 shadow-lg"
        >
          {children}
        </nav>
      ) : null}
    </div>
  );
}
