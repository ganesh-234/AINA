const express = require("express");
const path = require("path");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const passport = require("passport");
const session = require("express-session");

const envPath = path.resolve(__dirname, ".env.local");
const defaultEnvPath = path.resolve(__dirname, ".env");
const loadedEnvPath = require("fs").existsSync(envPath) ? envPath : defaultEnvPath;
console.log("[server] loading env from", loadedEnvPath);
dotenv.config({ path: loadedEnvPath });
require("./config/passport");
const authRoute = require("./routes/authRoutes");
const chatRoute = require("./routes/chatRoutes");
const reportRoute = require("./routes/reportRoutes");

const app = express();
const port = process.env.PORT || 5000;

connectDB();

const trustProxy =
  process.env.TRUST_PROXY === "1" ||
  process.env.TRUST_PROXY === "true" ||
  process.env.TRUST_PROXY === "yes";
if (trustProxy) {
  app.set("trust proxy", 1);
}

// --- Security headers ---
app.use(
  helmet({
    contentSecurityPolicy: false, // this is a JSON API; the SPA sets its own CSP
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// --- Request logging ---
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// --- Body parsing ---
app.use(express.json({ limit: "5mb" }));

// --- Session + Passport ---
const sessionSecret = process.env.SESSION_SECRET || "secret";
if (!process.env.SESSION_SECRET) {
  console.warn("WARNING: SESSION_SECRET is not set. This is insecure for production.");
}
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production", sameSite: "lax" },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// --- CORS ---
const allowedOrigins = new Set([process.env.CLIENT_ORIGIN || "http://localhost:5175"]);
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || localhostOriginPattern.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"));
      }
    },
    credentials: true,
  })
);

// --- Global API rate limit (a safety net; per-endpoint limits are stricter) ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_MAX || "600", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});
app.use("/api", apiLimiter);

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/reports", reportRoute);

app.get("/", (req, res) => {
  res.send("API Running....");
});

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// --- Centralized error handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && /CORS/.test(err.message || "")) {
    return res.status(403).json({ error: "CORS policy violation" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  console.error("[error]", err && err.stack ? err.stack : err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(port, () => {
  console.log(`Server Running at port ${port}`);
});
