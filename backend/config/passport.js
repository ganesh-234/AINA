const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
require("dotenv").config();

// Only initialize Google OAuth strategy if credentials are provided.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Try to find user by googleId first
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            // If not found, try to find by email
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
              // If found by email, add googleId and avatar if missing
              user.googleId = profile.id;
              user.avatar = profile.photos[0].value;
              await user.save();
            } else {
              // If not found at all, create new user
              user = await User.create({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value,
              });
            }
          }
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  // If Google OAuth is not configured, log a short warning but continue.
  /* eslint-disable no-console */
  console.warn(
    "Google OAuth not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable social login."
  );
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
