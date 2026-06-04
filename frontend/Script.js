/* ════════════════════════════════════════
   ProposalHub — script.js
════════════════════════════════════════ */

/* ─────────────────────────────
   SESSION CHECK
───────────────────────────── */
const currentRole     = localStorage.getItem('ph_role');
const currentUsername = localStorage.getItem('ph_username');

if (!currentRole) window.location.href = 'login.html';

const badges = {
  student:     '🎓 Student',
  coordinator: '📋 Course Coordinator',
  executive:   '🏢 Executive',
};
document.getElementById('roleBadge').textContent =
  `${badges[currentRole] || currentRole} · ${currentUsername}`;

function logout() {
  localStorage.removeItem('ph_role');
  localStorage.removeItem('ph_username');
  localStorage.removeItem('ph_token');
  window.location.href = 'login.html';
}

/* ─────────────────────────────
   STATE
───────────────────────────── */
let proposals    = [];
let selectedIdx  = null;
let selectedProposalId = null;
let currentStep  = 1;

/* ─────────────────────────────
   PAGE NAVIGATION
───────────────────────────── */
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (name === 'faculty') loadProposalsFromDB();
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
}

window.addEventListener('DOMContentLoaded', () => {
  if (currentRole === 'executive') {
    showPage('faculty');
    loadProposalsFromDB();
  } else {
    // student or coordinator → show category selection first
    showPage('category');
  }
  updateStepBar();
});
/* ─────────────────────────────
   CATEGORY SELECTION
───────────────────────────── */
let selectedCategory = null;

function selectCategory(el) {
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedCategory = el.dataset.cat;
  document.getElementById('catError').textContent = '';
}

function proceedToForm() {
  if (!selectedCategory) {
    document.getElementById('catError').textContent = '⚠️ Please select a category to continue.';
    return;
  }

  // Show selected category badge on form
  const labels = {
    '1': 'Category I — Diploma / PG Diploma',
    '2': 'Category II — EEP',
    '3': 'Category III — FDP',
    '4': 'Category IV — Seminars / Workshops',
    '5': 'Category V — Conferences',
  };

  // Insert badge into form page if not already there
  const hero = document.querySelector('.page-hero');
  let badge = document.getElementById('catBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'catBadge';
    badge.className = 'selected-cat-badge';
    hero.parentNode.insertBefore(badge, hero.nextSibling);
  }
  badge.textContent = '📁 ' + labels[selectedCategory];

  showPage('student');
}
/* ─────────────────────────────
   STEP NAVIGATION
───────────────────────────── */
function nextStep(from) {
  if (!validateStep(from)) return;
  goToStep(from + 1);
}

function prevStep(from) {
  goToStep(from - 1);
}

function goToStep(step) {
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  currentStep = step;
  document.getElementById(`step-${currentStep}`).classList.add('active');
  updateStepBar();
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function updateStepBar() {
  document.querySelectorAll('.step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (n === currentStep) s.classList.add('active');
    else if (n < currentStep) s.classList.add('done');
  });
}

/* ─────────────────────────────
   VALIDATION
───────────────────────────── */
function validateStep(step) {
  let valid = true;
  const stepFields = {
    1: ['studentName','studentId','department','academicYear','proposalTitle','projectType','duration'],
    2: ['introduction','problemStatement','objectives','scopeOfWork'],
    3: ['methodologies','tools','teamComposition'],
    4: ['expectedOutcome','futureEnhancements'],
  };
  stepFields[step].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value.trim()) { el.classList.add('error'); valid = false; }
    else el.classList.remove('error');
  });
  if (step === 4) {
    const decl = document.getElementById('declaration');
    if (!decl.checked) { alert('Please check the declaration box.'); valid = false; }
  }
  if (!valid) shakeForm();
  return valid;
}

