import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiMessageSquare,
  FiMic,
  FiLock,
  FiBook,
  FiSun,
  FiMoon,
  FiArrowRight,
  FiCheck,
  FiZap,
  FiTrendingUp,
  FiSmartphone,
  FiHeadphones,
} from "react-icons/fi";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";

const features = [
  {
    icon: <FiMessageSquare className="w-6 h-6" />,
    title: "AI-Powered Chat",
    desc: "Real-time, empathetic conversations powered by advanced AI that understands context and emotions.",
    details: [
      "Natural language processing",
      "Emotional intelligence",
      "Context-aware responses",
      "24/7 availability",
    ],
  },
  {
    icon: <FiMic className="w-6 h-6" />,
    title: "Voice Interaction",
    desc: "Natural voice conversations with seamless switching between text and voice modes.",
    details: [
      "Speech-to-text conversion",
      "Text-to-speech output",
      "Voice emotion detection",
      "Multi-language support",
    ],
  },
  {
    icon: <FiLock className="w-6 h-6" />,
    title: "Secure & Private",
    desc: "End-to-end encryption ensures your data remains confidential and protected.",
    details: [
      "End-to-end encryption",
      "Data privacy compliance",
      "Secure authentication",
      "Anonymous sessions",
    ],
  },
  {
    icon: <FiBook className="w-6 h-6" />,
    title: "Session History",
    desc: "Track your progress and reflect on your emotional journey with detailed analytics.",
    details: [
      "Conversation history",
      "Mood tracking",
      "Progress analytics",
      "Personal insights",
    ],
  },
  {
    icon: <FiZap className="w-6 h-6" />,
    title: "Real-time Processing",
    desc: "Instant responses with minimal latency for a natural conversation experience.",
    details: [
      "Low latency responses",
      "Real-time analysis",
      "Instant feedback",
      "Smooth interactions",
    ],
  },
  {
    icon: <FiTrendingUp className="w-6 h-6" />,
    title: "Progress Tracking",
    desc: "Monitor your mental health journey with comprehensive progress reports and insights.",
    details: [
      "Weekly reports",
      "Mood patterns",
      "Improvement metrics",
      "Goal setting",
    ],
  },
];

const Feature = () => {
  // Theme state
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 antialiased min-h-screen transition-colors duration-500">
      {/* Theme Toggle Button */}
      <button
        className="fixed top-4 right-4 z-50 bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-full p-2 shadow hover:scale-110 transition-all"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <FiSun className="w-6 h-6 text-orange-400" />
        ) : (
          <FiMoon className="w-6 h-6 text-gray-700" />
        )}
      </button>

      <Navbar />

      {/* Hero Section */}
      <section className="pt-20 pb-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            Powerful Features for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
              Your Wellbeing
            </span>
          </motion.h1>
          <motion.p
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Discover the comprehensive suite of features designed to support
            your mental health journey with cutting-edge AI technology and
            compassionate care.
          </motion.p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-transparent hover:shadow-xl transition-all duration-300 group"
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{ y: -5 }}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center text-orange-500 dark:text-orange-300 mb-6 group-hover:from-orange-200 group-hover:to-pink-200 dark:group-hover:from-orange-800 dark:group-hover:to-pink-800 transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {feature.desc}
                </p>
                <ul className="space-y-2">
                  {feature.details.map((detail, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <FiCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Experience the{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
                  Future
                </span>{" "}
                of Mental Health Support
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                Our advanced AI technology combines natural language processing,
                emotional intelligence, and secure communication to provide you
                with a truly supportive companion experience.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Advanced AI with emotional intelligence
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Multi-platform accessibility
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Real-time conversation analysis
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ x: 40, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900 dark:to-pink-900 p-6 rounded-xl">
                    <FiSmartphone className="w-8 h-8 text-orange-500 dark:text-orange-300 mb-3" />
                    <h3 className="font-semibold mb-2">Mobile Optimized</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Seamless experience across all devices
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 p-6 rounded-xl">
                    <FiHeadphones className="w-8 h-8 text-blue-500 dark:text-blue-300 mb-3" />
                    <h3 className="font-semibold mb-2">Voice Support</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Natural voice interactions
                    </p>
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900 dark:to-teal-900 p-6 rounded-xl">
                    <FiLock className="w-8 h-8 text-green-500 dark:text-green-300 mb-3" />
                    <h3 className="font-semibold mb-2">Privacy First</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      End-to-end encryption
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 p-6 rounded-xl">
                    <FiTrendingUp className="w-8 h-8 text-purple-500 dark:text-purple-300 mb-3" />
                    <h3 className="font-semibold mb-2">Progress Tracking</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Monitor your journey
                    </p>
                  </div>
                </div>
              </div>
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
              Ready to Experience These Features?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Start your journey with Aina and discover how our advanced
              features can support your mental wellbeing.
            </p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 text-white px-8 py-4 rounded-lg shadow hover:shadow-lg transition-all duration-300 font-medium"
              >
                Get Started Now <FiArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Feature;
