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
      // Evidence passages used to ground the report. Each generated [Source N]
      // label resolves to one record so the UI can show its source, location,
      // and original excerpt without needing another model call.
      citations: [{
        citationNumber: Number,
        sourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Source" },
        sourceTitle: String,
        chunkIndex: Number,
        page: Number,
        section: String,
        snippet: String,
        excerpt: String,
        score: Number,
        evidenceMatch: String,
      }],
      retrievalMode: { type: String, default: "" }, // long-context | semantic-rag
      generationMode: { type: String, default: "single-pass" }, // single-pass | chained | chained+verified
      sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Source" }],
      sourceTitles: [{ type: String }],
      status: { type: String, enum: ["complete", "failed"], default: "complete" },
      batchId: { type: String, default: "", index: true },
    },
    { timestamps: true }
  )
);
