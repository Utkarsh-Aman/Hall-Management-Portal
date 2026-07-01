"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import type { NoticeResponse } from "@/types";
import { formatDateTime } from "@/lib/utils";

export default function NoticeBoard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<NoticeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Posting states
  const [isPosting, setIsPosting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");

  const canManage = user?.role === "hall_office" || user?.role === "mess_staff";

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<NoticeResponse[]>("/notices");
      setNotices(data);
    } catch (err: any) {
      toast("Failed to load notices", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      await apiFetch("/notices", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          link: link.trim() || null,
        }),
      });
      toast("Notice posted successfully", "success");
      setTitle("");
      setDescription("");
      setLink("");
      setIsPosting(false);
      fetchNotices();
    } catch (err: any) {
      toast(err.message || "Failed to post notice", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this notice?")) return;
    try {
      await apiFetch(`/notices/${id}`, { method: "DELETE" });
      toast("Notice deleted", "success");
      fetchNotices();
    } catch (err: any) {
      toast(err.message || "Failed to delete notice", "error");
    }
  };

  return (
    <div className="glass-card p-6 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Notice Board</h2>
        {canManage && (
          <button
            onClick={() => setIsPosting(!isPosting)}
            className="text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            {isPosting ? "Cancel" : "+ Post Notice"}
          </button>
        )}
      </div>

      {isPosting && canManage && (
        <form onSubmit={handlePost} className="bg-bg-elevated/50 p-4 rounded-xl space-y-3 animate-fade-in border border-border">
          <input
            type="text"
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            required
          />
          <textarea
            placeholder="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent min-h-[80px]"
            required
          />
          <input
            type="url"
            placeholder="Link (optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Post Notice
          </button>
        </form>
      )}

      <div className="space-y-3 mt-4">
        {isLoading ? (
          <div className="animate-subtle-pulse h-20 bg-bg-elevated rounded-xl"></div>
        ) : notices.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No notices at the moment.</p>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="p-4 bg-bg-elevated rounded-xl border border-border relative group transition-all hover:border-accent/30">
              {canManage && (
                <button
                  onClick={() => handleDelete(notice.id)}
                  className="absolute top-3 right-3 text-error/70 hover:text-error text-xs bg-error/10 hover:bg-error/20 px-2 py-1 rounded"
                >
                  Delete
                </button>
              )}
              <h3 className="font-semibold text-text-primary mb-1 pr-12">{notice.title}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap mb-2">{notice.description}</p>
              
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-text-muted">{formatDateTime(notice.created_at)}</span>
                {notice.link && (
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Open Link ↗
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
