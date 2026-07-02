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
let proposals          = [];
let selectedIdx        = null;
let selectedProposalId = null;
let currentStep        = 1;
let syllabusCourseCount = 0;
let chatHistory = [];

/* ─────────────────────────────
   PAGE NAVIGATION
───────────────────────────── */
function switchPage(name) {
  if (name === 'faculty' && currentRole !== 'executive') {
    showToast('⚠️ Access denied. Only executives can view this page.', 'var(--red)');
    return;
  }
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
  showPage('student');
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
   VALIDATION
───────────────────────────── */
function validateStep(step) { return true; }

function validateForm() {
  const required = ['programmeName','submittedBy','designation','submissionDate','submittedTo'];
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

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}
  }`;
document.head.appendChild(shakeStyle);

/* ─────────────────────────────
   FORM SUBMISSION
───────────────────────────── */
document.getElementById('proposalForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!validateForm()) return;
  const proposal = collectFormData();
  try {
    const response = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal)
    });
    const data = await response.json();
    proposals.push(proposal);
    document.getElementById('proposalForm').style.display  = 'none';
    document.getElementById('successBanner').style.display = 'block';
    renderProposalList();
  } catch(err) {
    alert('Error submitting proposal');
  }
});

function collectFormData() {
  return {
    category:    selectedCategory,
    submittedAt: new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }),
    status:      'pending',
    programmeName:    val('programmeName'),
    submittedBy:      val('submittedBy'),
    designation:      val('designation'),
    submissionDate:   val('submissionDate'),
    submittedTo:      val('submittedTo'),
    aboutProgramme:   val('aboutProgramme'),
    eligibility:      val('eligibility'),
    programmeFee:     val('programmeFee'),
    objectives1:      val('objectives1'),
    benefits:         val('benefits'),
    programmeOutcomes: val('programmeOutcomes'),
    assessmentNotes:   val('assessmentNotes'),
    coordinatorResp:  val('coordinatorResp'),
    selectionProcess: val('selectionProcess'),
    infrastructure:   val('infrastructure'),
    budgetNotes:      val('budgetNotes'),
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
    syllabusCourses:   getSyllabusCourses(),
  };
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getTableData(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return [];
  return Array.from(tbody.rows).map(row =>
    Array.from(row.querySelectorAll('input, textarea')).map(c => c.value.trim())
  );
}

function getSyllabusCourses() {
  return Array.from(document.querySelectorAll('.syllabus-course')).map(course => ({
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
  ['tbl-duration-body','tbl-curriculum-body','tbl-assessment-body',
   'tbl-orgstructure-body','tbl-timeline-body','tbl-revenue-body',
   'tbl-expenditure-body','tbl-revdist-body','tbl-honorarium-body',
   'tbl-breakeven-body'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  document.getElementById('syllabus-courses').innerHTML = '';
  syllabusCourseCount = 0;
  document.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
  document.getElementById('proposalForm').style.display  = 'block';
  document.getElementById('successBanner').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─────────────────────────────
   FACULTY — LOAD FROM DB
───────────────────────────── */
async function loadProposalsFromDB() {
  try {
    const res = await fetch('/api/proposals');
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
    const isRejected = p.status === 'rejected';
    return `
      <div class="proposal-card ${selectedIdx === i ? 'selected' : ''}" onclick="selectProposal(${i})">
        <div class="pc-title">${escHtml(p.programmeName || p.proposalTitle || '—')}</div>
        <div class="pc-meta">
          <span>${escHtml(p.submittedBy || p.studentName || '—')}</span>
          <span class="pc-status ${p.status}">${capitalize(p.status)}</span>
        </div>
        ${isRejected ? `<button class="btn-delete-proposal" onclick="event.stopPropagation(); deleteProposal(${i})">🗑️ Delete</button>` : ''}
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
  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('reviewPanel').style.display = 'block';
  document.getElementById('rv-badge').textContent   = p.ceecsCat || p.category || '—';
  document.getElementById('rv-title').textContent   = p.programmeName || p.proposalTitle || '—';
  document.getElementById('rv-student').textContent = p.submittedBy || '—';
  document.getElementById('rv-dept').textContent    = p.designation || '—';
  document.getElementById('rv-year').textContent    = p.submissionDate || p.submittedAt || '—';
  setStatusPill(p.status);

  document.getElementById('detailGrid').innerHTML = '';
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
    await fetch(`/api/proposals/${proposal.id}`, {
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

  function renderTable(headers, rows) {
    if (!rows || !rows.length) return '';
    return `
      <div class="review-table-wrap" style="margin-top:8px;">
        <table class="review-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  const textSections = [
    { title: 'Programme Name',               body: p.programmeName },
    { title: 'Submitted By',                 body: p.submittedBy },
    { title: 'Designation / Department',     body: p.designation },
    { title: 'Submission Date',              body: p.submissionDate },
    { title: 'Submitted To',                 body: p.submittedTo },
    { title: 'Category',                     body: p.category },
    { title: 'Status',                       body: p.status },
    { title: 'About the Programme',          body: p.aboutProgramme },
    { title: 'Eligibility Criteria',         body: p.eligibility },
    { title: 'Programme Fee',                body: p.programmeFee },
    { title: 'Objectives',                   body: p.objectives1 },
    { title: 'Benefits to Students',         body: p.benefits },
    { title: 'Programme Outcomes',           body: p.programmeOutcomes },
    { title: 'Assessment Notes',             body: p.assessmentNotes },
    { title: 'Coordinator Responsibilities', body: p.coordinatorResp },
    { title: 'Selection Process',            body: p.selectionProcess },
    { title: 'Infrastructure & Support',     body: p.infrastructure },
    { title: 'Budget Notes & Assumptions',   body: p.budgetNotes },
  ];

  const tableSections = [
    { title: 'Programme Duration & Mode',  headers: ['Parameter','Details'],                            data: p.durationTable },
    { title: 'Curriculum Overview',        headers: ['No.','Course Title','Level','Hours','Credits'],    data: p.curriculumTable },
    { title: 'Assessment Scheme',          headers: ['Assessment Type','Components','Weightage','Mode'], data: p.assessmentTable },
    { title: 'Organising Structure',       headers: ['Role','Responsibility'],                           data: p.orgStructureTable },
    { title: 'Timeline & Key Dates',       headers: ['No.','Milestone / Activity','Tentative Date'],     data: p.timelineTable },
    { title: 'Revenue Projection',         headers: ['Parameter','Value'],                               data: p.revenueTable },
    { title: 'Expenditure Estimate',       headers: ['No.','Expenditure Head','Amount (Rs.)'],           data: p.expenditureTable },
    { title: 'Revenue Distribution',       headers: ['S.No','Component','Norm','Rate','Amount (Rs.)'],   data: p.revDistTable },
    { title: 'Guest Faculty Honorarium',   headers: ['Category of Resource Person','Rate'],              data: p.honorariumTable },
    { title: 'Break-even Analysis',        headers: ['Parameter','Value'],                               data: p.breakevenTable },
  ];

  let html = '';

  // Text fields
  textSections.filter(s => s.body).forEach(s => {
    html += `
      <div class="summary-section">
        <div class="summary-section-title">${s.title}</div>
        <div class="summary-section-body">${escHtml(s.body)}</div>
      </div>`;
  });

  // Tables
  tableSections.filter(s => s.data && s.data.length).forEach(s => {
    html += `
      <div class="summary-section">
        <div class="summary-section-title">${s.title}</div>
        ${renderTable(s.headers, s.data)}
      </div>`;
  });

  // Syllabus courses
  let courses = p.syllabusCourses;
  if (typeof courses === 'string') { try { courses = JSON.parse(courses); } catch { courses = []; } }
  if (Array.isArray(courses) && courses.length) {
    courses.forEach((course, i) => {
      html += `<div class="summary-section">
        <div class="summary-section-title">Course ${i + 1}: ${escHtml(course.title || '')}</div>`;
      if (course.outcomes && course.outcomes.length)
        html += renderTable(['CO Code','Description','PO Mapping'], course.outcomes);
      if (course.topics)
        html += `<div class="summary-section-body" style="margin-top:10px;"><strong>Lecture Topics:</strong><br>${escHtml(course.topics)}</div>`;
      if (course.labWork)
        html += `<div class="summary-section-body" style="margin-top:8px;"><strong>Lab Work:</strong><br>${escHtml(course.labWork)}</div>`;
      html += `</div>`;
    });
  }

  document.getElementById('summaryContent').innerHTML = html ||
    '<p style="color:var(--muted)">No content available in this proposal.</p>';
  panel.style.display = 'block';
  btn.classList.add('active');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  chatHistory = [];
  document.getElementById('chatWindow').innerHTML = `
    <div class="chat-msg bot">
      <div class="chat-avatar">AI</div>
      <div class="chat-bubble">Hello! I'm your AI Review Assistant. Ask me anything — e.g. <em>"Is this proposal up to standard?"</em></div>
    </div>`;
}

async function sendChat() {
  const input    = document.getElementById('chatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  appendChatMsg(question, 'user');
  const typingId = appendTyping();
  chatHistory.push({ role: 'user', content: question });
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: selectedProposalId, message: question, history: chatHistory })
    });
    const data = await res.json();
    removeTyping(typingId);
    appendChatMsg(data.reply, 'bot');
    chatHistory.push({ role: 'assistant', content: data.reply });
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
   ACCORDION
───────────────────────────── */
function toggleAccordion(id) {
  const section = document.getElementById(id);
  section.classList.toggle('open', !section.classList.contains('open'));
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
    input.type = 'text'; input.placeholder = h;
    td.appendChild(input); tr.appendChild(td);
  });
  const tdDel = document.createElement('td');
  tdDel.style.width = '32px';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-del-row'; btn.textContent = '✕';
  btn.onclick = () => tr.remove();
  tdDel.appendChild(btn); tr.appendChild(tdDel);
  tbody.appendChild(tr);
}

/* ─────────────────────────────
   SYLLABUS COURSES
───────────────────────────── */
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
        <thead><tr><th>CO Code</th><th>Description</th><th>PO Mapping</th><th></th></tr></thead>
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
    </div>`;
  wrap.appendChild(div);
}

/* ════════════════════════════════════════
   AUTO-FILL  —  drop-in replacement for the
   file upload + AI extraction section in script.js
   
   WHAT CHANGED vs old code:
   ─ No more Promise.all (was causing mass 429s)
   ─ Sequential chunks with 2.5s gap
   ─ Single-shot for docs ≤ 7000 chars
   ─ Hard cap of 4 chunks (covers any real proposal)
   ─ Per-call retry with exponential back-off
   ─ Client-side chunk size raised to 6000 chars
   ─ Retry-After header forwarded from server
════════════════════════════════════════ */

/* ─────────────────────────────
   FILE UPLOAD WIRING
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
  const ext = file.name.split('.').pop().toLowerCase();

  if (!['pdf','doc','docx','txt'].includes(ext)) {
    showToast('⚠️ Only PDF, Word (.docx), or TXT files supported', 'var(--red)');
    return;
  }
  if (ext === 'doc') {
    showUploadStatus('❌ Old .doc format not supported. Save as .docx or .txt and try again.', 100);
    setTimeout(() => document.getElementById('uploadStatus').style.display = 'none', 5000);
    return;
  }

  showUploadStatus('Reading file…', 10);

  try {
    let text = '';

    if (ext === 'txt') {
      showUploadStatus('Reading text file…', 20);
      text = await file.text();
    } else if (ext === 'pdf') {
      showUploadStatus('Loading PDF reader…', 15);
      text = await extractTextFromPDF(file);
    } else if (ext === 'docx') {
      showUploadStatus('Loading Word reader…', 15);
      text = await extractTextFromDocx(file);
    }


    if (!text || text.trim().length < 50) {
      showUploadStatus('⚠️ File appears empty or unreadable. Try saving as .txt and re-uploading.', 100);
      setTimeout(() => document.getElementById('uploadStatus').style.display = 'none', 5000);
      return;
    }

    showUploadStatus('Sending to AI for extraction…', 25);
    const extracted = await extractFieldsWithAI(text);

    showUploadStatus('Filling form…', 97);
    fillForm(extracted);

    showUploadStatus('✅ Done! Review and edit the filled fields.', 100);
    setTimeout(() => document.getElementById('uploadStatus').style.display = 'none', 3000);

  } catch (err) {
    console.error('[Upload] Error:', err);
    let msg = '❌ Could not process file.';
    if (err.message?.includes('pdf') || err.message?.includes('PDF'))
      msg = '❌ PDF reader failed. Try converting to .txt and uploading again.';
    else if (err.message?.includes('mammoth') || err.message?.includes('docx'))
      msg = '❌ Word reader failed. Try saving as .txt and uploading again.';
    else if (err.message?.includes('fetch') || err.message?.includes('network'))
      msg = '❌ Cannot reach server. Make sure backend is running on port 5000.';
    else if (err.message)
      msg = `❌ ${err.message}`;
    showUploadStatus(msg, 100);
    setTimeout(() => document.getElementById('uploadStatus').style.display = 'none', 6000);
  }
}

/* ─── PDF extraction ─────────────────── */
async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    if (window['pdfjs-dist/build/pdf']) { doPDFExtract(file, resolve, reject); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload  = () => doPDFExtract(file, resolve, reject);
    script.onerror = () => reject(new Error('pdf.js failed to load from CDN'));
    document.head.appendChild(script);
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
    if (!fullText.trim())
      return reject(new Error('PDF has no selectable text. Try a text-based PDF or .txt file.'));
    resolve(fullText);
  } catch(e) { reject(new Error('PDF parse error: ' + e.message)); }
}

/* ─── DOCX extraction ────────────────── */
async function extractTextFromDocx(file) {
  return new Promise((resolve, reject) => {
    if (window.mammoth) { doDocxExtract(file, resolve, reject); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload  = () => doDocxExtract(file, resolve, reject);
    script.onerror = () => reject(new Error('mammoth.js failed to load from CDN'));
    document.head.appendChild(script);
  });
}
async function doDocxExtract(file, resolve, reject) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    resolve(result.value);
  } catch(e) { reject(new Error('DOCX parse error: ' + e.message)); }
}

