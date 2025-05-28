const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: String,
  label: String,
  title: String,
  dueDate: String,
  priority: String
}, { _id: false });

const columnSchema = new mongoose.Schema({
  id: String,
  title: String,
  taskIds: [String]
}, { _id: false });

const boardSchema = new mongoose.Schema({
  columns: { type: Map, of: columnSchema },
  tasks: { type: Map, of: taskSchema },
  columnOrder: [String]
});

module.exports = mongoose.model('Board', boardSchema);
