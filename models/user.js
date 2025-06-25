// models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  fullName:   { type: String, required: true },
  username:   { type: String, required: true, unique: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  role: {
    type: String,
    enum: [
      'employee','manager','sales','marketing',
      'hr','finance','it','operations','admin','support'
    ],
    default: 'employee'
  },
  department: { type: String, required: true },
  avatarUrl:  { type: String, default: '' },       // optional URL for user avatar
  lastMessage:{ type: String, default: '' }        // optional last message preview
}, {
  timestamps: true
});

export default mongoose.model('User', UserSchema);