function shakeForm() {
  const activeStep = document.querySelector('.form-step.active');
  activeStep.style.animation = 'none';
  activeStep.offsetHeight;
  activeStep.style.animation = 'shake 0.4s ease';
}

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}
  }`;
document.head.appendChild(shakeStyle);

/* ─────────────────────────────
   CHARACTER COUNTERS
───────────────────────────── */
const counterMap = {
  introduction:'cnt-intro', problemStatement:'cnt-prob',
  objectives:'cnt-obj', scopeOfWork:'cnt-scope',
  methodologies:'cnt-meth', tools:'cnt-tools',
  expectedOutcome:'cnt-out', futureEnhancements:'cnt-fut', references:'cnt-ref',
};
Object.entries(counterMap).forEach(([id, cntId]) => {
  const el  = document.getElementById(id);
  const cnt = document.getElementById(cntId);
  if (!el || !cnt) return;
  el.addEventListener('input', () => {
    cnt.textContent = `${el.value.length} / ${el.maxLength}`;
    cnt.style.color = el.value.length > el.maxLength * 0.9 ? '#f59e0b' : 'var(--muted)';
  });
});

/* ─────────────────────────────
   FORM SUBMISSION
───────────────────────────── */
document.getElementById('proposalForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!validateStep(4)) return;

  const proposal = collectFormData();

  try {
    const response = await fetch('http://localhost:5000/Questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal)
    });
    const data = await response.json();
    console.log(data);
    proposals.push(proposal);

    document.getElementById('proposalForm').style.display    = 'none';
    document.getElementById('successBanner').style.display   = 'block';
    document.querySelector('.step-bar').style.display        = 'none';
    document.querySelector('.page-hero').style.display       = 'none';

    renderProposalList();
  } catch(err) {
    console.log(err);
    alert('Error submitting proposal');
  }
});

function resetForm() {
  document.getElementById('proposalForm').reset();
  Object.entries(counterMap).forEach(([, cntId]) => {
    const cnt = document.getElementById(cntId);
    if (cnt) { cnt.textContent = `0 / ${cnt.textContent.split('/')[1].trim()}`; cnt.style.color = 'var(--muted)'; }
  });
  document.querySelectorAll('.field input,.field select,.field textarea').forEach(el => el.classList.remove('error'));
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  currentStep = 1;
  document.getElementById('step-1').classList.add('active');
  updateStepBar();
  document.getElementById('proposalForm').style.display    = 'block';
  document.getElementById('successBanner').style.display   = 'none';
  document.querySelector('.step-bar').style.display        = 'flex';
  document.querySelector('.page-hero').style.display       = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectFormData() {
  return {
    id: Date.now(),
    category: selectedCategory,
    submittedAt: new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }),
    status: 'pending',
    studentName: val('studentName'), studentId: val('studentId'),
    department: val('department'), academicYear: val('academicYear'),
    proposalTitle: val('proposalTitle'), projectType: val('projectType'),
    duration: val('duration'), introduction: val('introduction'),
    problemStatement: val('problemStatement'), objectives: val('objectives'),
    scopeOfWork: val('scopeOfWork'), methodologies: val('methodologies'),
    tools: val('tools'), teamComposition: val('teamComposition'),
    expectedOutcome: val('expectedOutcome'), futureEnhancements: val('futureEnhancements'),
    references: val('references'),
  };
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* ─────────────────────────────
   FACULTY — LOAD FROM DB
───────────────────────────── */
async function loadProposalsFromDB() {
  try {
    const res = await fetch('http://localhost:5000/Questions');
    proposals = await res.json();
    proposals.forEach(p => { if (!p.status) p.status = 'pending'; });
    renderProposalList();
  } catch {
    console.log('Could not load proposals from DB');
    renderProposalList();
  }
}

/* ─────────────────────────────
   FACULTY — RENDER LISTS
───────────────────────────── */
function renderProposalList() {
  const pending  = proposals.filter(p => p.status === 'pending');
  const approved = proposals.filter(p => p.status === 'approved');
  const rejected = proposals.filter(p => p.status === 'rejected');
  renderSection('listPending',  pending,  'No pending proposals.');
  renderSection('listApproved', approved, 'No approved proposals.');
  renderSection('listRejected', rejected, 'No rejected proposals.');
}

function renderSection(listId, items, emptyMsg) {
  const list = document.getElementById(listId);
  if (!list) return;
  if (items.length === 0) { list.innerHTML = `<div class="empty-list">${emptyMsg}</div>`; return; }
  list.innerHTML = items.map(p => {
    const i = proposals.indexOf(p);
    return `
      <div class="proposal-card ${selectedIdx === i ? 'selected' : ''}" onclick="selectProposal(${i})">
        <div class="pc-title">${escHtml(p.proposalTitle)}</div>
        <div class="pc-meta">
          <span>${escHtml(p.studentName)}</span>
          <span class="pc-status ${p.status}">${capitalize(p.status)}</span>
        </div>
      </div>`;
  }).join('');
}

function selectProposal(idx) {
  selectedIdx = idx;
  selectedProposalId = proposals[idx]._id;
  renderProposalList();
  showReviewPanel(proposals[idx]);
  document.getElementById('summaryPanel').style.display  = 'none';
  document.getElementById('chatbotPanel').style.display  = 'none';
  document.getElementById('btnSummarize').classList.remove('active');
  document.getElementById('btnChatbot').classList.remove('active');
}

/* ─────────────────────────────
   FACULTY — REVIEW PANEL
───────────────────────────── */
function showReviewPanel(p) {
  document.getElementById('emptyState').style.display   = 'none';
  document.getElementById('reviewPanel').style.display  = 'block';
  document.getElementById('rv-badge').textContent   = p.projectType;
  document.getElementById('rv-title').textContent   = p.proposalTitle;
  document.getElementById('rv-student').textContent = `${p.studentName} (${p.studentId})`;
  document.getElementById('rv-dept').textContent    = p.department;
  document.getElementById('rv-year').textContent    = p.academicYear;
  setStatusPill(p.status);

  const sections = [
    { label:'Introduction',       value:p.introduction },
    { label:'Problem Statement',  value:p.problemStatement },
    { label:'Objectives',         value:p.objectives },
    { label:'Scope of Work',      value:p.scopeOfWork },
    { label:'Methodologies',      value:p.methodologies },
    { label:'Tools & Technologies',value:p.tools, mono:true },
    { label:'Team Composition',   value:p.teamComposition },
    { label:'Expected Outcome',   value:p.expectedOutcome },
    { label:'Future Enhancements',value:p.futureEnhancements },
    ...(p.references ? [{ label:'References', value:p.references }] : []),
    { label:'Submitted', value:p.submittedAt },
    { label:'Duration',  value:p.duration },
  ];

  document.getElementById('detailGrid').innerHTML = sections.map((s, i) => `
    <div class="detail-card ${i < 8 && i > 1 ? '' : 'full'}">
      <div class="detail-card-label">${s.label}</div>
      <div class="detail-card-value ${s.mono ? 'mono' : ''}">${escHtml(s.value) || '<em style="color:var(--muted)">—</em>'}</div>
    </div>`).join('');

  resetChat();
}

function setStatusPill(status) {
  const pill = document.getElementById('rv-status');
  pill.textContent = capitalize(status);
  pill.className = 'status-pill ' + status;
}

/* ─────────────────────────────
   DECISION BUTTONS
───────────────────────────── */
async function setDecision(decision) {
  if (selectedIdx === null) return;
  const proposal = proposals[selectedIdx];
  proposal.status = decision;
  setStatusPill(decision);
  renderProposalList();

  const label = decision === 'approved' ? '✅ Proposal Approved' : '❌ Proposal Not Approved';
  showToast(label, decision === 'approved' ? 'var(--green)' : 'var(--red)');

  try {
    await fetch(`http://localhost:5000/Questions/${proposal._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: decision })
    });
  } catch {
    showToast('⚠️ Could not save status to database', 'var(--red)');
  }
}

