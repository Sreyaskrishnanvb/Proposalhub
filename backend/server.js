require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Groq = require("groq-sdk"); 
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const User   = require('./models/User');
const SECRET = process.env.JWT_SECRET;
const app = express();

app.use(cors());
app.use(express.json());
const Question = require("./models/Question");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const COMPANY_STANDARD = `                               
A proposal meets company standard if it has:
1. Clear and specific problem statement
2. Measurable and realistic objectives
3. Defined scope (in and out of scope)
4. A proper methodology (Agile, Waterfall, etc.)
5. Tools and technologies mentioned
6. Team composition defined
7. Concrete expected outcome
8. Future enhancements section
9. Minimum 100 words in introduction
10. References cited
`;


mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));
// Extract fields from uploaded document text
app.post("/extract", async (req, res) => {
  const { prompt } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }]
    });
    const result = completion.choices[0].message.content;
    res.json({ result });
  } catch (err) {
    console.log(err);
    res.status(500).json({ result: "{}" });
  }
});
// ── REGISTER
app.post('/register', async (req, res) => {
  const { username, email, password, course, doj, role } = req.body;

  try {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(400).json({
        error: existing.username === username
          ? 'Username already taken'
          : 'Email already registered'
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashed, course, doj, role });

    res.json({ message: 'Registered successfully' });

  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});
// ── LOGIN
app.post('/login', async (req, res) => {
  const { username, password, course, role } = req.body;

  try {
    const user = await User.findOne({ username, course, role });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, username: user.username, role: user.role });

  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post("/Questions", async (req, res) => {
   console.log(req.body);
   try {
      const newQuestion = await Question.create(req.body);
      res.json(newQuestion);
   } catch(err) {
      console.log(err);
      res.status(500).json(err);

   }

});
app.get("/Questions", async (req, res) => {
   try {
      const questions = await Question.find({}).lean();
      questions.forEach(q => {
         q._id = q._id.toString();
         if (!q.status) q.status = 'pending'; // ← add default status
      });
      res.json(questions);
   } catch(err) {
      res.status(500).json(err);
   }
});
app.patch("/Questions/:id", async (req, res) => {
  try {
    const updated = await Question.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(updated);
  } catch(err) {
    console.log(err);
    res.status(500).json(err);
  }
});
app.post("/chat", async (req, res) => {
   const { proposalId, message } = req.body;

   try {
      const proposal = await Question.findById(proposalId).lean();
      if (!proposal) return res.status(404).json({ reply: "Proposal not found." });
      proposal._id = proposal._id.toString();

      const prompt = `
You are a proposal review assistant.

Company standards:
${COMPANY_STANDARD}

Proposal data from database:
${JSON.stringify(proposal, null, 2)}

Faculty question: "${message}"

Answer professionally and reference the actual proposal content.
`;

      const completion = await groq.chat.completions.create({
         model:"llama-3.3-70b-versatile",
         messages: [{ role: "user", content: prompt }]
      });

      const reply = completion.choices[0].message.content;
      res.json({ reply });

   } catch(err) {
      console.log(err);
      res.status(500).json({ reply: "Error contacting AI." });
   }
});
app.listen(process.env.PORT || 5000, () => {
   console.log("Server Running");
});