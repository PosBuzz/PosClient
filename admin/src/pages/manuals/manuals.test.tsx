import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import Manuals from ".";

it("[AD-MANUAL-001] both manuals can be opened and downloaded from the admin app", () => {
  renderWithProviders(<Manuals />);
  for (const [title, filename] of [
    ["Shop App Manual", "PosBuzz-Shop-App-Manual.pdf"],
    ["Admin Panel Manual", "PosBuzz-Admin-Manual.pdf"],
  ]) {
    const open = screen.getByRole("link", { name: `Open ${title} PDF` });
    expect(open).toHaveAttribute("href", `/manual/${filename}`);
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");
    const download = screen.getByRole("link", {
      name: `Download ${title} PDF`,
    });
    expect(download).toHaveAttribute("href", `/manual/${filename}`);
    expect(download).toHaveAttribute("download", filename);
    expect(
      existsSync(resolve(__dirname, `../../../public/manual/${filename}`)),
    ).toBe(true);
  }
});