/* ════════════════════════════════════════
   AI EXTRACTION  —  sequential, rate-limit safe
════════════════════════════════════════ */
async function extractFieldsWithAI(text) {
  // Normalise whitespace
  const doc = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();


  /* ── Single-shot: fits in one call (≤ 7000 chars) ── */
  if (doc.length <= 30000) {
    showUploadStatus('Extracting fields (single pass)…', 45);
    const result = await callExtract(buildExtractionPrompt(doc, 1, 1));
    return mergeResults([result]);
  }

  const CHUNK  = 8000;
  const OVERLAP = 2500;
  const MAX_CHUNKS = 10;          
  const chunks  = [];
  let pos = 0;
  while (pos < doc.length && chunks.length < MAX_CHUNKS) {
    chunks.push(doc.slice(pos, pos + CHUNK));
    pos += CHUNK - OVERLAP;
  }
  if (doc.length > pos + OVERLAP) {
    // Document truncated after max chunks
  }
  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const pct = Math.round(28 + (i / chunks.length) * 58);
    showUploadStatus(`Extracting chunk ${i + 1} of ${chunks.length}…`, pct);

    const result = await callExtract(buildExtractionPrompt(chunks[i], i + 1, chunks.length));
    results.push(result);

    // Polite gap between calls — prevents rate-limit completely
    if (i < chunks.length - 1) {
      showUploadStatus(`Chunk ${i + 1} done — waiting 2.5 s before next…`, pct + 5);
      await sleep(2500);
    }
  }

  showUploadStatus('Merging and deduplicating results…', 92);
  return mergeResults(results);
}

