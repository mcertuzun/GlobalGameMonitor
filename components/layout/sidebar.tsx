"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/apps", label: "Games", icon: "🎮" },
  { href: "/charts", label: "Top Charts", icon: "📈" },
  { href: "/ads", label: "Ads", icon: "📺" },
  { href: "/community", label: "Community", icon: "💬" },
  { href: "/trends", label: "Trends", icon: "🔮" },
  { href: "/database", label: "Database", icon: "📚" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-sidebar min-h-screen">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-lg">🎯</span>
        <span className="font-heading text-base font-semibold text-sidebar-foreground">
          GlobalGameMonitor
        </span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
