import React, { useState, useEffect, useCallback } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";
import ThemeToggleButton from "./ThemeToggleButton";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "About", href: "/about" },
    { name: "Features", href: "/features" },
    { name: "Contact", href: "/contact" },
  ];

  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close mobile menu on resize to desktop
  const handleResize = useCallback(() => {
    if (window.innerWidth >= 768) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  return (
    <nav className="w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 fixed top-0 z-50 transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link
            to="/"
            className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent"
            tabIndex={0}
          >
            Aina
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 transition-colors duration-300 font-medium text-base lg:text-lg px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                tabIndex={0}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/login"
              className="ml-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 text-white rounded-lg shadow hover:shadow-md transition-all duration-300 font-medium text-base lg:text-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              tabIndex={0}
            >
              Get Started
            </Link>
            {/* Theme Toggle Button */}
            <ThemeToggleButton className="ml-2" />
          </div>

          {/* Mobile menu button and theme toggle */}
          <div className="md:hidden flex items-center">
            {/* Theme Toggle Button (mobile) */}
            <ThemeToggleButton className="mr-2" />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors duration-300"
              aria-label="Toggle menu"
              tabIndex={0}
            >
              {isOpen ? (
                <FiX className="h-6 w-6" />
              ) : (
                <FiMenu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation & Backdrop */}
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 top-0 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "block" : "hidden"
        }`}
        style={{ zIndex: 48 }}
        aria-hidden={!isOpen}
        onClick={() => setIsOpen(false)}
      />
      {/* Mobile Menu */}
      <div
        className={`md:hidden fixed left-0 right-0 top-0 h-screen bg-white/95 dark:bg-gray-900/95 shadow-lg transition-transform duration-300 ${
          isOpen ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ zIndex: 49 }}
        aria-hidden={!isOpen}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-md text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white/80 dark:bg-gray-900/80 shadow"
          aria-label="Close menu"
        >
          <FiX className="h-6 w-6" />
        </button>
        <div className="pt-20 px-4 pb-8 space-y-3 flex flex-col min-h-[calc(100vh-4rem)]">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
              tabIndex={isOpen ? 0 : -1}
            >
              {link.name}
            </Link>
          ))}
          <Link
            to="/login"
            className="block w-full text-center px-3 py-3 rounded-md text-base font-medium text-white bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 shadow hover:shadow-md transition-all duration-300 mt-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
            tabIndex={isOpen ? 0 : -1}
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
