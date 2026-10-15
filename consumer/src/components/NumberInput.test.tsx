import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import NumberInput from "./NumberInput";

it("[CO-NUMIN-001] leading zeros are dropped as the user types, decimals and zero are kept", async () => {
  const user = userEvent.setup();
  render(<NumberInput />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;

  await user.type(input, "00000000755");
  expect(input.value).toBe("755");

  await user.clear(input);
  await user.type(input, "0.75");
  expect(input.value).toBe("0.75");

  await user.clear(input);
  await user.type(input, "0");
  expect(input.value).toBe("0");
});

it("[CO-NUMIN-002] starts empty and formats to the precision after typing", async () => {
  const user = userEvent.setup();
  render(<NumberInput precision={2} />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  expect(input.value).toBe("");
  await user.type(input, "5");
  await user.tab();
  expect(input.value).toBe("5.00");
});
