const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files (HTML/CSS)

// Connect to MongoDB Atlas
mongoose.connect('mongodb://localhost:27017/email-reminder-app', {
    // Optional Mongoose/Driver settings for compatibility
    useNewUrlParser: true,
    useUnifiedTopology: true 
})
.then(() => console.log('MongoDB connected successfully.'))
.catch(err => console.log('MongoDB connection error:', err));

// Reminder Schema
const reminderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:MM
  sent: { type: Boolean, default: false }
});
const Reminder = mongoose.model('Reminder', reminderSchema);

// Nodemailer transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Route to handle form submission
app.post('/add-reminder', async (req, res) => {
  const { email, message, date, time } = req.body;
  try {
    const newReminder = new Reminder({ email, message, date, time });
    await newReminder.save();
    res.send('Reminder added successfully! You will receive an email at the scheduled time.');
  } catch (error) {
    res.status(500).send('Error saving reminder: ' + error.message);
  }
});

// Cron job: Check every minute for reminders to send
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  try {
    const reminders = await Reminder.find({ date: currentDate, time: currentTime, sent: false });
    for (const reminder of reminders) {
      // Send email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: reminder.email,
        subject: 'Email Reminder',
        text: reminder.message
      };
      await transporter.sendMail(mailOptions);
      
      // Mark as sent
      reminder.sent = true;
      await reminder.save();
      console.log(`Reminder sent to ${reminder.email}`);
    }
  } catch (error) {
    console.error('Error sending reminder:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});