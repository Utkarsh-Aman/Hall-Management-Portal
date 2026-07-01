"use client";

import React from "react";
import Header from "@/components/Header";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Roll Numbers", href: "/hall-office/roll-numbers" },
  { label: "Staff Accounts", href: "/hall-office/staff-accounts" },
];

export default function HallOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* Tab navigation */}
      <div className="border-b border-border bg-bg-surface/50">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-4 pb-8">
        {children}
      </main>
    </div>
  );
}
