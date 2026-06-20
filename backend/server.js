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
PROGRAMME PROPOSAL EVALUATION STANDARDS
========================================

1. PROGRAMME OVERVIEW
   - Clear programme name, category, and purpose
   - Identified target audience and eligibility criteria
   - Defined delivery mode (online/offline/hybrid) and duration
   - Programme fee structure with payment schedule

2. OBJECTIVES & OUTCOMES
   - Minimum 5 specific, measurable programme objectives
   - Defined Programme Outcomes (POs) mapped to courses
   - Clear benefits to students (academic, professional, career)

3. COURSE STRUCTURE
   - Complete curriculum with course titles, levels, hours, and credits
   - Detailed syllabus per course with lecture topics and lab components
   - Course Outcomes (COs) defined and mapped to POs
   - Assessment scheme with weightage (assignments, exams, practicals)

4. PLAN OF EXECUTION
   - Organising structure with roles and responsibilities defined
   - Programme timeline with all key milestones and dates
   - Programme Coordinator responsibilities clearly listed
   - Application and selection process described
   - Infrastructure and software support confirmed

5. BUDGET & FINANCIALS
   - Revenue projection (fee × expected students)
   - Complete expenditure estimate with all heads
   - Revenue distribution plan (faculty, admin, institution)
   - Guest faculty honorarium rates defined
   - Break-even analysis included
   - Key assumptions stated

6. QUALITY INDICATORS
   - Introduction of at least 100 words
   - No vague or undefined terms
   - All tables complete with no empty required cells
   - Submission date and authorized signatory present
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
// ── SUBMIT PROPOSAL  (replace existing route in server.js)
app.post('/proposals', async (req, res) => {
  const { courseStructure, timeline, budget, ...proposalData } = req.body;

  // Also extract the named table fields that script.js sends
  const {
    durationTable, curriculumTable, assessmentTable, orgStructureTable,
    revenueTable, expenditureTable, revDistTable, honorariumTable, breakevenTable,
    timelineTable, syllabusCourses,
    ...coreData
  } = proposalData;

  try {
    const proposal = await Proposal.create({ ...coreData, syllabusCourses: JSON.stringify(syllabusCourses || []) });

    // Helper: converts a 2-D array to CourseStructure / Timeline / Budget rows
    function tableToRows(tableData, tableKey, proposalId) {
      if (!tableData || !tableData.length) return [];
      return tableData.flatMap((row, rowIndex) =>
        (Array.isArray(row) ? row : [row]).map((value, colIndex) => ({
          proposalId, tableKey, rowIndex, colIndex, value: String(value ?? '')
        }))
      );
    }

    const csRows = [
      ...tableToRows(durationTable,     'durationTable',     proposal.id),
      ...tableToRows(curriculumTable,   'curriculumTable',   proposal.id),
      ...tableToRows(assessmentTable,   'assessmentTable',   proposal.id),
      ...tableToRows(orgStructureTable, 'orgStructureTable', proposal.id),
    ];
    if (csRows.length) await CourseStructure.bulkCreate(csRows);

    const tlRows = tableToRows(timelineTable, 'timelineTable', proposal.id);
    if (tlRows.length) await Timeline.bulkCreate(tlRows);

    const bgRows = [
      ...tableToRows(revenueTable,     'revenueTable',     proposal.id),
      ...tableToRows(expenditureTable, 'expenditureTable', proposal.id),
      ...tableToRows(revDistTable,     'revDistTable',     proposal.id),
      ...tableToRows(honorariumTable,  'honorariumTable',  proposal.id),
      ...tableToRows(breakevenTable,   'breakevenTable',   proposal.id),
    ];
    if (bgRows.length) await Budget.bulkCreate(bgRows);

    res.json({ message: 'Proposal submitted', id: proposal.id });
  } catch(err) {
    console.log(err);
    res.status(500).json({ error: 'Error saving proposal' });
  }
});


// ── GET ALL PROPOSALS  (replace existing route in server.js)
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

    // Map DB rows back to the flat shape the frontend expects
    const shaped = proposals.map(p => {
      const raw = p.toJSON();

      // Helper: pull rows for a given tableKey stored in CourseStructures
      const cs = (raw.CourseStructures || []);
      const tl = (raw.Timelines || []);
      const bg = (raw.Budgets || []);

      // CourseStructures stores: { tableKey, rowIndex, colIndex, value }
      function extractTable(rows, key) {
        const filtered = rows.filter(r => r.tableKey === key);
        if (!filtered.length) return [];
        const maxRow = Math.max(...filtered.map(r => r.rowIndex));
        const result = [];
        for (let i = 0; i <= maxRow; i++) {
          const rowCells = filtered.filter(r => r.rowIndex === i).sort((a, b) => a.colIndex - b.colIndex);
          if (rowCells.length) result.push(rowCells.map(c => c.value || ''));
        }
        return result;
      }

      return {
        ...raw,
        // Flatten associations into the names script.js reads
        durationTable:     extractTable(cs, 'durationTable'),
        curriculumTable:   extractTable(cs, 'curriculumTable'),
        assessmentTable:   extractTable(cs, 'assessmentTable'),
        orgStructureTable: extractTable(cs, 'orgStructureTable'),
        revenueTable:      extractTable(bg, 'revenueTable'),
        expenditureTable:  extractTable(bg, 'expenditureTable'),
        revDistTable:      extractTable(bg, 'revDistTable'),
        honorariumTable:   extractTable(bg, 'honorariumTable'),
        breakevenTable:    extractTable(bg, 'breakevenTable'),
        timelineTable:     extractTable(tl, 'timelineTable'),
        // Remove raw associations from response to keep payload clean
        CourseStructures: undefined,
        Timelines: undefined,
        Budgets: undefined,
      };
    });

    res.json(shaped);
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
You are a senior academic proposal reviewer at a university continuing education centre.

EVALUATION STANDARDS:
${COMPANY_STANDARD}

PROPOSAL SUBMITTED FOR REVIEW:
${JSON.stringify(proposal, null, 2)}

REVIEWER'S QUESTION: "${message}"

Instructions:
- Answer based strictly on the actual proposal content above
- Reference specific sections, numbers, or values from the proposal when relevant
- If something is missing or weak, state it clearly and explain why it matters
- If something is strong, acknowledge it
- Be concise, professional, and constructive
- Do not make up information not present in the proposal
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