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

  const labels = {
    '1': 'Category I — Diploma / PG Diploma',
    '2': 'Category II — EEP',
    '3': 'Category III — FDP',
    '4': 'Category IV — Seminars / Workshops',
    '5': 'Category V — Conferences',
  };

  // All categories use the accordion form
  showPage('student');

  // Show badge
  const wrap = document.querySelector('#page-student .student-wrap');
  let badge = document.getElementById('catBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'catBadge';
    badge.className = 'selected-cat-badge';
  }
  badge.textContent = '📁 ' + labels[selectedCategory];
  const hero = wrap?.querySelector('.page-hero');
  if (hero) hero.insertAdjacentElement('afterend', badge);
}

window.addEventListener('DOMContentLoaded', () => {
  if (currentRole === 'executive') {
    showPage('faculty');
    loadProposalsFromDB();
  } else {
    showPage('category');
  }
});

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
  return true;
}

function validateForm() {
  const required = ['programmeName','submittedBy','designation','submissionDate','submittedTo','ceecsCat'];
  let valid = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value.trim()) { el.classList.add('error'); valid = false; openAccordion('acc-1'); }
    else el.classList.remove('error');
  });
  const decl = document.getElementById('declaration');
  if (!decl.checked) { alert('Please check the declaration box.'); valid = false; }
  return valid;
}

function shakeForm() {
  const activeStep = document.querySelector('.form-step.active') || document.querySelector('.accordion-section.open .accordion-body');
  if (!activeStep) return;
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
  if (!validateForm()) return;

  const proposal = collectFormData();

  try {
    const response = await fetch('http://localhost:5000/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal)
    });
    const data = await response.json();
    console.log(data);
    proposals.push(proposal);

    document.getElementById('proposalForm').style.display  = 'none';
    document.getElementById('successBanner').style.display = 'block';

    renderProposalList();
  } catch(err) {
    console.log(err);
    alert('Error submitting proposal');
  }
});

function collectFormData() {
  return {
    category: selectedCategory,
    submittedAt: new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }),
    status: 'pending',

    // Section 1
    programmeName:    val('programmeName'),
    submittedBy:      val('submittedBy'),
    designation:      val('designation'),
    submissionDate:   val('submissionDate'),
    submittedTo:      val('submittedTo'),
    ceecsCat:         val('ceecsCat'),
    aboutProgramme:   val('aboutProgramme'),
    eligibility:      val('eligibility'),
    programmeFee:     val('programmeFee'),
    objectives1:      val('objectives1'),
    benefits:         val('benefits'),

    // Section 2
    programmeOutcomes: val('programmeOutcomes'),
    assessmentNotes:   val('assessmentNotes'),

    // Section 3
    coordinatorResp:  val('coordinatorResp'),
    selectionProcess: val('selectionProcess'),
    infrastructure:   val('infrastructure'),

    // Section 4
    budgetNotes: val('budgetNotes'),

    // Tables
    durationTable:     getTableData('tbl-duration-body'),
    curriculumTable:   getTableData('tbl-curriculum-body'),
    assessmentTable:   getTableData('tbl-assessment-body'),
    orgStructureTable: getTableData('tbl-orgstructure-body'),
    timelineTable:     getTableData('tbl-timeline-body'),
    revenueTable:      getTableData('tbl-revenue-body'),
    expenditureTable:  getTableData('tbl-expenditure-body'),
    revDistTable:      getTableData('tbl-revdist-body'),
    honorariumTable:   getTableData('tbl-honorarium-body'),
    breakevenTable:    getTableData('tbl-breakeven-body'),

    // Syllabus courses
    syllabusCourses: getSyllabusCourses(),
  };
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getTableData(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return [];
  return Array.from(tbody.rows).map(row => {
    const cells = Array.from(row.querySelectorAll('input, textarea'));
    return cells.map(c => c.value.trim());
  });
}

function getSyllabusCourses() {
  const courses = document.querySelectorAll('.syllabus-course');
  return Array.from(courses).map(course => ({
    title:    course.querySelector('.syllabus-course-title-input')?.value.trim() || '',
    outcomes: getTableData(course.querySelector('tbody')?.id),
    topics:   course.querySelector('.syllabus-topics')?.value.trim() || '',
    labWork:  course.querySelector('.syllabus-lab')?.value.trim() || '',
  }));
}

