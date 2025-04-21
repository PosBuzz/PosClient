import { BulbFilled, BulbOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Dropdown } from "antd";
import { useEffect, useState } from "react";
import { GrSystem } from "react-icons/gr";
import useThemeDetector from "../hooks/useThemeDetector";

const ThemeDropdown = ({
  isDarkMode,
  setIsDarkMode,
}: {
  isDarkMode: boolean | undefined;
  setIsDarkMode: (mode: boolean) => void;
}) => {
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
    if (
      savedTheme === "dark" ||
      savedTheme === "light" ||
      savedTheme === "system"
    ) {
      setSelectedOption(savedTheme);
    }
    setHasLoaded(true);
  }, []);

  // Apply theme only after initial load
  useEffect(() => {
    if (!hasLoaded) return;

    localStorage.setItem("themeSettings", selectedOption);

    if (selectedOption === "system") {
      setIsDarkMode(isSystemDark);
      document.documentElement.setAttribute(
        "data-theme",
        isSystemDark ? "dark" : "light"
      );
    } else if (selectedOption === "dark") {
      document.documentElement.setAttribute("data-theme", selectedOption);
      setIsDarkMode(true);
    } else {
      document.documentElement.setAttribute("data-theme", selectedOption);
      setIsDarkMode(false);
    }
  }, [selectedOption, isSystemDark, setIsDarkMode, hasLoaded]);

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
        icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
      />
    </Dropdown>
  );
};

export default ThemeDropdown;
