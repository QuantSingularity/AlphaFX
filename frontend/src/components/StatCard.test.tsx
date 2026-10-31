import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("renders the label and the value", () => {
    render(<StatCard label="Spot EUR/USD" value="1.0842" />);

    expect(screen.getByText("Spot EUR/USD")).toBeInTheDocument();
    expect(screen.getByText("1.0842")).toBeInTheDocument();
  });

  it("omits the sub line when no sub text is given", () => {
    const { container } = render(<StatCard label="Pairs" value={42} />);

    // label + value only
    expect(container.querySelectorAll("span")).toHaveLength(2);
  });

  it.each([
    ["up", "up"],
    ["down", "down"],
    ["neutral", "neutral"],
    [undefined, "neutral"],
  ] as const)("maps trend %s to the %s style", (trend, expectedClass) => {
    render(
      <StatCard label="P&L" value="1.2%" sub="vs yesterday" trend={trend} />,
    );

    expect(screen.getByText("vs yesterday")).toHaveClass(expectedClass);
  });
});
