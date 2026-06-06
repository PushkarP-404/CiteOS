require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ResearchTopic = require('./models/ResearchTopic');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Initial POST Route for the Frontend
app.post('/api/research', async (req, res) => {
  try {
    const { topicName } = req.body;
    
    if (!topicName) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    // Save to MongoDB
    const newTopic = new ResearchTopic({ topicName });
    await newTopic.save();

    // Fire webhook to n8n asynchronously
    // We do NOT 'await' this, because we want to instantly return a success message 
    // to the React UI while n8n works in the background.
    axios.post(process.env.N8N_WEBHOOK_URL, {
      topicId: newTopic._id,
      topicName: newTopic.topicName
    }).catch(err => {
      console.error("Failed to trigger n8n webhook:", err.message);
    });

    res.status(201).json({ message: 'Research topic saved successfully', data: newTopic });
  } catch (error) {
    res.status(500).json({ error: 'Server configuration error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));