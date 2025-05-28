const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const User    = require('../models/user');
const { verifyToken } = require('../middleware/auth');
const router  = express.Router();
const secretKey = process.env.JWT_SECRET;

// ── Signup ──
router.post('/signup', async (req, res) => {
  try {
    const { fullName, username, email, password, role, department } = req.body;
    // check duplicates
    if (await User.findOne({ $or: [{ username }, { email }] }))
      return res.status(400).json({ message: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    await new User({ fullName, username, email, password: hash, role, department }).save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// ── Login ──
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      secretKey,
      { expiresIn: '200h' }
    );
    res.json({
      token,
      role: user.role,
      username: user.username,
      message: 'Login successful'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ── Get All Users (protected) ──
router.get('/', verifyToken, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

module.exports = router;
