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

// ===============================
// 📦 MongoDB Connection
// ===============================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ===============================
// 🧩 Mongoose Schema
// ===============================
const reminderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  sent: { type: Boolean, default: false },
});

const Reminder = mongoose.model('Reminder', reminderSchema);

// ===============================
// ✉️ Email Transporter (Gmail)
// ===============================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // use App Password, not Gmail password!
  },
});

transporter.verify((error) => {
  if (error) console.error('❌ Email transporter error:', error);
  else console.log('✅ Email transporter ready');
});

// ===============================
// 🧠 Add Reminder Route
// ===============================
app.post('/add-reminder', async (req, res) => {
  const { email, message, date, time } = req.body;
  try {
    const newReminder = new Reminder({ email, message, date, time });
    await newReminder.save();
    res.send('✅ Reminder added successfully! You will receive an email at the scheduled time.');
  } catch (error) {
    console.error('❌ Error saving reminder:', error);
    res.status(500).send('Error saving reminder: ' + error.message);
  }
});

// ===============================
// 🔄 Reminder Checking Function
// ===============================
async function checkReminders() {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  console.log(`🕐 Checking reminders at ${currentDate} ${currentTime}`);

  try {
    const reminders = await Reminder.find({ date: currentDate, time: currentTime, sent: false });

    if (reminders.length > 0) {
      console.log(`📬 Found ${reminders.length} reminder(s) to send`);
    }

    for (const reminder of reminders) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: reminder.email,
        subject: '⏰ Email Reminder',
        text: reminder.message,
      };

      try {
        await transporter.sendMail(mailOptions);
        reminder.sent = true;
        await reminder.save();
        console.log(`✅ Reminder sent to ${reminder.email}`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${reminder.email}:`, err);
      }
    }
  } catch (error) {
    console.error('❌ Error processing reminders:', error);
  }
}

// ===============================
// 🕒 Local Cron (for dev)
// ===============================
// This runs every minute only when your app is active
cron.schedule('* * * * *', checkReminders);

// ===============================
// 🌐 External Cron Ping Route
// ===============================
// This allows external services (cron-job.org) to trigger reminders
app.get('/check-reminders', async (req, res) => {
  try {
    await checkReminders();
    res.send('✅ Reminders checked successfully!');
  } catch (error) {
    console.error('❌ Error checking reminders (external):', error);
    res.status(500).send('Error checking reminders');
  }
});

// ===============================
// 🚀 Start Server
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
