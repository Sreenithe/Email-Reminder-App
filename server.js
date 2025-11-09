const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

const reminderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  sent: { type: Boolean, default: false },
});

const Reminder = mongoose.model('Reminder', reminderSchema);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) console.error('Email transporter error:', error);
  else console.log('Email transporter ready');
});

app.post('/add-reminder', async (req, res) => {
  const { email, message, date, time } = req.body;
  try {
    const newReminder = new Reminder({ email, message, date, time });
    await newReminder.save();
    res.send('Reminder added successfully! You will receive an email at the scheduled time.');
  } catch (error) {
    console.error('Error saving reminder:', error);
    res.status(500).send('Error saving reminder: ' + error.message);
  }
});

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  console.log(`Checking reminders at ${currentDate} ${currentTime}`);

  try {
    const reminders = await Reminder.find({ date: currentDate, time: currentTime, sent: false });
    if (reminders.length > 0) {
      console.log(`Found ${reminders.length} reminder(s) to send`);
    }

    for (const reminder of reminders) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: reminder.email,
        subject: 'Email Reminder',
        text: reminder.message,
      };

      await transporter.sendMail(mailOptions);
      reminder.sent = true;
      await reminder.save();
      console.log(`Reminder sent to ${reminder.email}`);
    }
  } catch (error) {
    console.error('Error processing reminders:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
