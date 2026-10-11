"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const pickupQueryKey = ["pos", "self-order-pickup"] as const;

async function fetchPickup(): Promise<{ enabled: boolean }> {
  const res = await fetch("/api/pos/self-order-pickup", { credentials: "include", cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { enabled: boolean }; error?: string };
  if (!res.ok || !json.data) throw new Error(json.error || "Gagal memuat status pickup");
  return json.data;
}

async function savePickup(enabled: boolean) {
  const res = await fetch("/api/pos/self-order-pickup", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || json.success === false) throw new Error(json.error || "Gagal menyimpan");
  return enabled;
}

/**
 * Saklar buka/tutup pesanan pickup dari aplikasi pelanggan (owner 2026-10-11,
 * EPIC-053). Pickup wajib bayar dulu; dapur menerima mendekati jam ambil.
 */
export function PickupToggle({ className }: { className?: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: pickupQueryKey, queryFn: fetchPickup });
  const mutation = useMutation({
    mutationFn: savePickup,
    onSuccess: (enabled) => {
      client.setQueryData(pickupQueryKey, { enabled });
      toast.success(enabled ? "Pickup dibuka" : "Pickup ditutup");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menyimpan"),
  });
  const enabled = query.data?.enabled ?? false;
  const busy = query.isLoading || mutation.isPending;

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ShoppingBag className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Pesanan pickup (ambil di kasir)</div>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Buka — pelanggan bisa pesan & bayar dari aplikasi" : "Tutup — aplikasi menampilkan “Pickup sedang tutup”"}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Buka pesanan pickup"
        disabled={busy || query.isError}
        onClick={() => mutation.mutate(!enabled)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60",
          enabled ? "bg-emerald-500" : "bg-gray-300"
        )}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow transition", enabled ? "translate-x-6" : "translate-x-1")} />
        {mutation.isPending ? <Loader2 className="absolute -left-6 size-4 animate-spin text-muted-foreground" /> : null}
      </button>
    </div>
  );
}
