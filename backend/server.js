const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const authRoute = require("./routes/authRoutes");
const cors = require("cors");
const chatRoute = require("./routes/chatRoutes");
const tssRoute = require("./routes/tssRoutes");
const passport = require("passport");
const session = require("express-session");
require("./config/passport");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

connectDB();

app.use(express.json());

// 1. Session middleware FIRST
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // true only with HTTPS
  })
);

// 2. Passport middleware NEXT
app.use(passport.initialize());
app.use(passport.session());

// 3. CORS (if needed)
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// 4. THEN your routes
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/tts", tssRoute);

//default route
app.get("/", (req, res) => {
  res.send("API Running....");
});

app.listen(port, () => {
  console.log(`Server Running at port ${port}`);
});
