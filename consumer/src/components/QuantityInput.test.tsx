import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import QuantityInput from "./QuantityInput";

function Harness({
  onChange,
  max,
}: {
  onChange: (q: number) => void;
  max?: number;
}) {
  const [qty, setQty] = useState(3);
  return (
    <QuantityInput
      name="Shirt"
      value={qty}
      max={max}
      onChange={(q) => {
        onChange(q);
        setQty(q);
      }}
    />
  );
}
const box = () => screen.getByRole("spinbutton") as HTMLInputElement;

describe("QuantityInput", () => {
  it("[CO-QTY-001] can be cleared and retyped without snapping to 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.clear(box());
    expect(box().value).toBe("");
    expect(onChange).not.toHaveBeenCalled();
    await user.type(box(), "5");
    expect(box().value).toBe("5");
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it("[CO-QTY-002] typing 0 reports nothing and blur restores the last quantity", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.clear(box());
    await user.type(box(), "0");
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(box().value).toBe("3");
  });

  it("[CO-QTY-003] a value above max is not reported", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} max={10} />);
    await user.clear(box());
    await user.type(box(), "12");
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(onChange).not.toHaveBeenCalledWith(12);
  });
});
