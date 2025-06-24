import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import Message from "../models/Message.js";

const router = express.Router();

// Fetch conversation with :userId
router.get("/:userId", protectRoute, async (req, res) => {
  const me = req.user._id;
  const them = req.params.userId;
  const msgs = await Message.find({
    $or: [
      { sender: me,    receiver: them },
      { sender: them,  receiver: me   }
    ]
  }).sort("createdAt");
  res.json(msgs);
});

// Send & save message
router.post("/", protectRoute, async (req, res) => {
  const { receiver, text, image, time } = req.body;
  const sender = req.user._id;
  const msg = await Message.create({ sender, receiver, text, image, time });
  res.status(201).json(msg);
});

export default router;
