"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/actions/auth";

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="user-name">{name}</span>
      </button>
      {open && (
        <div className="user-menu-dropdown" role="menu">
          <form action={logout}>
            <button type="submit" className="user-menu-item" role="menuitem">
              退出登录
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