/* ─── Build the extraction prompt ──────────────────────────── */
function buildExtractionPrompt(chunk, num, total) {
  return `You are extracting structured data from part ${num} of ${total} of an academic programme proposal PDF.

Your job is to MAP the content from this PDF into the exact JSON fields below.
The PDF may use different section names — use context to figure out the right field.

FIELD MAPPING GUIDE:
- "programmeName"    → The title of the course/programme (e.g. "Certificate Course in Library Technology")
- "submittedBy"      → Person who submitted (e.g. "Dr Gopakumar V")
- "designation"      → Their title/role (e.g. "Head, Knowledge Centre")
- "submissionDate"   → Date of submission formatted as YYYY-MM-DD (e.g. "2026-04-20"). Convert any date format to this.
- "submittedTo"      → Who it is submitted to (e.g. "CEECS" or "Centre for Executive Education")
- "aboutProgramme"   → Introduction / About section — minimum 100 words describing the programme
- "eligibility"      → Eligibility Criteria section
- "programmeFee"     → Fee mentioned anywhere (e.g. "Rs. 35,000/-")
- "objectives1"      → Objectives of the Course / Programme Objectives section
- "benefits"         → Section on Benefits to Students — extract ALL subsections with full content including Academic Recognition, Career and Employability, Content Quality. Do NOT use the short summary version.
- "programmeOutcomes"→ Programme Outcomes (POs) section — extract ALL POs listed (PO1, PO2... etc) with their full descriptions as a single text block. Look for "Upon successful completion" heading. Do NOT leave empty if POs are present.
- "assessmentNotes"  → Assessment Scheme details, attendance requirements, passing criteria
- "coordinatorResp"  → Faculty and Resource Persons section — list all faculty, guest experts, and support staff mentioned. Also includes coordinator responsibilities if described.
- "selectionProcess" → Intake and Admission Process / Selection Process section
- "infrastructure"   → Infrastructure / Learning Environment / Mode of Instruction section
- "budgetNotes"      → Budget notes, assumptions, implementation plan phases, conclusion

TABLE FIELD MAPPING GUIDE:
- "durationTable"    → Duration details as rows: [["Total Duration","3 Months"], ["Daily Contact Hours","5 hours"], ...]
- "curriculumTable"  → Module/Course table: [["1","Module Title","Level","Hours","Credits"], ...]
- "assessmentTable"  → Assessment table: [["Continuous Assessment","description","40%","Formative"], ...]
- "orgStructureTable"→ Faculty / Resource persons table if present, otherwise []
- "timelineTable"    → Implementation Plan or Timeline section. Each phase as a row: [["1","Phase name / Activity","Timeline / Month"]]. Look for "Phase 1", "Phase 2" or numbered milestone tables.
- "revenueTable"     → Revenue / Fee related rows: [["Course Fee","Rs. 35,000"], ...]
- "revenueTable"     → Full revenue projection table with ALL rows including gross revenue, GST, and net amount. Example: [["Programme Fee per Student","Rs. 35,000/-"], ["Maximum Intake","30 Students"], ["Gross Revenue","Rs. 10,50,000/-"], ...]
- "revDistTable"     → Revenue distribution if present, otherwise []
- "honorariumTable"  → Honorarium rates if present, otherwise []
- "breakevenTable"   → Break-even info if present, otherwise []

For syllabusCourses: extract each Module/Course as a separate object.
- title:    the module/course title only (without "Module 1:" prefix)
- topics:   all lecture topics, content, or description for that module
- labWork:  practical component or lab work described for that module
- outcomes: Generate 3-5 course outcomes for each course based on its topics and description, even if no CO table exists in the document. Format: [["CO1.1", "Description of what the learner can do", "PO1, PO2"], ...]. Use action verbs (Explain, Demonstrate, Apply, Analyse, Design). Map to relevant POs from the programmeOutcomes section if available, otherwise use PO1-PO5 as appropriate.

Return ONLY this JSON — no markdown, no explanation:

{
  "programmeName": "",
  "submittedBy": "",
  "designation": "",
  "submissionDate": "",
  "submittedTo": "",
  "aboutProgramme": "",
  "eligibility": "",
  "programmeFee": "",
  "objectives1": "",
  "benefits": "",
  "programmeOutcomes": "",
  "assessmentNotes": "",
  "coordinatorResp": "",
  "selectionProcess": "",
  "infrastructure": "",
  "budgetNotes": "",
  "durationTable":     [],
  "curriculumTable":   [],
  "assessmentTable":   [],
  "orgStructureTable": [],
  "timelineTable":     [],
  "revenueTable":      [],
  "expenditureTable":  [],
  "revDistTable":      [],
  "honorariumTable":   [],
  "breakevenTable":    [],
  "syllabusCourses":   []
}

DOCUMENT CHUNK ${num}/${total}:
"""
${chunk}
"""

Return ONLY the JSON object. Nothing else.`;
}
/* ─── Merge partial results into one clean object ──────────── */
function mergeResults(results) {
  const TEXT_KEYS = [
    'programmeName','submittedBy','designation','submissionDate','submittedTo',
    'aboutProgramme','eligibility','programmeFee','objectives1','benefits',
    'programmeOutcomes','assessmentNotes','coordinatorResp','selectionProcess',
    'infrastructure','budgetNotes',
  ];
  const TABLE_KEYS = [
    'durationTable','curriculumTable','assessmentTable','orgStructureTable',
    'timelineTable','revenueTable','expenditureTable','revDistTable',
    'honorariumTable','breakevenTable',
  ];

  const merged = {};

  // Text fields: first non-empty value wins
  for (const key of TEXT_KEYS) {
    merged[key] = '';
    for (const r of results) {
      const v = (r[key] || '').trim();
      if (v) { merged[key] = v; break; }
    }
  }

  // Table fields: concatenate, deduplicate rows by first cell
// Common header/placeholder values to drop from table data rows
  const HEADER_WORDS = new Set([
    'no', 'no.', 's.no', 'sno', 'parameter', 'value', 'details',
    'milestone', 'date', 'role', 'responsibility', 'component',
    'type', 'mode', 'rate', 'amount', 'head', 'norm', 'category',
    'assessment type', 'components', 'weightage', 'title', 'level',
    'hours', 'credits', 'course title',
  ]);

  // Table fields: concatenate, deduplicate rows by first cell, drop header rows
  for (const key of TABLE_KEYS) {
    const seen = new Set();
    const rows = [];
    for (const r of results) {
      for (const row of normaliseRows(r[key])) {
        const k0 = (row[0] || '').trim().toLowerCase();
        if (!k0) continue;
        // Drop rows that look like header rows (first cell is a known header word)
        if (HEADER_WORDS.has(k0)) continue;
        // Deduplicate by first cell
        if (seen.has(k0)) continue;
        seen.add(k0);
        rows.push(row);
      }
    }
    merged[key] = rows;
  }

  // ── Syllabus courses: build a clean map keyed by normalised title
  const courseMap = new Map();

  for (const r of results) {
    for (const course of (Array.isArray(r.syllabusCourses) ? r.syllabusCourses : [])) {
      if (!course || typeof course !== 'object') continue;

      // Normalise: strip "Course N:" prefix and trim
      const rawTitle = (course.title || '').trim();
      const normTitle = rawTitle
        .toLowerCase()
        .replace(/^course\s*\d+\s*:\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Skip phantom/truncated titles (too short or ends mid-word with no vowel pattern)
      if (normTitle.length < 10) continue;

      if (!courseMap.has(normTitle)) {
        courseMap.set(normTitle, {
          title:    rawTitle.replace(/^Course\s*\d+\s*:\s*/i, '').trim(), // clean title
          topics:   course.topics   || '',
          labWork:  course.labWork  || '',
          outcomes: course.outcomes || [],
        });
      } else {
        // Merge: keep the richer version of each field
        const existing = courseMap.get(normTitle);
        if ((course.topics   || '').length > existing.topics.length)
          existing.topics   = course.topics;
        if ((course.labWork  || '').length > existing.labWork.length)
          existing.labWork  = course.labWork;
        if ((course.outcomes || []).length > existing.outcomes.length)
          existing.outcomes = course.outcomes;
      }
    }
  }

  // ── Match against curriculum table to get the right order and drop phantoms
  let allCourses = Array.from(courseMap.values());

  if (merged.curriculumTable && merged.curriculumTable.length > 0) {
    // Build ordered list from curriculum table (skip header rows)
    const curriculumTitles = merged.curriculumTable
      .filter(row => row[0] && !isNaN(row[0]))          // rows starting with a number
      .map(row => ({
        norm: (row[1] || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        display: (row[1] || '').trim(),
      }));

    // For each curriculum entry, find the best matching syllabus course
    const ordered = [];
    for (const curr of curriculumTitles) {
      // Find course map entry whose norm title overlaps with curriculum title
      let best = null;
      let bestScore = 0;
      for (const [normKey, courseObj] of courseMap.entries()) {
        const shorter = normKey.length < curr.norm.length ? normKey : curr.norm;
        const longer  = normKey.length < curr.norm.length ? curr.norm : normKey;
        // Overlap score: length of shorter string that appears in longer
        if (longer.includes(shorter) && shorter.length > bestScore) {
          bestScore = shorter.length;
          best = courseObj;
        }
      }
      if (best && bestScore > 10) {
        // Use the curriculum table title as the display title (more reliable)
        ordered.push({ ...best, title: curr.display });
      }
    }

    merged.syllabusCourses = ordered.length > 0 ? ordered : allCourses;
  } else {
    merged.syllabusCourses = allCourses;
  }
  return merged;
}
/* ─── Single extract call with retry ───────────────────────── */
async function callExtract(prompt) {
  const MAX_RETRIES = 4;
  const BASE_DELAY  = 6000; // 6 s base

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('/api/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt }),
      });

      // Server forwarded a 429 with Retry-After from Groq
      if (res.status === 429) {
        const ra = parseInt(res.headers.get('Retry-After') || '0', 10);
        const wait = (ra > 0 ? ra * 1000 : BASE_DELAY * Math.pow(2, attempt));
        showUploadStatus(`Rate limit — retrying in ${Math.round(wait/1000)} s…`, 35);
        await sleep(wait);
        continue;
      }
      
      if (res.status === 413) {
        return {};
      }

      // Transient server error
      if (res.status >= 500) {
        const wait = BASE_DELAY * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }

      const data = await res.json();
      let raw = (data.result || '{}').trim()
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

      // Find outermost { }
      const start = raw.indexOf('{');
      const end   = raw.lastIndexOf('}');
      if (start === -1 || end === -1) {
        return {};
      }
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch(e) {
        console.error('[AutoFill] JSON parse failed:', e.message);
        return {};
      }

    } catch(err) {
      const wait = BASE_DELAY * Math.pow(2, attempt);
      console.error(`[AutoFill] Fetch error (attempt ${attempt+1}):`, err.message);
      if (attempt < MAX_RETRIES - 1) await sleep(wait);
    }
  }
  console.error('[AutoFill] All retries exhausted for chunk');
  return {};
}

