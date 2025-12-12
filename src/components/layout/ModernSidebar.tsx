// src/components/layout/ModernSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Building2,
  CheckSquare,
  Mail,
  Settings,
  CreditCard,
  ChevronLeft,
  FileUp,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Upload", href: "/upload", icon: FileUp },
  { name: "Transactions", href: "/transactions", icon: FileText },
  { name: "Listings", href: "#", icon: Building2, soon: true },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Email", href: "#", icon: Mail, soon: true },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
];

interface ModernSidebarProps {
  defaultCollapsed?: boolean;
}

export default function ModernSidebar({ defaultCollapsed = false }: ModernSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button - Fixed top-left */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r bg-background transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          // Mobile behavior
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo Area */}
        <div className="h-16 border-b flex items-center justify-between px-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                TC
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                TC Helper App
              </span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" className="mx-auto">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                TC
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "#" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  item.soon && "opacity-50 pointer-events-none",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                {!isCollapsed && (
                  <>
                    <span className="text-sm">{item.name}</span>
                    {item.soon && (
                      <span className="ml-auto text-xs px-2 py-0.5 bg-muted rounded-full">
                        Soon
                      </span>
                    )}
                  </>
                )}
                {isCollapsed && item.soon && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    <span className="text-xs">Coming Soon</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle - Desktop only */}
        <div className="hidden lg:block p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                isCollapsed && "rotate-180"
              )}
            />
            {!isCollapsed && <span className="ml-2 text-xs">Collapse</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
