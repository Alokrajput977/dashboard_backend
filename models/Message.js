// models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  receiver: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: String,
    default: () =>
      new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
  },
  // Track who has “deleted” this message
  deletedBy: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

export default mongoose.model('Message', messageSchema);
