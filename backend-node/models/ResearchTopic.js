const mongoose = require('mongoose');

const ResearchTopicSchema = new mongoose.Schema({
  topicName: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Searching', 'Extracting', 'Completed'], 
    default: 'Pending' 
  },
  finalMarkdown: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ResearchTopic', ResearchTopicSchema);