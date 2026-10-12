import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Opens an antd Select and picks the option whose title is `label`. */
export async function selectAntdOption(
  user: UserEvent,
  combobox: HTMLElement,
  label: string,
) {
  await user.click(combobox);
  const option = await screen.findByTitle(label);
  await user.click(option);
}

export const inField = (root: HTMLElement) => within(root);
