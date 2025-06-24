// backend/routes/auth.route.js
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/Users.js";

const router = express.Router();
const isProd = process.env.NODE_ENV === "production";

const generateToken = (id) =>
  jwt.sign({ userId: id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
  });

// ── SIGNUP ─────────────────────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ fullName, email, password });
    const token = generateToken(user._id);

    res
      .cookie("jwt", token, {
        httpOnly: true,
        sameSite: "none",      // allow cross-site
        secure: isProd,        // HTTPS-only in production
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── LOGIN ──────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    res
      .cookie("jwt", token, {
        httpOnly: true,
        sameSite: "none",
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── LOGOUT ─────────────────────────────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res
    .clearCookie("jwt", {
      sameSite: "none",
      secure: isProd,
    })
    .json({ message: "Logged out" });
});

export default router;
