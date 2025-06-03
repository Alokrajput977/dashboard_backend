// server.js
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const fs         = require('fs');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const mongoose   = require('mongoose');
const path       = require('path');

// ── Models ───────────────────────────────────────────────────────────────────
const User = require('./models/user.js');

// ── Constants & Config ───────────────────────────────────────────────────────
const PORT       = process.env.PORT || 5000;
const MONGO_URI  = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const DATA_FILE  = path.join(__dirname, 'boardData.json');

// ── App Setup ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://dashboard-frontenddd.onrender.com']
}));
app.use(express.json());

// ── 1. Connect to MongoDB ────────────────────────────────────────────────────
mongoose.connect(MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ── 2. Auth Middleware ───────────────────────────────────────────────────────
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

// ── 3. User Auth Routes ──────────────────────────────────────────────────────

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, username, email, password, role, department } = req.body;

    // Duplicate check
    const exist = await User.findOne({ $or: [{ username }, { email }] });
    if (exist) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName, username, email, password: hash, role, department
    });
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
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '200h' }
    );
    return res.json({
      token,
      role: user.role,
      username: user.username,
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// GET /api/users  (protected)
app.get('/api/users',  async (req, res) => {
  try {
    console.log('11')
    const users = await User.find().sort({ createdAt: -1 });
    console.log(users)
    return res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Server error fetching users' });
  }
});

// ── 4. Board & Task Routes (file-based) ─────────────────────────────────────

// GET /api/boards
app.get('/api/boards', verifyToken, (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, raw) => {
    if (err) {
      if (err.code === 'ENOENT') return res.json({}); 
      console.error('Error reading boards file:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    try {
      return res.json(JSON.parse(raw));
    } catch (parseErr) {
      console.error('Error parsing boards JSON:', parseErr);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
});

// PUT /api/boards  (overwrite)
app.put('/api/boards', verifyToken, (req, res) => {
  const data = JSON.stringify(req.body, null, 2);
  fs.writeFile(DATA_FILE, data, 'utf8', err => {
    if (err) {
      console.error('Error writing boards file:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    return res.json({ message: 'Board data saved successfully' });
  });
});

// POST /api/tasks  (create task; managers only)
app.post('/api/tasks', verifyToken, isManager, (req, res) => {
  const { task, columnId } = req.body;
  fs.readFile(DATA_FILE, 'utf8', (err, raw) => {
    if (err) {
      console.error('Error reading board data:', err);
      return res.status(500).json({ message: 'Error reading board data.' });
    }
    try {
      const boardData = JSON.parse(raw);
      boardData.tasks[task.id] = task;
      boardData.columns[columnId].taskIds.push(task.id);
      fs.writeFile(DATA_FILE, JSON.stringify(boardData, null, 2), 'utf8', writeErr => {
        if (writeErr) {
          console.error('Error writing board data:', writeErr);
          return res.status(500).json({ message: 'Error saving board data.' });
        }
        return res.status(201).json(task);
      });
    } catch (parseErr) {
      console.error('Error parsing board data:', parseErr);
      return res.status(500).json({ message: 'Error parsing board data.' });
    }
  });
});

// PUT /api/tasks/:taskId  (update task; managers only)
app.put('/api/tasks/:taskId', verifyToken, isManager, (req, res) => {
  const { taskId } = req.params;
  fs.readFile(DATA_FILE, 'utf8', (err, raw) => {
    if (err) {
      console.error('Error reading board data:', err);
      return res.status(500).json({ message: 'Error reading board data.' });
    }
    try {
      const boardData = JSON.parse(raw);
      if (!boardData.tasks[taskId]) {
        return res.status(404).json({ message: 'Task not found.' });
      }
      boardData.tasks[taskId] = req.body;
      fs.writeFile(DATA_FILE, JSON.stringify(boardData, null, 2), 'utf8', writeErr => {
        if (writeErr) {
          console.error('Error writing board data:', writeErr);
          return res.status(500).json({ message: 'Error saving board data.' });
        }
        return res.json(boardData.tasks[taskId]);
      });
    } catch (parseErr) {
      console.error('Error parsing board data:', parseErr);
      return res.status(500).json({ message: 'Error parsing board data.' });
    }
  });
});

// DELETE /api/tasks/:taskId  (delete task; managers only)
app.delete('/api/tasks/:taskId', verifyToken, isManager, (req, res) => {
  const { taskId } = req.params;
  fs.readFile(DATA_FILE, 'utf8', (err, raw) => {
    if (err) {
      console.error('Error reading board data:', err);
      return res.status(500).json({ message: 'Error reading board data.' });
    }
    try {
      const boardData = JSON.parse(raw);
      if (!boardData.tasks[taskId]) {
        return res.status(404).json({ message: 'Task not found.' });
      }
      delete boardData.tasks[taskId];
      Object.values(boardData.columns).forEach(col => {
        col.taskIds = col.taskIds.filter(id => id !== taskId);
      });
      fs.writeFile(DATA_FILE, JSON.stringify(boardData, null, 2), 'utf8', writeErr => {
        if (writeErr) {
          console.error('Error writing board data:', writeErr);
          return res.status(500).json({ message: 'Error saving board data.' });
        }
        return res.json({ message: 'Task deleted successfully.' });
      });
    } catch (parseErr) {
      console.error('Error parsing board data:', parseErr);
      return res.status(500).json({ message: 'Error parsing board data.' });
    }
  });
});


app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
