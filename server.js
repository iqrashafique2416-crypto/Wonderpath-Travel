require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { attachUser } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_DIR = path.join(__dirname, "..", "site");

// ------------------------------------------------------------------ CORE
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true, // same-origin by default (site is served from this same app)
    credentials: true,
  })
);
app.use(attachUser); // makes req.user available everywhere, never blocks

// ------------------------------------------------------------------- API
app.use("/api/auth", require("./routes/auth"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/saved-tours", require("./routes/savedTours"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/admin", require("./routes/admin"));

// -------------------------------------------------------- STATIC FRONTEND
// The existing WanderPath site (all pages, destinations, tours, gallery,
// animations, etc.) is untouched and served as-is, with the new auth pages
// living alongside it.
app.use(express.static(SITE_DIR));

// Friendly 404 for unknown API routes (keep JSON, don't fall through to HTML)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => {
  console.log(`WanderPath server running: http://localhost:${PORT}`);
});
