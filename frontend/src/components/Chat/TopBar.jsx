import React from "react";
import { FiMenu } from "react-icons/fi";
import { useSelector } from "react-redux";
import ThemeToggleButton from "../ThemeToggleButton";
import { Link } from "react-router-dom";

export default function TopBar({ onToggleSidebar }) {
  const user = useSelector((state) => state.auth);
  const getInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 1);
  return (
    <header className="w-full bg-white border-b shadow-sm dark:bg-gray-900 dark:border-gray-800 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo or App Name */}
        <h1 className="text-2xl hidden md:block font-bold text-orange-600 tracking-tight">
          <Link to="/">Aina</Link>
        </h1>
        {/* Hamburger button dispay on small screens */}
        <button
          className="md:hidden rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onToggleSidebar}
        >
          <FiMenu className="text-2xl" />
        </button>
        <div className="flex items-center space-x-3">
          <ThemeToggleButton />
          <span className="hidden md:inline text-lg font-semibold text-gray-600 dark:text-gray-200">
            Welcome, {user.name.toUpperCase()}
          </span>
          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold">
            {getInitials(user.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
