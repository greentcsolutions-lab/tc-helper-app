// src/components/layout/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Building2,
  CheckSquare,
  Mail,
  Settings,
  CreditCard,
} from "lucide-react";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: FileText },
  { name: "Listings", href: "#", icon: Building2, soon: true },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Email", href: "#", icon: Mail, soon: true },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Billing & Credits", href: "/dashboard/billing", icon: CreditCard },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-white/20 bg-white/70 backdrop-blur-xl">
      {/* Logo area */}
      <div className="p-8 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-4 group">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg group-hover:shadow-cyan-500/30 transition-all duration-300">
            TC
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              TC Pro
            </div>
            <div className="text-xs text-muted-foreground/70">Transaction Coordination</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && item.href !== "#";
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300
                ${isActive 
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-700 font-medium shadow-md" 
                  : "text-foreground/70 hover:text-foreground hover:bg-white/50"
                }
                ${item.soon ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.name}</span>
              {item.soon && (
                <span className="ml-auto text-xs px-3 py-1 bg-muted/50 rounded-full">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Optional bottom accent */}
      <div className="p-6 border-t border-white/10">
        <p className="text-center text-xs text-muted-foreground/60">
          Made with <span className="text-cyan-500">❤</span> in California
        </p>
      </div>
    </aside>
  );
}