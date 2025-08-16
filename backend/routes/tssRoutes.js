const express = require("express");
const auth = require("../middlewares/auth");
const { generateSpeech } = require("../controllers/ttsControllers");
const router = express.Router();

router.post("/generate", auth, generateSpeech);

module.exports = router;
