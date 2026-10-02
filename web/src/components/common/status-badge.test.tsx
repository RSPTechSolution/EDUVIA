import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("maps known statuses to a tone and capitalises the label", () => {
    render(<StatusBadge status="unpaid" />);
    const badge = screen.getByText("Unpaid");
    expect(badge.className).toContain("text-destructive");
  });

  it("renders unknown statuses neutrally", () => {
    render(<StatusBadge status="on_hold" />);
    expect(screen.getByText("On hold").className).toContain("text-muted-foreground");
  });
});
