import React from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "./ThemeContext";

const ThemeToggleButton = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className={`p-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${className}`}
      onClick={toggleTheme}
      aria-label="Toggle theme"
      tabIndex={0}
      type="button"
    >
      {theme === "dark" ? (
        <FiSun className="w-5 h-5 text-orange-400" />
      ) : (
        <FiMoon className="w-5 h-5 text-gray-700" />
      )}
    </button>
  );
};

export default ThemeToggleButton;
