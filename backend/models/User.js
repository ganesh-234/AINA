const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a Name"],
    },
    email: {
      type: String,
      required: [true, "Please add a Email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      // required: [true, "Please add a password"],
      minLength: [8, "Password should be 8 characters long"],
      select: false, // it prevenmts exposing the password to other queries by default
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    avatar: {
      type: String,
    },
    image: {
      type: String,
      default:
        "https://img.freepik.com/free-vector/purple-man-with-blue-hair_24877-82003.jpg?t=st=1744053967~exp=1744057567~hmac=b56dbd844c7d7c6e8cd2ff92755e635bfc1d90a7f4e3e742ee343f48a4190d8a&w=900",
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("User", userSchema);
