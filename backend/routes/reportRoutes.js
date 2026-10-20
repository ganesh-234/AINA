const router = require("express").Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const auth = require("../middlewares/auth");
const c = require("../controllers/reportControllers");

// In-memory upload: keep the request bounded so a single account cannot
// exhaust server memory before extraction begins. Deployments can tune these
// limits through environment variables.
const maxUploadFiles = parseInt(process.env.REPORT_UPLOAD_MAX_FILES || "8", 10);
const maxUploadBytes = parseInt(process.env.REPORT_UPLOAD_MAX_FILE_BYTES || String(15 * 1024 * 1024), 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: maxUploadFiles },
});

function uploadFiles(req, res, next) {
  upload.array("files", maxUploadFiles)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return res.status(413).json({ error: `Upload rejected: ${error.message}` });
    }
    return next(error);
  });
}

// Stricter rate limit for expensive language-model endpoints.
const genLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.GEN_RATE_MAX || "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please wait a moment and try again." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.UPLOAD_RATE_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests. Please wait a moment and try again." },
});

router.use(auth);

// Templates + provider status
router.get("/templates", c.getTemplates);
router.get("/providers", c.getProviders);
router.get("/providers/health", c.getProvidersHealth);

// Sources
router.get("/sources", c.listSources);
router.post("/sources", c.createSource);
router.post("/sources/upload", uploadLimiter, uploadFiles, c.uploadSources);
router.post("/sources/url", c.addSourceFromUrl);
router.delete("/sources/:id", c.deleteSource);

// Reports — generation (rate-limited)
router.post("/generate", genLimiter, c.generateReport);
router.post("/generate/stream", genLimiter, c.generateReportStream);
router.post("/batch", genLimiter, c.generateBatch);
router.post("/batch/stream", genLimiter, c.generateBatchStream);
router.post("/ask", genLimiter, c.askDocuments);

// Reports — reads + management
router.get("/", c.listReports);
router.get("/:id/export", c.exportReport);
router.patch("/:id", c.renameReport);
router.post("/:id/duplicate", c.duplicateReport);
router.delete("/:id", c.deleteReport);
router.get("/:id", c.getReport);

module.exports = router;
