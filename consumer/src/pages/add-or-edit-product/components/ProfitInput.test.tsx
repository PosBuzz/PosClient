import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { round2 } from "../../../utils/number";
import ProfitInput from "./ProfitInput";

// The batch row's flow: cost is fixed, price follows the profit typed
function Harness({ cost }: { cost: number }) {
  const [price, setPrice] = useState<number | null>(null);
  const profit =
    price === null ? undefined : round2(((price - cost) / cost) * 100);
  return (
    <>
      <ProfitInput
        value={profit}
        onChange={(v) =>
          setPrice(v === null ? null : round2(cost * (1 + v / 100)))
        }
      />
      <output data-testid="price">{price === null ? "" : String(price)}</output>
    </>
  );
}

it("[CO-PROFIT-001] typing a profit keeps the typed text and prices to the paisa", async () => {
  const user = userEvent.setup();
  render(<Harness cost={3} />);
  const input = screen.getByRole("spinbutton");
  await user.type(input, "12.34");
  expect((input as HTMLInputElement).value).toBe("12.34");
  // 3 * 1.1234 = 3.3702 -> 3.37, never a long float
  expect(screen.getByTestId("price").textContent).toBe("3.37");
});

it("[CO-PROFIT-002] leading zeros never pile up and a cleared box clears the price", async () => {
  const user = userEvent.setup();
  render(<Harness cost={10} />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  await user.type(input, "00007");
  expect(Number(input.value)).toBe(7);
  expect(input.value).not.toMatch(/^0{2,}/);
  expect(screen.getByTestId("price").textContent).toBe("10.7");
  await user.clear(input);
  expect(screen.getByTestId("price").textContent).toBe("");
});
