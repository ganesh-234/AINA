const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    //check user exists
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }
    //salt and hash password
    const salt = await bcrypt.genSalt(10); //10=costfactor
    const hashedPassword = await bcrypt.hash(password, salt);
    //create and save new user
    const newUser = await User.create({
      email: email,
      name: name,
      password: hashedPassword,
    });
    //create json web token(jwt)
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    //return success response
    res.status(200).json({
      message: "User Registered Sucessfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        image: newUser.image,
        createdAt: newUser.createdAt,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "server error" });
  }
};
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    //check user exists

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Invalid Email or Password" });
    }
    //compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Password" });
    }
    //jwt token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    //return sucess message
    res.status(200).json({
      message: "Logged in Sucessfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "server error" });
  }
};
module.exports = { registerUser, loginUser };