function showToast(msg, color) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:32px;right:32px;
    background:var(--card2);border:1px solid ${color};
    color:${color};padding:14px 22px;border-radius:10px;
    font-weight:600;font-size:14px;font-family:'DM Sans',sans-serif;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:999;
    animation:fadeUp 0.3s ease;transition:opacity 0.3s;`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2800);
}

/* ─────────────────────────────
   SUMMARIZE
───────────────────────────── */
function summarizeProposal() {
  if (selectedIdx === null) return;
  const p = proposals[selectedIdx];
  const panel = document.getElementById('summaryPanel');
  const btn   = document.getElementById('btnSummarize');

  if (panel.style.display === 'block') {
    panel.style.display = 'none'; btn.classList.remove('active'); return;
  }

  const sections = [
    { title:'Project Title',         body:p.proposalTitle },
    { title:'Student',               body:`${p.studentName} (${p.studentId}) · ${p.department} · ${p.academicYear}` },
    { title:'Project Type & Duration',body:`${p.projectType} · ${p.duration}` },
    { title:'Introduction',          body:p.introduction },
    { title:'Problem Statement',     body:p.problemStatement },
    { title:'Objectives',            body:p.objectives },
    { title:'Scope of Work',         body:p.scopeOfWork },
    { title:'Methodologies',         body:p.methodologies },
    { title:'Tools & Technologies',  body:p.tools },
    { title:'Team Composition',      body:p.teamComposition },
    { title:'Expected Outcome',      body:p.expectedOutcome },
    { title:'Future Enhancements',   body:p.futureEnhancements },
    ...(p.references ? [{ title:'References', body:p.references }] : []),
  ];

  document.getElementById('summaryContent').innerHTML = sections.map(s => `
    <div class="summary-section">
      <div class="summary-section-title">${s.title}</div>
      <div class="summary-section-body">${escHtml(s.body)}</div>
    </div>`).join('');

  panel.style.display = 'block';
  btn.classList.add('active');
  panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* ─────────────────────────────
   CHATBOT
───────────────────────────── */
function toggleChatbot() {
  const panel = document.getElementById('chatbotPanel');
  const btn   = document.getElementById('btnChatbot');
  if (panel.style.display === 'block') {
    panel.style.display = 'none'; btn.classList.remove('active');
  } else {
    panel.style.display = 'block'; btn.classList.add('active');
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
    document.getElementById('chatInput').focus();
  }
}

function resetChat() {
  document.getElementById('chatWindow').innerHTML = `
    <div class="chat-msg bot">
      <div class="chat-avatar">AI</div>
      <div class="chat-bubble">Hello! I'm your AI Review Assistant. Ask me anything — e.g. <em>"Is this proposal up to company standard?"</em></div>
    </div>`;
}

async function sendChat() {
  const input    = document.getElementById('chatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';

  appendChatMsg(question, 'user');
  const typingId = appendTyping();

  try {
    const res = await fetch('http://localhost:5000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: selectedProposalId, message: question })
    });
    const data = await res.json();
    removeTyping(typingId);
    appendChatMsg(data.reply, 'bot');
  } catch {
    removeTyping(typingId);
    appendChatMsg('⚠️ Could not reach the server.', 'bot');
  }
}

function appendChatMsg(text, role) {
  const win = document.getElementById('chatWindow');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-avatar">${role === 'bot' ? 'AI' : 'You'}</div>
    <div class="chat-bubble">${escHtml(text).replace(/\n/g,'<br>')}</div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function appendTyping() {
  const win = document.getElementById('chatWindow');
  const id  = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-msg bot'; div.id = id;
  div.innerHTML = `<div class="chat-avatar">AI</div><div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ─────────────────────────────
   UTILS
