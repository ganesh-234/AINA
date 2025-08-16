import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiSun,
  FiMoon,
  FiArrowRight,
  FiMail,
  FiPhone,
  FiMapPin,
  FiMessageSquare,
  FiClock,
  FiSend,
  FiCheck,
} from "react-icons/fi";
import Navbar from "../components/Navbar";

const Contact = () => {
  // Theme state
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });

      // Reset success message after 5 seconds
      setTimeout(() => setIsSubmitted(false), 5000);
    }, 2000);
  };

  const contactInfo = [
    {
      icon: <FiMail className="w-6 h-6" />,
      title: "Email",
      value: "support@aina.com",
      desc: "Get in touch with our support team",
    },
    {
      icon: <FiPhone className="w-6 h-6" />,
      title: "Phone",
      value: "+1 (555) 123-4567",
      desc: "Call us during business hours",
    },
    {
      icon: <FiMapPin className="w-6 h-6" />,
      title: "Office",
      value: "San Francisco, CA",
      desc: "Visit our headquarters",
    },
    {
      icon: <FiClock className="w-6 h-6" />,
      title: "Support Hours",
      value: "24/7 Available",
      desc: "Our AI is always ready to help",
    },
  ];

  const supportTopics = [
    {
      title: "Technical Support",
      desc: "Help with app functionality and technical issues",
    },
    {
      title: "Account Management",
      desc: "Questions about your account and settings",
    },
    {
      title: "Privacy & Security",
      desc: "Information about data protection and privacy",
    },
    {
      title: "Feature Requests",
      desc: "Suggestions for new features and improvements",
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
            Get in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600">
              Touch
            </span>
          </motion.h1>
          <motion.p
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Have questions or need support? We're here to help. Reach out to our
            team and we'll get back to you as soon as possible.
          </motion.p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, index) => (
              <motion.div
                key={info.title}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center"
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900 flex items-center justify-center text-orange-500 dark:text-orange-300">
                  {info.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{info.title}</h3>
                <p className="text-orange-500 dark:text-orange-300 font-medium mb-2">
                  {info.value}
                </p>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {info.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Contact Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6">Send us a Message</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                Fill out the form below and we'll get back to you within 24
                hours.
              </p>

              {isSubmitted && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-3"
                >
                  <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-800 dark:text-green-200">
                    Message sent successfully! We'll get back to you soon.
                  </span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium mb-2"
                    >
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium mb-2"
                    >
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium mb-2"
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="What's this about?"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium mb-2"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                    placeholder="Tell us how we can help..."
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-orange-500 to-pink-500 dark:from-orange-400 dark:to-pink-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message <FiSend className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>

            {/* Support Topics */}
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6">How can we help?</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                Choose from our most common support topics or send us a custom
                message.
              </p>

              <div className="space-y-4">
                {supportTopics.map((topic, index) => (
                  <motion.div
                    key={topic.title}
                    className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 transition-all cursor-pointer"
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold mb-2">{topic.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                          {topic.desc}
                        </p>
                      </div>
                      <FiArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900 dark:to-pink-900 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <FiMessageSquare className="w-6 h-6 text-orange-500 dark:text-orange-300" />
                  <h3 className="font-semibold text-lg">Live Chat Available</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                  Need immediate help? Our AI assistant is available 24/7 for
                  instant support.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-orange-500 dark:bg-orange-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Start Chat
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Quick answers to common questions about Aina.
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                question: "How does Aina protect my privacy?",
                answer:
                  "We use end-to-end encryption and never share your conversations with third parties. Your data is stored securely and you have full control over your information.",
              },
              {
                question: "Is Aina a replacement for therapy?",
                answer:
                  "Aina is designed to provide emotional support and companionship, but it's not a replacement for professional therapy. We recommend seeking professional help for serious mental health concerns.",
              },
              {
                question: "How accurate is the AI's emotional understanding?",
                answer:
                  "Our AI is trained on extensive mental health data and continuously improves. However, it's designed to provide support rather than clinical diagnosis.",
              },
              {
                question: "Can I use Aina on multiple devices?",
                answer:
                  "Yes! Your account syncs across all your devices, so you can continue conversations seamlessly from anywhere.",
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-gray-600 dark:text-gray-300">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
