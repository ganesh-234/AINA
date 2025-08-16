import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiUser,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowLeft,
} from "react-icons/fi";
import Navbar from "../components/Navbar";
import { registerUser } from "../../services/axios.service";
import { errorToast, successToast } from "../../services/toast.service";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await registerUser("api/auth/register", formData);
      console.log(response);
      successToast(`Welcome OnBoard ${response.user.name}`);
    } catch (error) {
      console.log(error);
      errorToast(error.response.data.message);
    }
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-500">
      <Navbar />
      <motion.div
        className="flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="w-full max-w-md space-y-8">
          {/* Decorative floating elements */}
          <motion.div
            className="absolute top-1/3 left-1/4 w-16 h-16 rounded-full bg-orange-100 opacity-40"
            animate={{
              y: [0, -15, 0],
              x: [0, 5, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-20 h-20 rounded-full bg-pink-100 opacity-40"
            animate={{
              y: [0, 15, 0],
              x: [0, -5, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />

          <motion.div className="text-center" variants={item}>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200 mb-4"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back to home
            </Link>

            <motion.h1
              className="text-3xl font-bold leading-tight mb-2"
              whileHover={{ scale: 1.01 }}
            >
              Join{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
                Aina
              </span>
            </motion.h1>
            <p className="text-gray-600">
              Begin your emotional wellness journey
            </p>
          </motion.div>

          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 transition-colors duration-500"
            variants={item}
            whileHover={{
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <form className="space-y-6" onSubmit={handleSubmit}>
              <motion.div className="space-y-5" variants={container}>
                <motion.div variants={item}>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-5 w-5 text-gray-400" />
                    </div>
                    <motion.input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                      placeholder="Your name"
                      whileFocus={{
                        backgroundColor: "rgba(255, 255, 255, 1)",
                        scale: 1.01,
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div variants={item}>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiMail className="h-5 w-5 text-gray-400" />
                    </div>
                    <motion.input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                      placeholder="your@email.com"
                      whileFocus={{
                        backgroundColor: "rgba(255, 255, 255, 1)",
                        scale: 1.01,
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div variants={item}>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <motion.input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                      placeholder="••••••••"
                      whileFocus={{
                        backgroundColor: "rgba(255, 255, 255, 1)",
                        scale: 1.01,
                      }}
                    />
                    <motion.button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showPassword ? (
                        <FiEyeOff className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                      ) : (
                        <FiEye className="h-5 w-5 text-gray-500 hover:text-gray-700" />
                      )}
                    </motion.button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Minimum 8 characters with at least one number
                  </p>
                </motion.div>
              </motion.div>

              <motion.div variants={item}>
                <motion.button
                  type="submit"
                  className="w-full flex justify-center items-center py-3 px-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium rounded-lg shadow hover:shadow-md transition-all"
                  whileHover={{
                    scale: 1.01,
                    boxShadow: "0 4px 14px -2px rgba(249, 115, 22, 0.5)",
                  }}
                  whileTap={{ scale: 0.99 }}
                >
                  Create Account
                </motion.button>
              </motion.div>
            </form>

            <motion.div
              className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300"
              variants={item}
            >
              <p>
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-orange-600 hover:text-orange-500"
                >
                  Sign in
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
