import type { ReactNode } from "react";
import {
  Download,
  Keyboard,
  Lightbulb,
  SlidersHorizontal,
} from "lucide-react";

export type View = "keymap" | "settings";

interface SidebarProps {
  view: View;
  onViewChange: (view: View) => void;
}

function Item({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-primary text-primary-content"
          : "hover:bg-base-300 text-base-content"
      }`}
      onClick={onClick}
      title={label}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function Sidebar({ view, onViewChange }: SidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-1 border-r border-base-300 bg-base-200 p-2">
      <Item
        active={view === "keymap"}
        icon={<Keyboard size={18} />}
        label="Keymap"
        onClick={() => onViewChange("keymap")}
      />
      <Item
        active={view === "settings"}
        icon={<SlidersHorizontal size={18} />}
        label="Settings"
        onClick={() => onViewChange("settings")}
      />
      <a
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-base-300"
        href="https://scholzri.github.io/rainy75-zmk/config/"
        target="_blank"
        rel="noreferrer"
        title="Lighting"
      >
        <Lightbulb size={18} />
        <span className="hidden md:inline">Lighting</span>
      </a>
      <a
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-base-300"
        href="https://github.com/trkw/rainy75-zmk-macos"
        target="_blank"
        rel="noreferrer"
        title="Firmware"
      >
        <Download size={18} />
        <span className="hidden md:inline">Firmware</span>
      </a>
      <div className="mt-auto hidden px-3 py-2 text-xs text-base-content/40 md:block">
        v0.1 · unofficial
      </div>
    </nav>
  );
}
