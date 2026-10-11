"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CUSTOMER_SW_URL, needsIosInstallHint } from "@/lib/table-order/pwa";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone() {
  return (
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Daftarkan SW aplikasi pelanggan (scope /pesan) — gagal diam-diam. */
export function registerCustomerSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(CUSTOMER_SW_URL, { scope: "/pesan" }).catch(() => undefined);
}

function subscribeDisplayMode(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener?.("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener?.("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

/**
 * Status pasang aplikasi: Android/Chrome → tombol "Pasang" (beforeinstallprompt);
 * iPhone Safari → panduan manual; sudah terpasang → tidak tampil apa-apa.
 */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const standalone = useStandalone();
  const ios = useSyncExternalStore(
    () => () => undefined,
    () => needsIosInstallHint(navigator.userAgent, false),
    () => false
  );
  const installed = standalone || justInstalled;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setJustInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    installed,
    canPrompt: Boolean(event) && !installed,
    iosHint: ios && !installed,
    async install() {
      if (!event) return false;
      await event.prompt();
      const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" }));
      setEvent(null);
      return choice.outcome === "accepted";
    },
  };
}

/** true bila halaman dibuka sbg aplikasi terpasang (PWA standalone). */
export function useStandalone() {
  return useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
}
