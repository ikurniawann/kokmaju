import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CUT_AT, FEED_DURATION, FEED_START, FEED_STEPS, printStepTimes } from "./receipt-sound";

const css = readFileSync(path.join(__dirname, "components", "pay-receipt-animation.css"), "utf8");

describe("jadwal suara struk", () => {
  it("satu bunyi motor per hentakan kertas, di dalam rentang keluarnya kertas", () => {
    const times = printStepTimes();
    expect(times).toHaveLength(FEED_STEPS);
    expect(times[0]).toBe(FEED_START);
    expect(times.at(-1)!).toBeLessThan(FEED_START + FEED_DURATION);
    expect(CUT_AT).toBeGreaterThanOrEqual(FEED_START + FEED_DURATION);
  });

  it("selaras dengan animasi CSS (feed, steps, pisau)", () => {
    expect(css).toContain(`prx-feed ${FEED_DURATION}s steps(${FEED_STEPS}, end) ${FEED_START}s`);
    expect(css).toContain(`prx-blade 0.2s ease-in ${CUT_AT}s`);
  });
});
