import { fireEvent, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import CompanyLogo from "./CompanyLogo";

const CDN = "https://res.cloudinary.com/demo/image/upload";
const LOGO = `${CDN}/v1/posbuzz/wide-logo.png`;
const ICON = `${CDN}/v1/posbuzz/icon.png`;
const sized = (url: string) =>
  url.replace("/upload/", "/upload/e_trim/c_fit,w_72,h_72/f_auto,q_auto/");

it("[CO-LOGO-003] small spots show the app icon, else the logo, sized for the spot, else initials", () => {
  const { unmount } = renderWithProviders(<CompanyLogo size={36} />, {
    user: { company_name: "Rahman Store", logo: LOGO, logo_icon: ICON },
  });
  expect(screen.getByRole("img")).toHaveAttribute("src", sized(ICON));
  unmount();

  const second = renderWithProviders(<CompanyLogo size={36} />, {
    user: { company_name: "Rahman Store", logo: LOGO, logo_icon: null },
  });
  expect(screen.getByRole("img")).toHaveAttribute("src", sized(LOGO));
  second.unmount();

  renderWithProviders(<CompanyLogo size={36} />, {
    user: { company_name: "Rahman Store", logo: null, logo_icon: null },
  });
  expect(
    screen.getByRole("img", { name: "Rahman Store logo" }),
  ).toHaveTextContent("RS");
});

it("[CO-LOGO-004] a variant that fails to load falls back to the original image, then initials", () => {
  renderWithProviders(<CompanyLogo size={36} />, {
    user: { company_name: "Rahman Store", logo: LOGO, logo_icon: null },
  });
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveAttribute("src", LOGO);
  fireEvent.error(screen.getByRole("img"));
  expect(
    screen.getByRole("img", { name: "Rahman Store logo" }),
  ).toHaveTextContent("RS");
});
