import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiSun,
  FiMoon,
  FiArrowRight,
  FiHeart,
  FiShield,
  FiUsers,
  FiTarget,
  FiAward,
  FiGlobe,
  FiZap,
} from "react-icons/fi";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";

const About = () => {
  // Theme state
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const values = [
    {
      icon: <FiHeart className="w-6 h-6" />,
      title: "Compassion",
      desc: "We believe in treating every user with empathy and understanding.",
    },
    {
      icon: <FiShield className="w-6 h-6" />,
      title: "Privacy",
      desc: "Your data security and privacy are our top priorities.",
    },
    {
      icon: <FiUsers className="w-6 h-6" />,
      title: "Accessibility",
      desc: "Making mental health support available to everyone, everywhere.",
    },
    {
      icon: <FiTarget className="w-6 h-6" />,
      title: "Innovation",
      desc: "Continuously improving our AI to better serve your needs.",
    },
  ];

  const team = [
    {
      name: "Dr. Sarah Chen",
      role: "Chief Technology Officer",
      bio: "Leading our AI development with 15+ years in machine learning and mental health technology.",
    },
    {
      name: "Marcus Rodriguez",
      role: "Head of Product",
      bio: "Ensuring our platform meets the highest standards for user experience and mental health support.",
    },
    {
      name: "Dr. Emily Watson",
      role: "Clinical Director",
      bio: "Overseeing the clinical aspects of our AI training and ensuring ethical mental health practices.",
    },
  ];

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
            About{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
              Aina
            </span>
          </motion.h1>
          <motion.p
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            We're on a mission to make mental health support accessible,
            compassionate, and available 24/7 through the power of AI.
          </motion.p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Our{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
                  Mission
                </span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                At Aina, we believe that everyone deserves access to mental
                health support. Our AI companion is designed to provide a safe,
                judgment-free space where you can explore your thoughts, track
                your emotional journey, and find the support you need, whenever
                you need it.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                We combine cutting-edge artificial intelligence with deep
                understanding of mental health to create an experience that
                feels human, compassionate, and truly helpful.
              </p>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to="/features"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 text-white px-6 py-3 rounded-lg shadow hover:shadow-lg transition-all duration-300 font-medium"
                >
                  Learn About Our Features <FiArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ x: 40, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900 dark:to-pink-900 p-8 rounded-2xl">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                      <FiHeart className="w-6 h-6 text-orange-500 dark:text-orange-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        Compassionate Care
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        AI trained with empathy and understanding
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
                      <FiShield className="w-6 h-6 text-pink-500 dark:text-pink-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Privacy First</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Your conversations are secure and private
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <FiGlobe className="w-6 h-6 text-purple-500 dark:text-purple-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        Always Available
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        24/7 support whenever you need it
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2
              className="text-3xl sm:text-4xl font-bold mb-6"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
                Values
              </span>
            </motion.h2>
            <motion.p
              className="text-lg text-gray-600 dark:text-gray-300"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              These core principles guide everything we do at Aina.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                className="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center text-orange-500 dark:text-orange-300">
                  {value.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {value.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2
              className="text-3xl sm:text-4xl font-bold mb-6"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Meet Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
                Team
              </span>
            </motion.h2>
            <motion.p
              className="text-lg text-gray-600 dark:text-gray-300"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              The passionate individuals behind Aina's mission to revolutionize
              mental health support.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 text-center"
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center text-2xl font-bold text-orange-500 dark:text-orange-300">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                <p className="text-orange-500 dark:text-orange-300 font-medium mb-4">
                  {member.role}
                </p>
                <p className="text-gray-600 dark:text-gray-300">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <div className="text-3xl sm:text-4xl font-bold text-orange-500 dark:text-orange-300 mb-2">
                10K+
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                Active Users
              </div>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="text-3xl sm:text-4xl font-bold text-orange-500 dark:text-orange-300 mb-2">
                50K+
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                Conversations
              </div>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="text-3xl sm:text-4xl font-bold text-orange-500 dark:text-orange-300 mb-2">
                99.9%
              </div>
              <div className="text-gray-600 dark:text-gray-300">Uptime</div>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="text-3xl sm:text-4xl font-bold text-orange-500 dark:text-orange-300 mb-2">
                24/7
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                Support Available
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
              Join Our Mission
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Be part of the revolution in mental health support. Start your
              journey with Aina today.
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

export default About;