───────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

/* ─────────────────────────────
   FILE UPLOAD & AUTO-FILL
───────────────────────────── */
const uploadZone = document.getElementById('uploadZone');
const fileInput  = document.getElementById('fileUpload');

if (uploadZone) {
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });
}

async function handleFile(file) {
  const allowed = [
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  if (!allowed.includes(file.type) && !file.name.endsWith('.txt')) {
    showToast('⚠️ Only PDF, Word, or TXT files supported', 'var(--red)'); return;
  }

  showUploadStatus('Reading file…', 10);

  try {
    let text = '';
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      text = await file.text();
    } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else {
      text = await file.text();
    }

    showUploadStatus('Analysing with AI…', 40);
    const extracted = await extractFieldsWithAI(text);

    showUploadStatus('Filling form…', 85);
    fillForm(extracted);

    showUploadStatus('✅ Done! Review and edit the filled fields.', 100);
    setTimeout(() => document.getElementById('uploadStatus').style.display = 'none', 3000);

  } catch (err) {
    console.error(err);
    showUploadStatus('❌ Could not process file. Try a .txt file.', 100);
  }
}

async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    if (!document.querySelector('script[src*="pdf.min.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => doPDFExtract(file, resolve, reject);
      script.onerror = () => reject(new Error('PDF.js failed to load'));
      document.head.appendChild(script);
    } else {
      doPDFExtract(file, resolve, reject);
    }
  });
}

