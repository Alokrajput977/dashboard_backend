import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/Users.js";

const router = express.Router();
router.use(protectRoute);

// GET /api/users — all users except yourself
router.get("/", async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select(
      "fullName email"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
