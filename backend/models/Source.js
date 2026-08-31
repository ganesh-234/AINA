const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Source",
  new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
      title: { type: String, required: true, trim: true },
      content: { type: String, required: true },
      // Each chunk carries an optional semantic embedding for RAG retrieval.
      chunks: [{ index: Number, text: String, embedding: { type: [Number], default: undefined } }],
      // provenance / ingestion metadata
      sourceType: { type: String, enum: ["paste", "pdf", "pdf-ai", "image", "docx", "text", "url", "url-pdf", "file"], default: "paste" },
      originalName: { type: String, default: "" },
      url: { type: String, default: "" },
      pages: { type: Number, default: 0 },
      charCount: { type: Number, default: 0 },
      // Embedding model used for this source's chunk vectors (so we only compare like with like).
      embedModel: { type: String, default: "" },
    },
    { timestamps: true }
  )
);