async function doPDFExtract(file, resolve, reject) {
  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    resolve(fullText);
  } catch(e) { reject(e); }
}

async function extractFieldsWithAI(text) {
  const prompt = `You are a document parser. Extract information from the following document and return ONLY a valid JSON object with these exact keys. If a field is not found, use an empty string "".

Keys:
- studentName
- studentId
- department (one of: "Computer Science & Engineering","Information Technology","Electronics & Communication","Mechanical Engineering","Civil Engineering","Data Science & AI")
- academicYear (format: "2024–25" or "2025–26" or "2026–27")
- proposalTitle
- projectType (one of: "Research","Development","Industry Collaboration","Open Source","Social Impact")
- duration (one of: "1 Month","2 Months","3 Months","6 Months","1 Year")
- introduction
- problemStatement
- objectives
- scopeOfWork
- methodologies
- tools
- teamComposition
- expectedOutcome
- futureEnhancements
- references

Document:
"""
${text.slice(0, 4000)}
"""

Return ONLY the JSON object, no explanation, no markdown.`;

  const res  = await fetch('http://localhost:5000/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data  = await res.json();
  const clean = data.result.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function fillForm(data) {
  const fieldMap = {
    studentName:'studentName', studentId:'studentId',
    proposalTitle:'proposalTitle', teamComposition:'teamComposition',
    introduction:'introduction', problemStatement:'problemStatement',
    objectives:'objectives', scopeOfWork:'scopeOfWork',
    methodologies:'methodologies', tools:'tools',
    expectedOutcome:'expectedOutcome', futureEnhancements:'futureEnhancements',
    references:'references',
  };
  const selectMap = {
    department:'department', academicYear:'academicYear',
    projectType:'projectType', duration:'duration',
  };

  Object.entries(fieldMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el && data[key]) {
      el.value = data[key];
      el.classList.add('autofilled');
      el.dispatchEvent(new Event('input'));
      setTimeout(() => el.classList.remove('autofilled'), 2000);
    }
  });

  Object.entries(selectMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el && data[key]) {
      const match = Array.from(el.options).find(o =>
        o.value.toLowerCase().includes(data[key].toLowerCase()) ||
        data[key].toLowerCase().includes(o.value.toLowerCase())
      );
      if (match) {
        el.value = match.value;
        el.classList.add('autofilled');
        setTimeout(() => el.classList.remove('autofilled'), 2000);
      }
    }
  });

  showToast('✅ Form auto-filled from document!', 'var(--green)');
}

function showUploadStatus(text, percent) {
  const status = document.getElementById('uploadStatus');
  const bar    = document.getElementById('uploadProgressBar');
  const label  = document.getElementById('uploadStatusText');
  if (!status) return;
  status.style.display = 'block';
  bar.style.width      = percent + '%';
  label.textContent    = text;
}