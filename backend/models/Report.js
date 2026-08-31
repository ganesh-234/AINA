const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Report",
  new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
      title: { type: String, required: true },
      objective: { type: String, required: true },
      template: { type: String, default: "generic" },
      templateLabel: { type: String, default: "Research report" },
      outline: String,
      content: { type: String, required: true },
      // Passages used to ground the report, for traceability.
      citations: [{ sourceTitle: String, snippet: String, score: Number }],
      retrievalMode: { type: String, default: "" }, // long-context | semantic-rag
      sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Source" }],
      sourceTitles: [{ type: String }],
      status: { type: String, enum: ["complete", "failed"], default: "complete" },
      batchId: { type: String, default: "", index: true },
    },
    { timestamps: true }
  )
);
