import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowRight,
  FiSun,
  FiMoon,
  FiUsers,
  FiShield,
  FiHeart,
} from "react-icons/fi";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";

const Home = () => {
  // Theme state
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 antialiased min-h-screen transition-colors duration-500 md:pt-0 pt-12 md:text-start text-center">
      {/* Theme Toggle Button */}
      <button
        className="fixed top-4 right-4 z-50 bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-full p-2 shadow hover:scale-110 transition-all"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          {theme === "dark" ? (
            <motion.span
              key="sun"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FiSun className="w-6 h-6 text-orange-400" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FiMoon className="w-6 h-6 text-gray-700" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <Navbar />

      {/* Hero Section */}
      <section className="relative flex flex-col lg:flex-row items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 lg:py-28 gap-12">
        {/* Text Content */}
        <motion.div
          className="w-full lg:w-1/2 space-y-6"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 60, delay: 0.1 }}
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
            Your Personal{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
              AI Therapy
            </span>{" "}
            Companion
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl">
            A safe space to explore your thoughts, track your mood, and grow
            with compassionate AI support. Experience real-time conversations
            that understand and support your mental wellbeing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 text-white px-6 py-3.5 rounded-lg shadow hover:shadow-lg transition-all duration-300 font-medium"
              >
                Get Started <FiArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/features"
                className="inline-flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-6 py-3.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 font-medium"
              >
                Learn More
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Illustration */}
        <motion.div
          className="w-full lg:w-1/2 flex justify-center"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 60, delay: 0.2 }}
        >
          <div className="relative w-full max-w-md aspect-square">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 rounded-[2rem] rotate-6"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950 dark:to-pink-950 rounded-[2rem] -rotate-3"></div>
            <img
              src="/icon.png"
              alt="Aina AI Companion"
              className="relative w-full h-full object-contain drop-shadow-xl rounded-[2rem]"
            />
          </div>
        </motion.div>
      </section>

      {/* Key Benefits Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Why Choose{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
                Aina
              </span>
            </motion.h2>
            <motion.p
              className="text-lg text-gray-600 dark:text-gray-300"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              Experience the future of mental health support with our innovative
              AI companion.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              className="text-center"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center">
                <FiUsers className="w-8 h-8 text-orange-500 dark:text-orange-300" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Always Available</h3>
              <p className="text-gray-600 dark:text-gray-300">
                24/7 support whenever you need someone to talk to, without
                judgment or waiting.
              </p>
            </motion.div>

            <motion.div
              className="text-center"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center">
                <FiShield className="w-8 h-8 text-orange-500 dark:text-orange-300" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Completely Private</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your conversations are encrypted and secure, ensuring your
                privacy is protected.
              </p>
            </motion.div>

            <motion.div
              className="text-center"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center">
                <FiHeart className="w-8 h-8 text-orange-500 dark:text-orange-300" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Empathetic Support</h3>
              <p className="text-gray-600 dark:text-gray-300">
                AI trained to understand emotions and provide compassionate,
                helpful responses.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900 dark:to-pink-900 transition-colors duration-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-gray-900 p-8 md:p-10 rounded-2xl shadow-lg"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to Begin Your Journey?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands who've found support through compassionate AI
              conversations. Start your mental health journey today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 text-white px-8 py-4 rounded-lg shadow hover:shadow-lg transition-all duration-300 font-medium"
                >
                  Start Talking Now <FiArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to="/about"
                  className="inline-flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-8 py-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 font-medium"
                >
                  Learn About Us
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
