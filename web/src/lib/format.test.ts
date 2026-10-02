import { describe, expect, it } from "vitest";
import { initials, roleLabel, timeAgo } from "./format";
import { generatePassword } from "./hooks";
import { newPassword } from "./validation";

describe("format", () => {
  it("builds initials from first and last name", () => {
    expect(initials("Anita Sharma")).toBe("AS");
    expect(initials("Dr. Rajesh Kumar")).toBe("DK");
    expect(initials("Priya")).toBe("P");
    expect(initials("   ")).toBe("?");
  });

  it("labels roles and falls back gracefully", () => {
    expect(roleLabel("school_admin")).toBe("School admin");
    expect(roleLabel("night_warden")).toBe("night warden");
  });

  it("describes recent times as just now", () => {
    const now = new Date("2026-10-02T10:00:00Z");
    expect(timeAgo("2026-10-02T09:59:30Z", now)).toBe("just now");
    expect(timeAgo(null)).toBe("Never");
  });
});

describe("passwords", () => {
  it("generated passwords satisfy the server's rules", () => {
    for (let i = 0; i < 200; i++) {
      expect(newPassword.safeParse(generatePassword()).success).toBe(true);
    }
  });

  it("rejects weak passwords with a helpful message", () => {
    expect(newPassword.safeParse("short1").error?.issues[0].message).toBe("Use at least 8 characters");
    expect(newPassword.safeParse("lettersonly").error?.issues[0].message).toBe("Include both letters and numbers");
    expect(newPassword.safeParse("a1".repeat(40)).success).toBe(false); // > 72 bytes
  });
});