/* ─── Shared sleep utility ──────────────────────────────────── */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ─── Normalise table rows (array of arrays / array of objects) */
function normaliseRows(data) {
  if (!data) return [];
  if (!Array.isArray(data) && typeof data === 'object')
    return Object.entries(data).map(([k,v]) => [String(k), String(v ?? '')]).filter(r => r[0].trim() || r[1].trim());
  if (!Array.isArray(data) || data.length === 0) return [];
  return data
    .map(row => {
      if (Array.isArray(row))            return row.map(c => String(c ?? ''));
      if (row && typeof row === 'object') return Object.values(row).map(v => String(v ?? ''));
      return [String(row ?? '')];
    })
    .filter(row => row.length > 0 && row.some(c => c.trim()));
}

/* ════════════════════════════════════════
   fillForm  —  unchanged from original;
   included here for completeness
════════════════════════════════════════ */
function fillForm(data) {
  let filled = 0;

  const textMap = {
    programmeName:'programmeName',    submittedBy:'submittedBy',
    designation:'designation',        submissionDate:'submissionDate',
    submittedTo:'submittedTo',         aboutProgramme:'aboutProgramme',
    eligibility:'eligibility',         programmeFee:'programmeFee',
    objectives1:'objectives1',         benefits:'benefits',
    programmeOutcomes:'programmeOutcomes', coordinatorResp:'coordinatorResp',
    selectionProcess:'selectionProcess',   infrastructure:'infrastructure',
    budgetNotes:'budgetNotes',             assessmentNotes:'assessmentNotes',
  };
  for (const [key, id] of Object.entries(textMap)) {
    const el = document.getElementById(id);
    const v  = (data[key] || '').trim();
    if (!el || !v) continue;
    el.value = v; flashField(el); filled++;
  }

  // Default skeleton rows for each table — shown even if AI didn't extract data
  const tableDefaults = {
    durationTable: [
      ['Total Duration', ''],
      ['Daily Contact Hours', ''],
      ['Total Course Hours', ''],
      ['Mode of Delivery', ''],
      ['Medium of Instruction', ''],
      ['Maximum Intake', ''],
      ['Total Credits', ''],
      ['Certificate Awarding Authority', ''],
      ['Credit Recognition', ''],
    ],
    curriculumTable: [
      ['1', '', '300', '', ''],
      ['2', '', '300', '', ''],
      ['3', '', '300', '', ''],
      ['4', '', '300', '', ''],
      ['5', '', '400', '', ''],
    ],
    assessmentTable: [
      ['Continuous Assessment (CA)', '', '', ''],
      ['Course-End Assessment (CEA)', '', '', ''],
    ],
    orgStructureTable: [
      ['Programme Proposer / Principal Resource', ''],
      ['Programme Coordinator (Chair)', ''],
      ['Oversight and Approval Authority', ''],
      ['Administrative Management', ''],
      ['Academic Quality Assurance', ''],
      ['Finance and Revenue Distribution', ''],
      ['Guest Faculty / External Experts', ''],
      ['Technical Support', ''],
      ['Signatory Authority – Certificates', ''],
      ['Signatory Authority – Agreements/Contracts', ''],
    ],
    timelineTable: [
      ['1', '', ''],
      ['2', '', ''],
      ['3', '', ''],
      ['4', '', ''],
      ['5', '', ''],
    ],
    revenueTable: [
      ['Programme Fee per Student', ''],
      ['Maximum Intake (Full Capacity)', ''],
      ['Gross Revenue (G) – Full Capacity', ''],
      ['Estimated GST (if applicable @ 18%)', ''],
      ['Net Amount (N = G – T)', ''],
    ],
    expenditureTable: [
      ['1', '', ''],
      ['2', '', ''],
      ['3', '', ''],
      ['4', '', ''],
      ['5', '', ''],
    ],
    revDistTable: [
      ['1', 'Gross Amount (G)', '—', '—', ''],
      ['2', 'Less: GST (T)', '—', '18%', ''],
      ['3', 'Net Amount (N = G – T)', '—', '—', ''],
      ['4', 'CEECS Share (from N)', '5% N', '5%', ''],
      ['5', 'Staff Welfare Fund (from N)', '5% N', '5%', ''],
      ['6', 'University Overhead (from N)', '10% N', '10%', ''],
      ['7', 'Programme Execution Cost Ceiling (C = 80% N)', '80% N', '80%', ''],
      ['8', 'Estimated Actual Expenditure (E)', '—', '—', ''],
      ['9', 'Savings (S = C – E)', '—', '—', ''],
      ['10', 'Programme Chair(s) Share (from S)', '5% S', '5%', ''],
      ['11', 'CEECS Share (from S)', '30% S', '30%', ''],
      ['12', 'Department / Centre Share (from S)', '25% S', '25%', ''],
      ['13', 'University Share (from S)', '40% S', '40%', ''],
    ],
    honorariumTable: [
      ['External Resource Person / Subject Expert (Seminars/Workshops)', ''],
      ['Internal Resource Person / Subject Expert (Training Programs)', ''],
      ['Guest Faculty for courses with sessions up to 5 hours', ''],
      ['Guest Faculty handling sessions of courses with 1 credit', ''],
      ['Project / Technical Staff assisting lab sessions', ''],
      ['Research Scholars handling sessions of courses', ''],
    ],
    breakevenTable: [
      ['Fixed Programme Cost (minimum, regardless of enrolment)', ''],
      ['Variable Cost per Additional Student (materials, lab, admin)', ''],
      ['Break-even Enrolment (minimum students to cover costs)', ''],
      ['Minimum Recommended Enrolment to Run Programme', ''],
      ['Programme Surplus at Minimum Recommended Enrolment', ''],
      ['Maximum Revenue at Full Capacity', ''],
    ],
  };

  const tableMap = {
    durationTable:     'tbl-duration-body',
    curriculumTable:   'tbl-curriculum-body',
    assessmentTable:   'tbl-assessment-body',
    orgStructureTable: 'tbl-orgstructure-body',
    timelineTable:     'tbl-timeline-body',
    revenueTable:      'tbl-revenue-body',
    expenditureTable:  'tbl-expenditure-body',
    revDistTable:      'tbl-revdist-body',
    honorariumTable:   'tbl-honorarium-body',
    breakevenTable:    'tbl-breakeven-body',
  };

  for (const [key, tbodyId] of Object.entries(tableMap)) {
    const aiRows       = normaliseRows(data[key]);
    const defaultRows  = tableDefaults[key] || [];

    // Use AI rows if extracted, otherwise use skeleton defaults
    const rowsToUse = aiRows.length > 0 ? aiRows : defaultRows;

    const tbody = document.getElementById(tbodyId);
    if (!tbody) continue;
    tbody.innerHTML = '';

    for (const row of rowsToUse) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td  = document.createElement('td');
        const inp = document.createElement('input');
        inp.type  = 'text';
        inp.value = cell;
        if (cell) flashField(inp);
        td.appendChild(inp);
        tr.appendChild(td);
      }
      const tdDel  = document.createElement('td');
      tdDel.style.width = '32px';
      const btnDel = document.createElement('button');
      btnDel.type      = 'button';
      btnDel.className = 'btn-del-row';
      btnDel.textContent = '✕';
      btnDel.onclick   = () => tr.remove();
      tdDel.appendChild(btnDel);
      tr.appendChild(tdDel);
      tbody.appendChild(tr);
      filled++;
    }
  }

  const coursesRaw = Array.isArray(data.syllabusCourses) ? data.syllabusCourses : [];
  if (coursesRaw.length > 0) {
    const wrap = document.getElementById('syllabus-courses');
    if (wrap) {
      wrap.innerHTML = ''; syllabusCourseCount = 0;
      for (const course of coursesRaw) {
        if (!course || typeof course !== 'object') continue;
        syllabusCourseCount++;
        const idx     = syllabusCourseCount;
        const tbodyId = `syllabus-co-body-${idx}`;
        const div = document.createElement('div');
        div.className = 'syllabus-course'; div.id = `syllabus-course-${idx}`;
        div.innerHTML = `
          <div class="syllabus-course-header">
            <span class="syllabus-course-num">Course ${idx}</span>
            <input class="syllabus-course-title-input" type="text" value="${escHtml(course.title||'')}" placeholder="Course title" />
            <button type="button" class="btn-del-course" onclick="document.getElementById('syllabus-course-${idx}').remove()">✕ Remove</button>
          </div>
          <div class="acc-sub-label" style="font-size:10px;margin-bottom:8px;">Course Outcomes</div>
          <div class="table-wrap" style="margin-bottom:12px;">
            <table class="dynamic-table">
              <thead><tr><th>CO Code</th><th>Description</th><th>PO Mapping</th><th></th></tr></thead>
              <tbody id="${tbodyId}"></tbody>
            </table>
            <button type="button" class="btn-add-row" onclick="addRow('${tbodyId}',['CO Code','Description','PO Mapping'])">+ Add Course Outcome</button>
          </div>
          <div class="field">
            <label style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Lecture Topics</label>
            <textarea class="syllabus-topics" rows="4" placeholder="List the lecture topics…">${escHtml(course.topics||'')}</textarea>
          </div>
          <div class="field" style="margin-top:8px;">
            <label style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Laboratory / Practical Component</label>
            <textarea class="syllabus-lab" rows="3" placeholder="Describe lab sessions…">${escHtml(course.labWork||'')}</textarea>
          </div>`;
        wrap.appendChild(div);
        const outcomes = normaliseRows(course.outcomes);
        if (outcomes.length > 0) {
          const outTbody = document.getElementById(tbodyId);
          for (const row of outcomes) {
            const tr = document.createElement('tr');
            for (const cell of row) {
              const td  = document.createElement('td');
              const inp = document.createElement('input');
              inp.type = 'text'; inp.value = cell;
              flashField(inp); td.appendChild(inp); tr.appendChild(td);
            }
            const tdDel = document.createElement('td'); tdDel.style.width = '32px';
            const btnDel = document.createElement('button');
            btnDel.type = 'button'; btnDel.className = 'btn-del-row'; btnDel.textContent = '✕';
            btnDel.onclick = () => tr.remove();
            tdDel.appendChild(btnDel); tr.appendChild(tdDel); outTbody.appendChild(tr);
          }
        }
        flashField(div.querySelector('.syllabus-course-title-input'));
        filled++;
      }
    }
  }

  ['acc-1','acc-2','acc-3','acc-4'].forEach(id => openAccordion(id));
  showToast(`✅ Auto-filled ${filled} fields, tables & courses!`, 'var(--green)');
}

