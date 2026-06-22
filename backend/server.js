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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const COMPANY_STANDARD = `
PROPOSAL REVIEW CHECKLIST
==========================

QUALITY STANDARDS (check these first):
- Programme name, category, and purpose are clearly stated
- Introduction is at least 100 words and well-written
- Submission date and authorized signatory are present
- No vague or undefined terms used anywhere

COURSE STRUCTURE & SYLLABUS (primary focus):
- Curriculum table lists all courses with title, level, hours, and credits
- Each course has clearly defined Course Outcomes (COs)
- COs are mapped to Programme Outcomes (POs)
- Lecture topics are listed for each course
- Laboratory/practical component is described for each course
- Assessment scheme has clear weightage (CA vs CEA)
- Total credits and hours are consistent across sections
`;

// ── REGISTER
app.post('/register', async (req, res) => {
  const { username, email, password, course, doj, role } = req.body;
  try {
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(400).json({ error: 'Username already taken' });

    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashed, course, doj, role });
    res.json({ message: 'Registered successfully' });
  } catch(err) {
    console.error('Register error:', err.message);
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
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── SUBMIT PROPOSAL
app.post('/proposals', async (req, res) => {
  const { courseStructure, timeline, budget, ...proposalData } = req.body;

  const {
    durationTable, curriculumTable, assessmentTable, orgStructureTable,
    revenueTable, expenditureTable, revDistTable, honorariumTable, breakevenTable,
    timelineTable, syllabusCourses,
    ...coreData
  } = proposalData;

  try {
    const proposal = await Proposal.create({
      ...coreData,
      syllabusCourses: JSON.stringify(syllabusCourses || [])
    });

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
    console.error('Submit proposal error:', err.message);
    res.status(500).json({ error: 'Error saving proposal' });
  }
});

// ── GET ALL PROPOSALS
app.get('/proposals', async (req, res) => {
  try {
    const proposals = await Proposal.findAll({
      attributes: [
        'id','category','status','submittedAt',
        'programmeName','submittedBy','designation',
        'submissionDate','submittedTo','aboutProgramme',
        'eligibility','programmeFee','objectives1','benefits',
        'programmeOutcomes','assessmentNotes','coordinatorResp',
        'selectionProcess','infrastructure','budgetNotes',
        'syllabusCourses','createdAt','updatedAt'
      ]
    });

    const shaped = await Promise.all(proposals.map(async (p) => {
      const raw = p.toJSON();

      const [csRows, tlRows, bgRows] = await Promise.all([
        CourseStructure.findAll({ where: { proposalId: raw.id } }),
        Timeline.findAll({        where: { proposalId: raw.id } }),
        Budget.findAll({          where: { proposalId: raw.id } }),
      ]);

      function extractTable(rows, key) {
        const filtered = rows.filter(r => r.tableKey === key);
        if (!filtered.length) return [];
        const maxRow = Math.max(...filtered.map(r => r.rowIndex));
        const result = [];
        for (let i = 0; i <= maxRow; i++) {
          const rowCells = filtered
            .filter(r => r.rowIndex === i)
            .sort((a, b) => a.colIndex - b.colIndex);
          if (rowCells.length) result.push(rowCells.map(c => c.value || ''));
        }
        return result;
      }

      let syllabusCourses = [];
      try {
        if (raw.syllabusCourses)
          syllabusCourses = JSON.parse(raw.syllabusCourses);
      } catch { syllabusCourses = []; }

      return {
        ...raw,
        syllabusCourses,
        durationTable:     extractTable(csRows, 'durationTable'),
        curriculumTable:   extractTable(csRows, 'curriculumTable'),
        assessmentTable:   extractTable(csRows, 'assessmentTable'),
        orgStructureTable: extractTable(csRows, 'orgStructureTable'),
        revenueTable:      extractTable(bgRows, 'revenueTable'),
        expenditureTable:  extractTable(bgRows, 'expenditureTable'),
        revDistTable:      extractTable(bgRows, 'revDistTable'),
        honorariumTable:   extractTable(bgRows, 'honorariumTable'),
        breakevenTable:    extractTable(bgRows, 'breakevenTable'),
        timelineTable:     extractTable(tlRows, 'timelineTable'),
      };
    }));

    res.json(shaped);
  } catch(err) {
    console.error('Error fetching proposals:', err.message);
    res.status(500).json({ error: 'Error fetching proposals' });
  }
});

// ── UPDATE STATUS
app.patch('/proposals/:id', async (req, res) => {
  try {
    await Proposal.update({ status: req.body.status }, { where: { id: req.params.id } });
    res.json({ message: 'Status updated' });
  } catch(err) {
    console.error('Update status error:', err.message);
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
      attributes: [
        'id','programmeName','submittedBy','designation',
        'submissionDate','submittedTo','aboutProgramme',
        'eligibility','programmeFee','objectives1','benefits',
        'programmeOutcomes','assessmentNotes','coordinatorResp',
        'selectionProcess','infrastructure','budgetNotes',
        'status','category','syllabusCourses'
      ]
    });
    if (!proposal) return res.status(404).json({ reply: 'Proposal not found.' });

    const raw = proposal.toJSON();

    let syllabusCourses = [];
    try {
      if (raw.syllabusCourses) syllabusCourses = JSON.parse(raw.syllabusCourses);
    } catch { syllabusCourses = []; }

    const proposalSummary = `
Programme: ${raw.programmeName || 'Not provided'}
Submitted By: ${raw.submittedBy || 'Not provided'} (${raw.designation || 'Not provided'})
Submitted To: ${raw.submittedTo || 'Not provided'}
Category: ${raw.category || 'Not provided'}
Status: ${raw.status || 'Not provided'}
About: ${raw.aboutProgramme || 'Not provided'}
Eligibility: ${raw.eligibility || 'Not provided'}
Fee: ${raw.programmeFee || 'Not provided'}
Objectives: ${raw.objectives1 || 'Not provided'}
Benefits: ${raw.benefits || 'Not provided'}
Programme Outcomes: ${raw.programmeOutcomes || 'Not provided'}
Coordinator Responsibilities: ${raw.coordinatorResp || 'Not provided'}
Selection Process: ${raw.selectionProcess || 'Not provided'}
Infrastructure: ${raw.infrastructure || 'Not provided'}
Budget Notes: ${raw.budgetNotes || 'Not provided'}
Assessment Notes: ${raw.assessmentNotes || 'Not provided'}
Courses: ${syllabusCourses.map((c, i) => `
  Course ${i + 1}: ${c.title || 'Untitled'}
  Topics: ${c.topics || 'Not provided'}
  Lab Work: ${c.labWork || 'Not provided'}
`).join('')}
`.trim();

    const prompt = `
You are a balanced academic proposal reviewer helping a university executive quickly evaluate a programme proposal.

Your job is to focus on two things only:
1. Whether the proposal meets basic quality standards
2. Whether the course structure and syllabus are complete

REVIEW CHECKLIST:
${COMPANY_STANDARD}

PROPOSAL DETAILS:
${proposalSummary}

EXECUTIVE'S QUESTION: "${message}"

How to respond:
- Be concise — 3 to 5 sentences max unless a detailed breakdown is asked
- Only highlight issues that actually matter for approval decisions
- If something looks good, say so briefly and move on
- If something is missing or weak, name it clearly and explain why it matters
- Do not list every minor detail — focus on what would block or support approval
- Use simple professional language, not academic jargon
- If the question is not related to the proposal, politely say you can only help with proposal review
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch(err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ reply: 'Error contacting AI.' });
  }
});

// ── EXTRACT
app.post('/extract', async (req, res) => {
  const { prompt } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ result: completion.choices[0].message.content });
  } catch(err) {
    console.error('Extract error:', err.message);
    res.status(500).json({ result: '{}' });
  }
});

// ── START SERVER
sequelize.sync({ alter: false })
  .then(() => {
    app.listen(process.env.PORT || 5000, () => console.log('Server Running'));
    console.log('PostgreSQL Connected & Tables Synced');
  })
  .catch(err => console.error('DB Error:', err));