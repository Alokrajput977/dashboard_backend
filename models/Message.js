import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: String,
  time: {
    type: String,
    default: () =>
      new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
  },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
