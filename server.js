// ───────────────────────────────────────────────────────
// server.js (ESM version)
// ───────────────────────────────────────────────────────

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import User from './models/user.js';

dotenv.config();

const PORT       = process.env.PORT || 5000;
const MONGO_URI  = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// __dirname workaround in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_FILE  = path.join(__dirname, 'boardData.json');

// ── App Setup ─────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://dashboard-frontenddd.onrender.com']
}));
app.use(express.json());

// ── 1. Connect to MongoDB ─────────────────────────────────
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ── 2. Auth Middleware ────────────────────────────────────
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token  = header.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

const isManager = (req, res, next) => {
  if (req.user?.role === 'manager' || req.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Managers only' });
};

// ── 3. User Routes ────────────────────────────────────────

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, username, email, password, role, department } = req.body;
    const exist = await User.findOne({ $or: [{ username }, { email }] });
    if (exist) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, username, email, password: hash, role, department });
    await newUser.save();
    return res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error in signup:', err);
    return res.status(500).json({ message: 'Server error during signup' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '200h' }
    );
    return res.json({ token, role: user.role, username: user.username, message: 'Login successful' });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Server error fetching users' });
  }
});

// ── 4. Board & Task Routes ───────────────────────────────

// GET /api/boards
app.get('/api/boards', verifyToken, async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return res.json(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') return res.json({});
    console.error('Error reading board file:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT /api/boards
app.put('/api/boards', verifyToken, async (req, res) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    return res.json({ message: 'Board data saved successfully' });
  } catch (err) {
    console.error('Error writing board data:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /api/tasks
app.post('/api/tasks', verifyToken, isManager, async (req, res) => {
  const { task, columnId } = req.body;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const boardData = JSON.parse(raw);
    boardData.tasks[task.id] = task;
    boardData.columns[columnId].taskIds.push(task.id);
    await fs.writeFile(DATA_FILE, JSON.stringify(boardData, null, 2), 'utf8');
    return res.status(201).json(task);
  } catch (err) {
    console.error('Error saving new task:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT /api/tasks/:taskId
app.put('/api/tasks/:taskId', verifyToken, isManager, async (req, res) => {
  const { taskId } = req.params;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const boardData = JSON.parse(raw);
    if (!boardData.tasks[taskId]) return res.status(404).json({ message: 'Task not found' });
    boardData.tasks[taskId] = req.body;
    await fs.writeFile(DATA_FILE, JSON.stringify(boardData, null, 2), 'utf8');
    return res.json(boardData.tasks[taskId]);
  } catch (err) {
    console.error('Error updating task:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /api/tasks/:taskId
app.delete('/api/tasks/:taskId', verifyToken, isManager, async (req, res) => {
  const { taskId } = req.params;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const boardData = JSON.parse(raw);
    if (!boardData.tasks[taskId]) return res.status(404).json({ message: 'Task not found' });
    delete boardData.tasks[taskId];
    for (const col of Object.values(boardData.columns)) {
      col.taskIds = col.taskIds.filter(id => id !== taskId);
    }
    await fs.writeFile(DATA_FILE, JSON.stringify(boardData, null, 2), 'utf8');
    return res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