/* ─────────────────────────────
   RESET FORM
───────────────────────────── */
function resetForm() {
  document.getElementById('proposalForm').reset();

  // Clear all table bodies
  ['tbl-duration-body','tbl-curriculum-body','tbl-assessment-body',
   'tbl-orgstructure-body','tbl-timeline-body','tbl-revenue-body',
   'tbl-expenditure-body','tbl-revdist-body','tbl-honorarium-body',
   'tbl-breakeven-body'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  // Clear syllabus courses
  document.getElementById('syllabus-courses').innerHTML = '';
  syllabusCourseCount = 0;

  // Close all accordions
  document.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));

  // Reset char counters
  Object.entries(counterMap).forEach(([, cntId]) => {
    const cnt = document.getElementById(cntId);
    if (cnt) { cnt.textContent = `0 / ${cnt.textContent.split('/')[1]?.trim() || ''}`; cnt.style.color = 'var(--muted)'; }
  });

  // Restore form UI
  document.getElementById('proposalForm').style.display  = 'block';
  document.getElementById('successBanner').style.display = 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─────────────────────────────
   FACULTY — LOAD FROM DB
───────────────────────────── */
async function loadProposalsFromDB() {
  try {
    const res = await fetch('http://localhost:5000/proposals');
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
        <div class="pc-title">${escHtml(p.programmeName || p.proposalTitle || '—')}</div>
        <div class="pc-meta">
          <span>${escHtml(p.submittedBy || p.studentName || '—')}</span>
          <span class="pc-status ${p.status}">${capitalize(p.status)}</span>
        </div>
      </div>`;
  }).join('');
}

function selectProposal(idx) {
  selectedIdx = idx;
  selectedProposalId = proposals[idx].id;
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
  document.getElementById('rv-badge').textContent   = p.ceecsCat || p.category || '—';
  document.getElementById('rv-title').textContent   = p.programmeName || p.proposalTitle || '—';
  document.getElementById('rv-student').textContent = p.submittedBy || '—';
  document.getElementById('rv-dept').textContent    = p.designation || '—';
  document.getElementById('rv-year').textContent    = p.submissionDate || p.submittedAt || '—';
  setStatusPill(p.status);

  let html = '';

  const textSections = [
    { label:'About the Programme',        value: p.aboutProgramme },
    { label:'Eligibility Criteria',       value: p.eligibility },
    { label:'Programme Fee',              value: p.programmeFee },
    { label:'Objectives',                 value: p.objectives1 },
    { label:'Benefits to Students',       value: p.benefits },
    { label:'Programme Outcomes',         value: p.programmeOutcomes },
    { label:'Coordinator Responsibilities', value: p.coordinatorResp },
    { label:'Selection Process',          value: p.selectionProcess },
    { label:'Infrastructure',             value: p.infrastructure },
    { label:'Budget Notes',               value: p.budgetNotes },
    { label:'Assessment Notes',           value: p.assessmentNotes },
  ];

  textSections.forEach(s => {
    if (s.value) {
      html += `<div class="detail-card full">
        <div class="detail-card-label">${s.label}</div>
        <div class="detail-card-value">${escHtml(s.value)}</div>
      </div>`;
    }
  });

  const tableSections = [
    { label:'Programme Duration & Mode',  data: p.durationTable,     headers:['Parameter','Details'] },
    { label:'Curriculum Overview',        data: p.curriculumTable,   headers:['No.','Course Title','Level','Hours','Credits'] },
    { label:'Assessment Scheme',          data: p.assessmentTable,   headers:['Assessment Type','Components','Weightage','Mode'] },
    { label:'Organising Structure',       data: p.orgStructureTable, headers:['Role','Responsibility'] },
    { label:'Timeline & Key Dates',       data: p.timelineTable,     headers:['No.','Milestone','Tentative Date'] },
    { label:'Revenue Projection',         data: p.revenueTable,      headers:['Parameter','Value'] },
    { label:'Expenditure Estimate',       data: p.expenditureTable,  headers:['No.','Expenditure Head','Amount (Rs.)'] },
    { label:'Revenue Distribution',       data: p.revDistTable,      headers:['S.No','Component','Norm','Rate','Amount (Rs.)'] },
    { label:'Guest Faculty Honorarium',   data: p.honorariumTable,   headers:['Category of Resource Person','Rate'] },
    { label:'Break-even Analysis',        data: p.breakevenTable,    headers:['Parameter','Value'] },
  ];

  tableSections.forEach(s => {
    if (s.data && s.data.length > 0) {
      html += `<div class="detail-card full">
        <div class="detail-card-label">${s.label}</div>
        <div class="review-table-wrap">
          <table class="review-table">
            <thead><tr>${s.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${s.data.map(row => `<tr>${row.map(cell => `<td>${escHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }
  });

  if (p.syllabusCourses && p.syllabusCourses.length > 0) {
    p.syllabusCourses.forEach((course, i) => {
      let courseHtml = `<div class="detail-card full">
        <div class="detail-card-label">Course ${i+1}: ${escHtml(course.title)}</div>`;
      if (course.outcomes && course.outcomes.length > 0) {
        courseHtml += `<div class="review-table-wrap" style="margin-bottom:10px;">
          <table class="review-table">
            <thead><tr><th>CO Code</th><th>Description</th><th>PO Mapping</th></tr></thead>
            <tbody>${course.outcomes.map(row => `<tr>${row.map(cell => `<td>${escHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>`;
      }
      if (course.topics) courseHtml += `<div style="margin-bottom:8px;"><span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);">Lecture Topics</span><div class="detail-card-value" style="margin-top:4px;">${escHtml(course.topics)}</div></div>`;
      if (course.labWork) courseHtml += `<div><span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);">Lab Work</span><div class="detail-card-value" style="margin-top:4px;">${escHtml(course.labWork)}</div></div>`;
      courseHtml += `</div>`;
      html += courseHtml;
    });
  }

  document.getElementById('detailGrid').innerHTML = html || '<div class="detail-card full"><div class="detail-card-value"><em style="color:var(--muted)">No details available.</em></div></div>';

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
    await fetch(`http://localhost:5000/proposals/${proposal.id}`, {
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
    { title:'Project Title',          body:p.proposalTitle },
    { title:'Student',                body:`${p.studentName} (${p.studentId}) · ${p.department} · ${p.academicYear}` },
    { title:'Project Type & Duration',body:`${p.projectType} · ${p.duration}` },
    { title:'Introduction',           body:p.introduction },
    { title:'Problem Statement',      body:p.problemStatement },
    { title:'Objectives',             body:p.objectives },
    { title:'Scope of Work',          body:p.scopeOfWork },
    { title:'Methodologies',          body:p.methodologies },
    { title:'Tools & Technologies',   body:p.tools },
    { title:'Team Composition',       body:p.teamComposition },
    { title:'Expected Outcome',       body:p.expectedOutcome },
    { title:'Future Enhancements',    body:p.futureEnhancements },
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

/* ─────────────────────────────
   ACCORDION
───────────────────────────── */
function toggleAccordion(id) {
  const section = document.getElementById(id);
  const isOpen  = section.classList.contains('open');
  section.classList.toggle('open', !isOpen);
}

function openAccordion(id) {
  document.getElementById(id)?.classList.add('open');
}

/* ─────────────────────────────
   DYNAMIC TABLE ROWS
───────────────────────────── */
function addRow(tbodyId, headers) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const tr = document.createElement('tr');

  headers.forEach(h => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = h;
    td.appendChild(input);
    tr.appendChild(td);
  });

  const tdDel = document.createElement('td');
  tdDel.style.width = '32px';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-del-row';
  btn.textContent = '✕';
  btn.onclick = () => tr.remove();
  tdDel.appendChild(btn);
  tr.appendChild(tdDel);

  tbody.appendChild(tr);
}

/* ─────────────────────────────
   SYLLABUS COURSES
───────────────────────────── */
let syllabusCourseCount = 0;

function addSyllabusCourse() {
  syllabusCourseCount++;
  const idx     = syllabusCourseCount;
  const wrap    = document.getElementById('syllabus-courses');
  const tbodyId = `syllabus-co-body-${idx}`;

  const div = document.createElement('div');
  div.className = 'syllabus-course';
  div.id = `syllabus-course-${idx}`;

  div.innerHTML = `
    <div class="syllabus-course-header">
      <span class="syllabus-course-num">Course ${idx}</span>
      <input class="syllabus-course-title-input" type="text" placeholder="Course title (e.g. Foundations of Library Technology — 40 Hours | 1 Credit)" />
      <button type="button" class="btn-del-course" onclick="document.getElementById('syllabus-course-${idx}').remove()">✕ Remove</button>
    </div>

    <div class="acc-sub-label" style="font-size:10px;margin-bottom:8px;">Course Outcomes</div>
    <div class="table-wrap" style="margin-bottom:12px;">
      <table class="dynamic-table">
        <thead>
          <tr><th>CO Code</th><th>Description</th><th>PO Mapping</th><th></th></tr>
        </thead>
        <tbody id="${tbodyId}"></tbody>
      </table>
      <button type="button" class="btn-add-row" onclick="addRow('${tbodyId}', ['CO Code','Description','PO Mapping'])">+ Add Course Outcome</button>
    </div>

    <div class="field">
      <label style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Lecture Topics</label>
      <textarea class="syllabus-topics" rows="4" placeholder="List the lecture topics for this course…"></textarea>
    </div>

    <div class="field" style="margin-top:8px;">
      <label style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Laboratory / Practical Component</label>
      <textarea class="syllabus-lab" rows="3" placeholder="Describe the lab sessions and practical exercises…"></textarea>
    </div>
  `;

  wrap.appendChild(div);
}