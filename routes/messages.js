import express from 'express';
import Message from '../models/Message.js';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const msg = new Message(req.body);
    const saved = await msg.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Error saving message' });
  }
});

router.get('/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const msgs = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort('createdAt');
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

export default router;
