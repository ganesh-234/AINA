const express = require("express");
const { registerUser, loginUser } = require("../controllers/authControllers");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

router.post("/register", registerUser);
router.post("/login", loginUser);

const googleAuthConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const googleAuthHandler = (req, res, next) => {
  if (!googleAuthConfigured || !passport._strategy("google")) {
    return res.status(503).json({
      message:
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment.",
    });
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    accessType: "offline",
    prompt: "consent",
  })(req, res, next);
};

// Use passport to initiate Google OAuth
router.get("/google", googleAuthHandler);

// Handle OAuth callback
router.get("/google/callback", (req, res, next) => {
  if (!googleAuthConfigured || !passport._strategy("google")) {
    return res.status(503).json({
      message:
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment.",
    });
  }

  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  })(req, res, next);
}, (req, res) => {
  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5175";
  res.redirect(`${clientOrigin}/oauth-success?token=${token}`);
});
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});
// Logout
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

module.exports = router;
