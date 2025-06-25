// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import messageRoutes from './routes/messages.js';
import http from 'http';
import { Server } from 'socket.io';
import Message from './models/Message.js';  // ← Import your Mongoose model

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // your React app
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// REST API for message history
app.use('/api/messages', messageRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected');
  server.listen(5050, () =>
    console.log('🚀 Server running at http://localhost:5050')
  );
})
.catch(err => console.error('❌ MongoDB connection error:', err));

// Real-time socket handling
io.on('connection', socket => {
  console.log('🟢 A user connected:', socket.id);

  // 1️⃣ Client registers their username
  socket.on('register', username => {
    socket.username = username;
    socket.join(username);
    console.log(`   📥 ${username} joined room: ${username}`);
  });

  // 2️⃣ Chat messages → to specific receiver
  socket.on('send_message', async data => {
    // Relay
    io.to(data.receiver).emit('receive_message', data);
    console.log(
      `   💬 Message from ${data.sender} to ${data.receiver}: "${data.text}"`
    );
    // Persist to DB
    try {
      await Message.create(data);
    } catch (err) {
      console.error('Error saving chat message:', err);
    }
  });

  // 3️⃣ Caller initiates a call
  socket.on('call_user', async ({ to, from }) => {
    // Notify callee
    io.to(to).emit('incoming_call', { from });
    console.log(`   📞 ${from} is calling ${to}`);
    // Save “Call started” as a chat message
    try {
      await Message.create({
        sender: from,
        receiver: to,
        text: '📞 Call started',
      });
    } catch (err) {
      console.error('Error saving call-start message:', err);
    }
  });

  // 4️⃣ Callee accepts the call
  socket.on('accept_call', ({ to, from }) => {
    io.to(to).emit('call_accepted', { from });
    console.log(`   ✅ ${from} accepted call from ${to}`);
    // (optional) you could also save “Call answered” here
  });

  // 5️⃣ Either side ends or declines the call
  socket.on('end_call', async ({ to, from }) => {
    io.to(to).emit('call_ended', { from });
    console.log(`   ❌ ${from} ended call with ${to}`);
    // Save “Call ended” as a chat message
    try {
      await Message.create({
        sender: from,
        receiver: to,
        text: '📞 Call ended',
      });
    } catch (err) {
      console.error('Error saving call-end message:', err);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected:', socket.id);
  });
});