function flashField(el) {
  if (!el) return;
  el.classList.add('autofilled');
  setTimeout(() => el.classList.remove('autofilled'), 2500);
}

function showUploadStatus(text, percent) {
  const status = document.getElementById('uploadStatus');
  if (!status) return;
  status.style.display = 'block';
  document.getElementById('uploadProgressBar').style.width = percent + '%';
  document.getElementById('uploadStatusText').textContent  = text;
}
/* ─────────────────────────────
   EXPORT PROPOSAL AS PDF
───────────────────────────── */
async function exportProposalPDF() {
  if (selectedIdx === null) return;
  const p = proposals[selectedIdx];

  // Load jsPDF from CDN if not already loaded
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload  = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Load jsPDF autotable plugin
  if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      script.onload  = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W    = 210;
  const MARGIN    = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 20;

  // ── Colors
  const GOLD   = [212, 169, 74];
  const DARK   = [20, 24, 36];
  const GREY   = [100, 108, 132];
  const WHITE  = [255, 255, 255];
  const LIGHT  = [245, 246, 250];

  // ── Helper: check page overflow
  function checkPage(needed = 10) {
    if (y + needed > 275) {
      doc.addPage();
      y = 20;
    }
  }

  // ── Helper: section heading
  function sectionHeading(title) {
    checkPage(14);
    doc.setFillColor(...GOLD);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(title.toUpperCase(), MARGIN + 4, y + 5.5);
    y += 12;
    doc.setTextColor(...DARK);
  }

  // ── Helper: field label + value
  function field(label, value) {
    if (!value) return;
    checkPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), MARGIN, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(value, CONTENT_W);
    lines.forEach(line => {
      checkPage(6);
      doc.text(line, MARGIN, y);
      y += 5;
    });
    y += 3;
  }

  // ── Helper: render a table
  function table(headers, rows, title) {
    if (!rows || !rows.length) return;
    checkPage(20);
    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(title.toUpperCase(), MARGIN, y);
      y += 4;
    }
    doc.autoTable({
      startY: y,
      head: [headers],
      body: rows,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: DARK,
        lineColor: [220, 224, 235],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: DARK,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: LIGHT },
      tableLineColor: [220, 224, 235],
      tableLineWidth: 0.2,
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ════════════════════════════════
  // COVER / HEADER
  // ════════════════════════════════
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PAGE_W, 42, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 42, PAGE_W, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GOLD);
  doc.text('ProposalHub', MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('Programme Proposal Report', MARGIN, 27);

  doc.setFontSize(8);
  doc.setTextColor(180, 185, 200);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, MARGIN, 35);

  // Status badge
  const statusColor = p.status === 'approved' ? [62,207,122] : p.status === 'rejected' ? [242,107,107] : [212,169,74];
  doc.setFillColor(...statusColor);
  doc.roundedRect(PAGE_W - MARGIN - 30, 12, 30, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text((p.status || 'Pending').toUpperCase(), PAGE_W - MARGIN - 15, 18.5, { align: 'center' });

  y = 52;
  doc.setTextColor(...DARK);

  // ════════════════════════════════
  // SECTION 1 — INTRODUCTION
  // ════════════════════════════════
  sectionHeading('Section 1 — Introduction & Overview');

  // Basic info as a mini table
  doc.autoTable({
    startY: y,
    body: [
      ['Programme Name', p.programmeName || '—'],
      ['Submitted By',   `${p.submittedBy || '—'} · ${p.designation || '—'}`],
      ['Submitted To',   p.submittedTo || '—'],
      ['Submission Date', p.submissionDate || '—'],
      ['Category',       p.category || '—'],
    ],
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: LIGHT, textColor: GREY },
      1: { textColor: DARK },
    },
    styles: { fontSize: 9, cellPadding: 3 },
    tableLineColor: [220, 224, 235],
    tableLineWidth: 0.2,
  });
  y = doc.lastAutoTable.finalY + 6;

  field('About the Programme', p.aboutProgramme);
  field('Eligibility Criteria', p.eligibility);
  table(['Parameter', 'Details'], p.durationTable, 'Programme Duration & Mode');
  field('Programme Fee', p.programmeFee);
  field('Objectives', p.objectives1);
  field('Benefits to Students', p.benefits);

  // ════════════════════════════════
  // SECTION 2 — COURSE STRUCTURE
  // ════════════════════════════════
  sectionHeading('Section 2 — Course Structure');
  table(['No.','Course Title','Level','Hours','Credits'], p.curriculumTable, 'Curriculum Overview');
  field('Programme Outcomes', p.programmeOutcomes);

  // Syllabus courses
  let courses = p.syllabusCourses;
  if (typeof courses === 'string') { try { courses = JSON.parse(courses); } catch { courses = []; } }
  if (Array.isArray(courses) && courses.length) {
    courses.forEach((course, i) => {
      checkPage(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GOLD);
      doc.text(`Course ${i + 1}: ${course.title || ''}`, MARGIN, y);
      y += 5;
      doc.setTextColor(...DARK);

      if (course.outcomes && course.outcomes.length) {
        table(['CO Code','Description','PO Mapping'], course.outcomes, 'Course Outcomes');
      }
      if (course.topics) field('Lecture Topics', course.topics);
      if (course.labWork) field('Lab / Practical Component', course.labWork);
      y += 2;
    });
  }

  table(['Assessment Type','Components','Weightage','Mode'], p.assessmentTable, 'Assessment Scheme');
  field('Assessment Notes', p.assessmentNotes);

  // ════════════════════════════════
  // SECTION 3 — PLAN OF EXECUTION
  // ════════════════════════════════
  sectionHeading('Section 3 — Plan of Execution');
  table(['Role','Responsibility'], p.orgStructureTable, 'Organising Structure');
  table(['No.','Milestone / Activity','Tentative Date'], p.timelineTable, 'Programme Timeline & Key Dates');
  field('Coordinator Responsibilities', p.coordinatorResp);
  field('Application & Selection Process', p.selectionProcess);
  field('Infrastructure & Support', p.infrastructure);

  // ════════════════════════════════
  // SECTION 4 — BUDGET
  // ════════════════════════════════
  sectionHeading('Section 4 — Tentative Budget');
  table(['Parameter','Value'], p.revenueTable, 'Revenue Projection');
  table(['No.','Expenditure Head','Amount (Rs.)'], p.expenditureTable, 'Expenditure Estimate');
  table(['S.No','Component','Norm','Rate','Amount (Rs.)'], p.revDistTable, 'Revenue Distribution');
  table(['Category of Resource Person','Rate'], p.honorariumTable, 'Guest Faculty Honorarium');
  table(['Parameter','Value'], p.breakevenTable, 'Break-even Analysis');
  if (p.budgetNotes) {
    checkPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text('NOTES & ASSUMPTIONS', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);

    const sanitised = p.budgetNotes
      .replace(/\u00b9\s*/g, 'Rs. ')
      .replace(/\u20b9\s*/g, 'Rs. ')
      .replace(/Rs\.\s{2,}/g, 'Rs. ');

    const raw = sanitised
      .split(/[,;]\s*(?=[A-Z]|Item:|Total)/)
      .map(s => s.trim())
      .filter(Boolean);

    const items = raw.length > 1 ? raw : sanitised.split(/\.\s+/).map(s => s.trim()).filter(Boolean);

    items.forEach(item => {
      const bullet = '\u2022 ' + item;
      const lines  = doc.splitTextToSize(bullet, CONTENT_W - 4);
      lines.forEach((line, li) => {
        checkPage(6);
        doc.text(line, li === 0 ? MARGIN : MARGIN + 4, y);
        y += 5;
      });
      y += 1;
    });
    y += 3;
  }

  // ════════════════════════════════
  // FOOTER on every page
  // ════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, 287, PAGE_W, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 185, 200);
    doc.text('ProposalHub — Digital University Kerala', MARGIN, 293);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, 293, { align: 'right' });
  }
  // ════════════════════════════════
  // SECTION 5 — COMPLIANCE AND GOVERNANCE
  // ════════════════════════════════
  sectionHeading('Section 5 — Compliance and Governance');

  // 5.1 Regulatory and Policy Compliance
  checkPage(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('5.1 Regulatory and Policy Compliance', MARGIN, y);
  y += 6;
  doc.setTextColor(...DARK);

  const compliance51 = [
    'The programme is proposed, designed, and will be executed in full compliance with the University Policy and Regulation on the Conduct of Executive Education and Continuing Education Programs (Revised 2025-26) of Digital University Kerala (KUDSIT).',
    'The assessment norms, grading, attendance requirements, academic integrity provisions, and SGPA/CGPA calculation shall be governed by the Examination Manual of Digital University Kerala as approved by the Board of Governors (BoG) and currently in force.',
    'Honoraria for all resource persons shall be governed by U.O. No. 505/2022/DUK dated 03.06.2022, as amended.',
    'Revenue collection, distribution, and financial accounting shall follow the CEECS Financial Norms (Revised 2025-26) and the prevailing financial regulations of the University.',
  ];
  compliance51.forEach(point => {
    checkPage(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`• ${point}`, CONTENT_W);
    lines.forEach(line => { checkPage(6); doc.text(line, MARGIN, y); y += 5; });
    y += 1;
  });
  y += 3;

  // 5.2 Signatory Authority
  checkPage(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('5.2 Signatory Authority', MARGIN, y);
  y += 5;
  doc.setTextColor(...DARK);

  table(
    ['Document / Action', 'Signatory Authority'],
    [
      ['Certificate of Completion (Academic Credential)', 'Dean Academic + Chair, CEECS'],
      ['Offer Letters to Selected Students', 'Chair, CEECS / CEECS Office'],
      ['Agreements / MoUs with Collaborating Organisations (if any)', 'Registrar, Digital University Kerala'],
      ['Programme Approval Communication', 'VC (after EC recommendation)'],
      ['Fee Collection Receipts', 'Finance Office / CEECS Office, Digital University Kerala'],
      ['Programme Completion Report', 'Programme Coordinator + Chair, CEECS'],
      ['Revenue Distribution Orders', 'Registrar / Finance Office, Digital University Kerala'],
      ['NAD Credit Upload Authorisation', 'Dean Academic and Academic office, Digital University Kerala'],
    ],
    null
  );

  // 5.3 Documents to be Maintained
  checkPage(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('5.3 Documents to be Maintained', MARGIN, y);
  y += 5;
  doc.setTextColor(...DARK);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const doc53intro = doc.splitTextToSize(
    'The following documents shall be maintained by the Programme Coordinator and produced to CEECS / University administration as and when required:',
    CONTENT_W
  );
  doc53intro.forEach(line => { checkPage(6); doc.text(line, MARGIN, y); y += 5; });
  y += 2;
  doc.setTextColor(...DARK);

  const docs53 = [
    'Attendance records of all participants for each session, maintained daily.',
    'Copies of all academic and non-academic materials shared with participants.',
    'Continuous assessment records: quiz scripts, assignment submissions, lab records, presentation evaluation sheets.',
    'Completed programme feedback forms from all participants (in CEECS standard format).',
    'Consumable and Non-Consumable Register for all equipment and materials purchased/used.',
    'Travel Record Register for all travel expenditures (if any).',
    'Correspondence file: all communications since programme initiation.',
    'A copy of the Completion Certificate (master copy) and Programme Completion Report.',
    'APAAR ID records of all enrolled participants (for NAD credit upload).',
    'Financial settlement records: fee receipts, expenditure vouchers, and revenue distribution documents.',
  ];
  docs53.forEach(point => {
    checkPage(8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`• ${point}`, CONTENT_W);
    lines.forEach(line => { checkPage(6); doc.text(line, MARGIN, y); y += 5; });
    y += 1;
  });
  y += 3;

  // 5.4 General Governance Rules
  checkPage(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('5.4 General Governance Rules Applicable', MARGIN, y);
  y += 5;
  doc.setTextColor(...DARK);

  const governance54 = [
    'The programme must generate a minimum surplus of 10% of gross revenue. If this is not achievable at minimum enrolment, the Programme Coordinator must seek explicit relaxation from the Chair, CEECS, with justification, before commencement.',
    'The permissible level of engagement of external organisations/resources in execution is limited to 50% of total programme delivery.',
    'The Programme Coordinator may not proceed on extended leave during the programme period without designating a substitute approved by CEECS.',
    'Any postponement or cancellation must be communicated to CEECS at least 10 days before commencement, and to all enrolled participants at least 7 days before commencement.',
    'Refund of fees in case of cancellation must be processed by CEECS within the stipulated period.',
    'Any dispute arising during the programme shall be resolved by the Chair, CEECS; the decision of the Vice Chancellor shall be final in all matters.',
  ];
  governance54.forEach(point => {
    checkPage(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`• ${point}`, CONTENT_W);
    lines.forEach(line => { checkPage(6); doc.text(line, MARGIN, y); y += 5; });
    y += 1;
  });
  y += 4;

  // Final signature line
  checkPage(20);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + 60, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(p.submittedBy || 'Programme Proposer', MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(p.designation || '', MARGIN, y);
  y += 4;
  doc.text(`Date: ${p.submissionDate || new Date().toLocaleDateString('en-IN')}`, MARGIN, y);
  // ── Save
  const filename = `${(p.programmeName || 'Proposal').replace(/[^a-z0-9]/gi, '_')}_Report.pdf`;
  doc.save(filename);
  showToast('📄 PDF exported successfully!', 'var(--green)');
}
let pendingDeleteIdx = null;

function deleteProposal(idx) {
  pendingDeleteIdx = idx;
  const modal = document.getElementById('deleteModal');
  modal.style.display = 'flex';
}

async function confirmDelete() {
  document.getElementById('deleteModal').style.display = 'none';
  const idx = pendingDeleteIdx;
  if (idx === null) return;
  const proposal = proposals[idx];
  try {
    await fetch(`/api/proposals/${proposal.id}`, { method: 'DELETE' });
    proposals.splice(idx, 1);
    selectedIdx = null;
    selectedProposalId = null;
    document.getElementById('reviewPanel').style.display = 'none';
    document.getElementById('summaryPanel').style.display = 'none';
    document.getElementById('chatbotPanel').style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
    renderProposalList();
    showToast('🗑️ Proposal deleted', 'var(--red)');
  } catch {
    showToast('⚠️ Could not delete proposal', 'var(--red)');
  }
  pendingDeleteIdx = null;
}