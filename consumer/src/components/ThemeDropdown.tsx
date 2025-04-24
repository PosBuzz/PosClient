import { BulbFilled, BulbOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Dropdown } from "antd";
import { useEffect, useState } from "react";
import { GrSystem } from "react-icons/gr";
import useThemeDetector from "../hooks/useThemeDetector";

const ThemeDropdown = () => {
  const [selectedOption, setSelectedOption] = useState<
    "dark" | "light" | "system"
  >("system");
  const [hasLoaded, setHasLoaded] = useState(false);
  const isSystemDark = useThemeDetector();

  // Load preference from localStorage once
  useEffect(() => {
    const savedTheme = localStorage.getItem("themeSettings") as
      | "dark"
      | "light"
      | "system"
      | null;
    if (["dark", "light", "system"].includes(savedTheme || "")) {
      setSelectedOption(savedTheme as "dark" | "light" | "system");
    }
    setHasLoaded(true);
  }, []);

  // Apply theme only after initial load
  useEffect(() => {
    if (!hasLoaded) return;

    localStorage.setItem("themeSettings", selectedOption);

    const themeToApply =
      selectedOption === "system"
        ? isSystemDark
          ? "dark"
          : "light"
        : selectedOption;

    document.documentElement.setAttribute("data-theme", themeToApply);
    localStorage.setItem("isDarkMode", String(themeToApply === "dark"));
    window.dispatchEvent(new Event("themeChanged"));
  }, [selectedOption, isSystemDark, hasLoaded]);

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    if (["dark", "light", "system"].includes(e.key)) {
      setSelectedOption(e.key as "dark" | "light" | "system");
    }
  };

  const items: MenuProps["items"] = [
    {
      label: "Dark",
      key: "dark",
      icon: <BulbFilled />,
    },
    {
      label: "Light",
      key: "light",
      icon: <BulbOutlined />,
    },
    {
      label: "System",
      key: "system",
      icon: <GrSystem />,
    },
  ];

  const currentTheme =
    selectedOption === "system"
      ? isSystemDark
        ? "dark"
        : "light"
      : selectedOption;

  return (
    <Dropdown
      menu={{
        items,
        onClick: handleMenuClick,
        selectable: true,
        selectedKeys: [selectedOption],
      }}
      trigger={["click"]}
    >
      <Button
        type="text"
        icon={currentTheme === "dark" ? <BulbFilled /> : <BulbOutlined />}
      />
    </Dropdown>
  );
};

export default ThemeDropdown;
