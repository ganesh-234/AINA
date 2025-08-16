require("dotenv").config(); // Optional safeguard

const { InferenceClient } = require("@huggingface/inference");
const Conversation = require("../models/Conversation");
const hf = new InferenceClient(process.env.API_KEY);
const mongoose = require("mongoose");

const createConversation = async (req, res) => {
  try {
    const { userId: bodyUserId } = req.body;

    // 1) Determine userId from auth middleware or request body
    const userId = req.user?.id || bodyUserId;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No userId provided" });
    }

    // 2) Create a new conversation document
    const newConversation = new Conversation({
      userId,
      title: "Untitled Conversation",
      messages: [],
    });

    // 3) Save it to the database
    await newConversation.save();

    // 4) Return the new conversation
    res.status(201).json({ conversation: newConversation });
  } catch (error) {
    console.error("createConversation error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
};

async function genmerateTherapyResponse(historyMessages, userMessage) {
  // 1) System prompt
  const systemMessage = {
    role: "system",
    content: process.env.PROMPT,
  };

  // 2) Combine system prompt, past messages, and the new user message
  const messages = [
    systemMessage,
    ...historyMessages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.replace(/\n/g, " "),
    })),
    { role: "user", content: userMessage },
  ];

  // 3) Call the Hugging Face chatCompletion API
  const result = await hf.chatCompletion({
    model: "mistralai/Mistral-7B-Instruct-v0.3",
    messages,
    max_tokens: 200,
    temperature: 0.7,
    repetition_penalty: 1.2,
  });

  // 4) Extract and return the assistant’s reply
  return result.choices?.[0]?.message?.content ?? "";
}

const sendMessage = async (req, res) => {
  try {
    const { conversationId, message, userId: bodyUserId } = req.body;

    // 1) Determine userId (from auth middleware or body)
    const userId = req.user?.id || bodyUserId;
    if (!userId) {
      return res.status(401).json({ error: "No userId provided" });
    }

    // 2) Validate required fields
    if (!conversationId || !message) {
      return res
        .status(400)
        .json({ error: "Missing conversationId or message" });
    }

    // 3) Load the conversation (scoped to this user)
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // 4) Generate AI response
    const aiText = await genmerateTherapyResponse(
      conversation.messages,
      message
    );

    // 5) Append both user and AI messages to history and save
    conversation.messages.push(
      { role: "user", content: message },
      { role: "Aina", content: aiText }
    );
    await conversation.save();

    // 6) Return the assistant’s reply
    res.json({ response: aiText });
  } catch (error) {
    console.error("sendMessage error:", error);
    res.status(500).json({ error: error.message });
  }
};
const getConversation = async (req, res) => {
  console.log(req);
  try {
    const userId = mongoose.Types.ObjectId.createFromHexString(req.params.id);
    const conversation = await Conversation.find({ userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      message: "Conversation fetched",
      conversation,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
const getSingleConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const singleconversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user.id,
    });
    if (!singleconversation) {
      res
        .status(401)
        .json({ message: "Chat doesnot exist or you don't have access to it" });
    }
    res.status(200).json({
      message: "Conversation fetched sucessfully",
      singleconversation,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const editChatTitle = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const editedTitle = req.body.title;

    if (!editedTitle || !editedTitle.trim()) {
      return res.status(400).json({ message: "Title is Required" });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user.id,
    });
    if (!conversation) {
      return res.status(400).josn({ message: "Conversation not found" });
    }
    //update the title
    conversation.title = editedTitle;
    await conversation.save();

    res
      .status(200)
      .json({ message: "Title updated sucessfully", conversation });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
const deleteSingleConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user.id,
    });
    if (!conversation) {
      return res.status(400).json({ message: "Chat not found" });
    }
    const deleteChat = await Conversation.findByIdAndDelete(conversationId);
    if (!deleteChat) {
      return res.status(400).json({ message: "Chat not found" });
    }
    res.status(200).json({ message: "Chat Deleted Sucessfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  createConversation,
  sendMessage,
  getConversation,
  getSingleConversation,
  editChatTitle,
  deleteSingleConversation,
};
