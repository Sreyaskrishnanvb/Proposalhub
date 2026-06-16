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

const GROQ_MODEL = 'llama-3.3-70b-versatile';

console.log(`[Groq] Using model: ${GROQ_MODEL}`);

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

// ── GROQ HELPER with retry + rate limit handling ──────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
 
function parseRetryAfterMs(err) {
  try {
    const msg = err?.error?.error?.message || err?.message || '';
    const m   = msg.match(/try again in\s+([\d.]+)s/i);
    if (m) return { ms: Math.ceil(parseFloat(m[1]) * 1000) + 1500, secs: Math.ceil(parseFloat(m[1])) + 2 };
  } catch (_) {}
  return null;
}
 
async function groqChat(messages, maxTokens = 2000) {
  const MAX_RETRIES = 4;
  const BASE_DELAY  = 6000;
 
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model:      GROQ_MODEL,
        max_tokens: maxTokens,
        messages,
      });
      return completion.choices[0].message.content;
    } catch (err) {
      const status  = err?.status;
      const code    = err?.error?.error?.code || err?.code;
      const parsed  = parseRetryAfterMs(err);
      const retryMs = parsed?.ms || BASE_DELAY * Math.pow(2, attempt);
 
      console.error(`[Groq] Attempt ${attempt + 1} failed — status:${status} code:${code}`);
 
      if ((status === 429 || code === 'rate_limit_exceeded') && attempt < MAX_RETRIES - 1) {
        console.log(`[Groq] Rate limit — waiting ${Math.round(retryMs/1000)}s…`);
        await sleep(retryMs);
        continue;
      }
 
      // Attach the parsed retry seconds so the route can forward it
      if (parsed) err._retryAfterSecs = parsed.secs;
      throw err;
    }
  }
  const e = new Error('Groq: max retries exceeded');
  e._retryAfterSecs = 60;
  throw e;
}

// ── REGISTER ──────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { username, email, password, course, doj, role } = req.body;
  try {
    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashed, course, doj, role });
    res.json({ message: 'Registered successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
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
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── SUBMIT PROPOSAL ───────────────────────────────────────────
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
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Error saving proposal' });
  }
});

// ── GET ALL PROPOSALS ─────────────────────────────────────────
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
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Error fetching proposals' });
  }
});

// ── UPDATE STATUS ─────────────────────────────────────────────
app.patch('/proposals/:id', async (req, res) => {
  try {
    await Proposal.update({ status: req.body.status }, { where: { id: req.params.id } });
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Error updating status' });
  }
});

// ── VERIFY TOKEN ──────────────────────────────────────────────
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

// ── CHAT ──────────────────────────────────────────────────────
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

    const reply = await groqChat([{ role: 'user', content: prompt }], 1000);
    res.json({ reply });
  } catch (err) {
    console.error('[/chat]', err?.message || err);
    res.status(500).json({ reply: 'Error contacting AI. Please try again in a moment.' });
  }
});

// ── EXTRACT ───────────────────────────────────────────────────
app.post('/extract', async (req, res) => {
  const { prompt } = req.body;
  try {
    const result = await groqChat([{ role: 'user', content: prompt }], 8000);
    res.json({ result });
  } catch (err) {
    console.error('[/extract]', err?.message || err);
 
    const status = err?.status;
    const code   = err?.error?.error?.code || err?.code;
 
    if (status === 429 || status === 413 || code === 'rate_limit_exceeded') {
      // Parse Groq's retry time and surface it to the browser
      let retrySeconds = err._retryAfterSecs || 15;
      try {
        const msg = err?.error?.error?.message || err?.message || '';
        const m   = msg.match(/try again in\s+([\d.]+)s/i);
        if (m) retrySeconds = Math.ceil(parseFloat(m[1])) + 2;
      } catch (_) {}
 
      console.warn(`[/extract] Forwarding 429 — Retry-After: ${retrySeconds}s`);
      return res
        .status(429)
        .set('Retry-After', String(retrySeconds))
        .json({ result: '{}', retryAfter: retrySeconds });
    }
 
    // Generic server error
    res.status(500).json({ result: '{}' });
  }
});

// ── START SERVER ──────────────────────────────────────────────
sequelize.sync({ alter: true })
  .then(() => {
    app.listen(process.env.PORT || 5000, () => console.log('Server running on port', process.env.PORT || 5000));
    console.log('PostgreSQL connected & tables synced');
  })
  .catch(err => console.log('DB Error:', err));