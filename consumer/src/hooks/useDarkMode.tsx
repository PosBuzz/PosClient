import { useEffect, useState } from "react";

const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("isDarkMode") === "true";
  });

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(localStorage.getItem("isDarkMode") === "true");
    };

    window.addEventListener("storage", syncTheme);
    window.addEventListener("themeChanged", syncTheme); // for same-tab changes

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("themeChanged", syncTheme);
    };
  }, []);

  return isDarkMode;
};

export default useDarkMode;
