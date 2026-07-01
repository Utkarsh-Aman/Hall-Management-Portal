"use client";

import React from "react";
import NoticeBoard from "@/components/NoticeBoard";

export default function StaffNoticesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Notice Board</h1>
        <p className="text-sm text-text-muted">
          Post and manage announcements for students.
        </p>
      </div>
      <NoticeBoard />
    </div>
  );
}
