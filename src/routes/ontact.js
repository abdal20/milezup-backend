// In your backend (e.g., routes/contact.js)
app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;
      
      // Send email using nodemailer, SendGrid, etc.
      // Or save to database
      
      res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error sending message' });
    }
  });