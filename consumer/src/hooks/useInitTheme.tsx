import { useEffect } from "react";
import useThemeDetector from "./useThemeDetector";

const useInitTheme = () => {
  const isSystemDark = useThemeDetector();

  useEffect(() => {
    const savedTheme = localStorage.getItem("themeSettings") as
      "dark" | "light" | "system" | null;

    const themeToApply =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : isSystemDark
          ? "dark"
          : "light";

    document.documentElement.setAttribute("data-theme", themeToApply);
    localStorage.setItem("isDarkMode", String(themeToApply === "dark"));

    // Dispatch the event after a small delay to ensure it's properly caught
    setTimeout(() => {
      window.dispatchEvent(new Event("themeChanged"));
    }, 0);
  }, [isSystemDark]); // re-run when system theme changes
};

export default useInitTheme;
