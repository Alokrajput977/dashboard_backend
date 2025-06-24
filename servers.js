// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import messageRoutes from './routes/messages.js';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();
const app = express();
const server = http.createServer(app); // Wrap express in http server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // Frontend origin
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.use('/api/messages', messageRoutes);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');
  server.listen(5050, () => console.log(`🚀 Server running at http://localhost:5050`));
}).catch(err => console.error('❌ MongoDB connection error:', err));

// 💬 Real-time socket handling
io.on('connection', (socket) => {
  console.log('🟢 A user connected');

  socket.on('send_message', (data) => {
    // Send to receiver only
    socket.broadcast.emit('receive_message', data); // You can customize room-based later
  });

  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected');
  });
});
