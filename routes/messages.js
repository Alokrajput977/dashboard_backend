import express from 'express';
import Message from '../models/Message.js';
const router = express.Router();

/**
 * POST   /api/messages
 * Save a new message
 */
router.post('/', async (req, res) => {
  try {
    const msg = new Message(req.body);
    const saved = await msg.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Error saving message' });
  }
});

/**
 * GET    /api/messages/:user1/:user2
 * Fetch all messages between A and B that the current user hasn't deleted
 */
router.get('/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const msgs = await Message.find({
      $or: [
        { sender: user1,   receiver: user2 },
        { sender: user2,   receiver: user1 }
      ],
      // exclude messages that *this* user has deleted
      deletedBy: { $ne: user1 }
    }).sort('createdAt');
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

/**
 * DELETE /api/messages/:deleter/:other
 * “Delete” chat for the user `deleter` (soft delete).
 * If *both* participants have deleted, remove messages permanently.
 */
router.delete('/:deleter/:other', async (req, res) => {
  const { deleter, other } = req.params;

  try {
    // 1) Soft-delete: add deleter to deletedBy on all messages between the two
    await Message.updateMany({
      $or: [
        { sender: deleter, receiver: other },
        { sender: other,   receiver: deleter }
      ]
    }, {
      $addToSet: { deletedBy: deleter }
    });

    // 2) Hard-delete: remove messages where *both* have deleted
    await Message.deleteMany({
      $or: [
        { sender: deleter, receiver: other },
        { sender: other,   receiver: deleter }
      ],
      // both participants in deletedBy
      deletedBy: { $all: [deleter, other] }
    });

    res.status(200).json({ message: 'Chat deleted for you' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting messages' });
  }
});

export default router;
