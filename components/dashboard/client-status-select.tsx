"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const ACCOUNT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Suspended: "destructive",
  Closed: "outline",
};

export function ClientStatusSelect({
  clientId,
  companyName,
  initialStatus,
}: {
  clientId: number;
  companyName: string;
  initialStatus: "Active" | "Suspended" | "Closed";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(nextStatus: "Active" | "Suspended" | "Closed") {
    setSaving(true);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_status: nextStatus }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus(nextStatus);
      toast.success(`${companyName} status updated to ${nextStatus}.`);
      router.refresh();
    } else {
      toast.error("Failed to update client status.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={ACCOUNT_STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>
      <select
        aria-label={`Change account status for ${companyName}`}
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as "Active" | "Suspended" | "Closed")}
        className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
      >
        <option value="Active">Active</option>
        <option value="Suspended">Suspended</option>
        <option value="Closed">Closed</option>
      </select>
    </div>
  );
}

