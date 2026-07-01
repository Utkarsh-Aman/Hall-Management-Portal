"use client";

/**
 * Student layout — header + content + bottom nav.
 */

import React from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-4 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
