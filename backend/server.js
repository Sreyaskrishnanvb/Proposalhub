require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const Groq    = require('groq-sdk');
const { sequelize, User, Proposal, CourseStructure, Timeline, Budget } = require('./models');

const app    = express();
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

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

// ── REGISTER
app.post('/register', async (req, res) => {
  const { username, email, password, course, doj, role } = req.body;
  try {
    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(400).json({ error: 'Username already taken' });
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
    const user = await User.findOne({ where: { username, course, role } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '1d' }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── SUBMIT PROPOSAL
app.post('/proposals', async (req, res) => {
  const { courseStructure, timeline, budget, ...proposalData } = req.body;
  try {
    const proposal = await Proposal.create(proposalData);

    if (courseStructure?.length)
      await CourseStructure.bulkCreate(courseStructure.map(r => ({ ...r, proposalId: proposal.id })));

    if (timeline?.length)
      await Timeline.bulkCreate(timeline.map(r => ({ ...r, proposalId: proposal.id })));

    if (budget?.length)
      await Budget.bulkCreate(budget.map(r => ({ ...r, proposalId: proposal.id })));

    res.json({ message: 'Proposal submitted', id: proposal.id });
  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Error saving proposal' });
  }
});

// ── GET ALL PROPOSALS
app.get('/proposals', async (req, res) => {
  try {
    const proposals = await Proposal.findAll({
      include: [
        { model: CourseStructure },
        { model: Timeline },
        { model: Budget },
        { model: User, attributes: ['username', 'email'] }
      ]
    });
    res.json(proposals);
  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Error fetching proposals' });
  }
});

// ── UPDATE STATUS
app.patch('/proposals/:id', async (req, res) => {
  try {
    await Proposal.update({ status: req.body.status }, { where: { id: req.params.id } });
    res.json({ message: 'Status updated' });
  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Error updating status' });
  }
});

// ── VERIFY TOKEN
app.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, SECRET);
    res.json({ valid: true, username: decoded.username, role: decoded.role });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── CHAT
app.post('/chat', async (req, res) => {
  const { proposalId, message } = req.body;
  try {
    const proposal = await Proposal.findByPk(proposalId, {
      include: [{ model: CourseStructure }, { model: Timeline }, { model: Budget }]
    });
    if (!proposal) return res.status(404).json({ reply: 'Proposal not found.' });

    const prompt = `
You are a proposal review assistant.

Company standards:
${COMPANY_STANDARD}

Proposal data:
${JSON.stringify(proposal, null, 2)}

Faculty question: "${message}"

Answer professionally and reference the actual proposal content.
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch(err) {
    console.log(err);
    res.status(500).json({ reply: 'Error contacting AI.' });
  }
});

// ── EXTRACT
app.post('/extract', async (req, res) => {
  const { prompt } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ result: completion.choices[0].message.content });
  } catch(err) {
    console.log(err);
    res.status(500).json({ result: '{}' });
  }
});

// ── START SERVER
sequelize.sync({ alter: true })
  .then(() => {
    app.listen(process.env.PORT || 5000, () => console.log('Server Running'));
    console.log('PostgreSQL Connected & Tables Synced');
  })
  .catch(err => console.log('DB Error:', err));