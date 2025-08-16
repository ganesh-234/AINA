const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "Aina"], required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "untitled", required: false },
    messages: {
      type: [messageSchema],
      default: [], // ← makes sure messages is never undefined
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
