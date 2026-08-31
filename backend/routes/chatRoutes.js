const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const chatControllers = require("../controllers/chatControllers");

// Protected send endpoint
router.post("/create", auth, chatControllers.createConversation);
router.post("/send", auth, chatControllers.sendMessage);
router.get("/getchats/:id", auth, chatControllers.getConversation);
router.get("/onechat/:id", auth, chatControllers.getSingleConversation);
router.put("/edit/:id", auth, chatControllers.editChatTitle);
router.delete("/delete/:id", auth, chatControllers.deleteSingleConversation);

module.exports = router;
