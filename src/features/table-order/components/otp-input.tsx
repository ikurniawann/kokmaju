"use client";

import { useEffect, useRef, useState } from "react";
import "./otp-input.css";

export type OtpStatus = "idle" | "verifying" | "success" | "error";

export const OTP_DIGITS = 6;

/** Ambil maksimal 6 digit angka dari ketikan/tempelan ("123 456", "Kode: 123456"). */
export function sanitizeOtp(raw: string, length = OTP_DIGITS) {
  return raw.replace(/\D/g, "").slice(0, length);
}

/**
 * Input OTP 6 kotak beranimasi (owner 2026-10-11): digit "pop", kotak aktif
 * bercahaya, denyut saat memeriksa, gelombang hijau + centang saat benar,
 * getar merah saat salah. Satu input asli transparan menutupi kotak supaya
 * tempel kode & autofill OTP (one-time-code) berjalan di HP.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  status = "idle",
  disabled = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  status?: OtpStatus;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Setelah salah: fokus kembali supaya bisa langsung ketik ulang.
  useEffect(() => {
    if (status === "error" || status === "idle") inputRef.current?.focus({ preventScroll: true });
  }, [status]);

  const active = Math.min(value.length, OTP_DIGITS - 1);
  const locked = disabled || status === "verifying" || status === "success";

  return (
    <div>
      <div className={`otp ${status}${focused ? " focused" : ""}`}>
        <input
          ref={inputRef}
          className="otp-native"
          value={value}
          onChange={(event) => {
            const next = sanitizeOtp(event.target.value);
            onChange(next);
            if (next.length === OTP_DIGITS) onComplete?.(next);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_DIGITS}
          disabled={locked}
          aria-label={`Kode OTP ${OTP_DIGITS} digit`}
        />
        {Array.from({ length: OTP_DIGITS }, (_, i) => {
          const digit = value[i];
          return (
            <div
              key={i}
              aria-hidden
              className={`otp-box${digit ? " filled" : ""}${i === active && !locked ? " active" : ""}`}
            >
              {/* key per digit → animasi "pop" diputar tiap digit baru */}
              {digit ? <span key={`${i}-${digit}`} className="otp-digit">{digit}</span> : null}
            </div>
          );
        })}
      </div>
      {status === "success" ? (
        <div className="otp-check" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M7.5 12.5l3 3 6-6.5" />
          </svg>
          Berhasil masuk
        </div>
      ) : null}
    </div>
  );
}
