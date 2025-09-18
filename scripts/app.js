const STAGES = [
  'Applied',
  'Reviewed',
  'Approved',
  'Interview Scheduled',
  'Hired',
  'Rejected'
];

const API_ROUTES = {
  state: '/api/state',
  candidates: '/api/candidates',
  interviews: '/api/interviews',
  recruiters: '/api/recruiters'
};

const state = {
  view: 'admin',
  theme: 'light',
  filters: {
    recruiter: 'all',
    stage: 'all',
    skill: 'all',
    search: ''
  },
  recruiterFilters: {
    range: 'today',
    queue: 'all'
  },
  baseline: {
    totalCandidates: 0,
    pendingReviews: 0,
    approved: 0,
    interviews: 0,
    avgTimeToHire: 0
  },
  recruiters: [],
  candidates: [],
  interviews: [],
  activeRecruiterId: null,
  isLoading: false
};

function applyRemoteState(data) {
  if (!data || typeof data !== 'object') return;
  state.baseline = {
    ...state.baseline,
    ...(data.baseline || {})
  };
  state.recruiters = Array.isArray(data.recruiters) ? data.recruiters : [];
  state.candidates = Array.isArray(data.candidates) ? data.candidates : [];
  state.interviews = Array.isArray(data.interviews) ? data.interviews : [];
  state.activeRecruiterId =
    data.activeRecruiterId || state.activeRecruiterId || state.recruiters[0]?.id || null;
  ensureActiveRecruiter();
}

function ensureActiveRecruiter() {
  if (!state.recruiters.length) {
    state.activeRecruiterId = null;
    return;
  }
  const hasActive = state.recruiters.some((recruiter) => recruiter.id === state.activeRecruiterId);
  if (!hasActive) {
    state.activeRecruiterId = state.recruiters[0].id;
  }
}

function mergeCandidate(updatedCandidate) {
  if (!updatedCandidate || !updatedCandidate.id) return;
  const index = state.candidates.findIndex((candidate) => candidate.id === updatedCandidate.id);
  if (index >= 0) {
    state.candidates[index] = {
      ...state.candidates[index],
      ...updatedCandidate
    };
  } else {
    state.candidates.push(updatedCandidate);
  }
}

function mergeRecruiter(updatedRecruiter) {
  if (!updatedRecruiter || !updatedRecruiter.id) return;
  const index = state.recruiters.findIndex((recruiter) => recruiter.id === updatedRecruiter.id);
  if (index >= 0) {
    state.recruiters[index] = {
      ...state.recruiters[index],
      ...updatedRecruiter
    };
  } else {
    state.recruiters.push(updatedRecruiter);
  }
  ensureActiveRecruiter();
}

function mergeInterview(updatedInterview) {
  if (!updatedInterview || !updatedInterview.id) return;
  const index = state.interviews.findIndex((interview) => interview.id === updatedInterview.id);
  if (index >= 0) {
    state.interviews[index] = {
      ...state.interviews[index],
      ...updatedInterview
    };
  } else {
    state.interviews.push(updatedInterview);
  }
}

async function apiRequest(path, options = {}) {
  const { body, headers, ...rest } = options;
  const config = {
    method: 'GET',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(headers || {})
    }
  };

  if (body !== undefined) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
    config.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, config);
  let payload = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const message = payload?.error || `Request to ${path} failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function hydrateStateFromApi() {
  state.isLoading = true;
  try {
    const payload = await apiRequest(API_ROUTES.state);
    applyRemoteState(payload?.data || payload);
  } catch (error) {
    console.error('Failed to load recruitment state from API.', error);
    try {
      const fallbackResponse = await fetch('data/seed.json');
      if (fallbackResponse.ok) {
        const fallback = await fallbackResponse.json();
        applyRemoteState(fallback);
        pushToast('Loaded local sample data while the API is unreachable.', 'warning');
        return;
      }
    } catch (fallbackError) {
      console.error('Failed to load fallback data.', fallbackError);
    }
    pushToast('Unable to load recruitment data. Please try again shortly.', 'warning');
  } finally {
    state.isLoading = false;
  }
}

const elements = {
  adminSection: document.getElementById('admin-dashboard'),
  recruiterSection: document.getElementById('recruiter-dashboard'),
  globalSearch: document.getElementById('global-search'),
  filterRecruiter: document.getElementById('filter-recruiter'),
  filterStage: document.getElementById('filter-stage'),
  filterSkill: document.getElementById('filter-skill'),
  kpiContainer: document.getElementById('global-kpis'),
  recruiterPerformance: document.getElementById('recruiter-performance'),
  timeToDecisionTable: document.querySelector('#time-to-decision-table tbody'),
  funnelContainer: document.getElementById('funnel-visualization'),
  assignmentTableBody: document.querySelector('#assignment-table tbody'),
  selectAllCheckbox: document.getElementById('select-all'),
  rosterList: document.getElementById('recruiter-list'),
  addRecruiterForm: document.getElementById('add-recruiter-form'),
  recruiterViewSelector: document.getElementById('recruiter-view-selector'),
  recruiterFocus: document.getElementById('recruiter-focus'),
  recruiterQueueFilter: document.getElementById('recruiter-candidate-filter'),
  recruiterProgressRing: document.getElementById('recruiter-progress-ring'),
  recruiterMetrics: document.getElementById('recruiter-metrics'),
  recruiterQueue: document.getElementById('recruiter-queue'),
  recruiterNotifications: document.getElementById('recruiter-notifications'),
  interviewForm: document.getElementById('interview-form'),
  interviewCandidateSelect: document.getElementById('interview-candidate'),
  interviewDate: document.getElementById('interview-date'),
  interviewTime: document.getElementById('interview-time'),
  interviewMode: document.getElementById('interview-mode'),
  interviewLocation: document.getElementById('interview-location'),
  upcomingInterviews: document.getElementById('upcoming-interviews'),
  bulkApprove: document.getElementById('bulk-approve'),
  bulkReject: document.getElementById('bulk-reject'),
  bulkSchedule: document.getElementById('bulk-schedule'),
  themeToggle: document.getElementById('theme-toggle'),
  toastContainer: document.getElementById('toast-container'),
  viewToggleButtons: document.querySelectorAll('.toggle-button'),
  exportCsv: document.getElementById('export-csv'),
  exportPdf: document.getElementById('export-pdf'),
  year: document.getElementById('year')
};

document.body.classList.remove('theme-dark');
document.body.classList.add('theme-light');

elements.year.textContent = new Date().getFullYear();

initialize().catch((error) => {
  console.error('Failed to initialise the MW Recruitment Platform.', error);
  pushToast('The dashboard could not start correctly. Please refresh to retry.', 'warning');
});

async function initialize() {
  setupEventListeners();
  await hydrateStateFromApi();
  populateRecruiterOptions();
  populateSkillFilter();
  updateView();
  renderAll();
}

function setupEventListeners() {
  elements.viewToggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      if (state.view === view) return;
      state.view = view;
      elements.viewToggleButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      updateView();
    });
  });

  elements.globalSearch.addEventListener('input', (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderAdminPanels();
  });

  elements.filterRecruiter.addEventListener('change', (event) => {
    state.filters.recruiter = event.target.value;
    renderAdminPanels();
  });

  elements.filterStage.addEventListener('change', (event) => {
    state.filters.stage = event.target.value;
    renderAdminPanels();
  });

  elements.filterSkill.addEventListener('change', (event) => {
    state.filters.skill = event.target.value;
    renderAdminPanels();
  });

  elements.selectAllCheckbox.addEventListener('change', (event) => {
    const checked = event.target.checked;
    elements.assignmentTableBody.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = checked;
    });
  });

  elements.bulkApprove.addEventListener('click', () => handleBulkAction('Approved'));
  elements.bulkReject.addEventListener('click', () => handleBulkAction('Rejected'));
  elements.bulkSchedule.addEventListener('click', () => handleBulkSchedule());

  elements.addRecruiterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = formData.get('name').trim();
    const email = formData.get('email').trim();
    const target = Number(formData.get('target')) || 10;
    if (!name || !email) {
      pushToast('Please provide a name and email for the recruiter.', 'warning');
      return;
    }

    const recruiter = await createRecruiter({
      name,
      email,
      weeklyTarget: target
    });
    if (!recruiter) return;
    state.activeRecruiterId = recruiter.id;
    populateRecruiterOptions();
    renderAll();
    event.target.reset();
    pushToast(`${recruiter.name} was added to the recruiter roster.`, 'success');
  });

  elements.recruiterViewSelector.addEventListener('change', (event) => {
    state.activeRecruiterId = event.target.value;
    renderRecruiterPanels();
  });

  elements.recruiterFocus.addEventListener('change', (event) => {
    state.recruiterFilters.range = event.target.value;
    updateFocusSubtitle();
  });

  elements.recruiterQueueFilter.addEventListener('change', (event) => {
    state.recruiterFilters.queue = event.target.value;
    renderRecruiterQueue();
  });

  elements.recruiterQueue.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('button[data-action]');
    if (!actionButton) return;
    const { action, id } = actionButton.dataset;
    if (!id) return;
    let requiresRefresh = false;
    if (action === 'approve') {
      const updated = await updateCandidateStage(id, 'Approved');
      if (updated) {
        pushToast('Candidate approved for interview.', 'success');
        requiresRefresh = true;
      }
    } else if (action === 'reject') {
      const updated = await updateCandidateStage(id, 'Rejected');
      if (updated) {
        pushToast('Candidate marked as rejected.', 'warning');
        requiresRefresh = true;
      }
    } else if (action === 'schedule') {
      prefillInterviewForm(id);
      pushToast('Candidate pre-filled in interview scheduler.', 'success');
    } else if (action === 'cv') {
      const candidate = getCandidate(id);
      if (candidate?.cvFile) {
        pushToast(`CV ready for download: ${candidate.cvFile}`, 'success');
      } else {
        pushToast('No CV uploaded yet. Request documents from the candidate.', 'warning');
      }
    }
    if (requiresRefresh) {
      renderAll();
    }
  });

  elements.assignmentTableBody.addEventListener('change', async (event) => {
    const select = event.target;
    if (select.matches('.assignment-select')) {
      const candidateId = select.dataset.id;
      const updated = await updateCandidateRecruiter(candidateId, select.value);
      if (updated) {
        pushToast('Candidate reassigned successfully.', 'success');
        renderAll();
      }
    }

    if (select.matches('.stage-select')) {
      const candidateId = select.dataset.id;
      const updated = await updateCandidateStage(candidateId, select.value);
      if (updated) {
        pushToast('Candidate stage updated.', 'success');
        renderAll();
      }
    }

    if (select.matches('.cv-upload')) {
      const candidateId = select.dataset.id;
      const file = select.files?.[0];
      if (file) {
        const updated = await updateCandidateCvFile(candidateId, file.name);
        if (updated) {
          pushToast(`CV for ${updated.name} uploaded: ${file.name}`, 'success');
          renderAssignmentTable();
        }
      }
    }

    if (select.matches("input[type='checkbox']")) {
      const allChecked =
        elements.assignmentTableBody.querySelectorAll("input[type='checkbox']").length > 0 &&
        Array.from(elements.assignmentTableBody.querySelectorAll("input[type='checkbox']")).every(
          (checkbox) => checkbox.checked
        );
      elements.selectAllCheckbox.checked = allChecked;
    }
  });

  elements.assignmentTableBody.addEventListener('click', (event) => {
    if (event.target.matches('.download-cv')) {
      const candidateId = event.target.dataset.id;
      const candidate = getCandidate(candidateId);
      if (candidate?.cvFile) {
        pushToast(`Download ${candidate.cvFile} from the ATS.`, 'success');
      } else {
        pushToast('No CV uploaded yet.', 'warning');
      }
    }
  });

  elements.interviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const candidateId = elements.interviewCandidateSelect.value;
    const recruiterId = state.activeRecruiterId;
    const date = elements.interviewDate.value;
    const time = elements.interviewTime.value;
    const mode = elements.interviewMode.value;
    const location = elements.interviewLocation.value.trim() || (mode === 'Virtual' ? 'Virtual' : 'Headquarters');
    if (!candidateId || !date || !time) {
      pushToast('Please provide candidate, date and time to schedule.', 'warning');
      return;
    }

    const result = await scheduleInterview({
      candidateId,
      recruiterId,
      date,
      time,
      mode,
      location
    });
    if (!result) return;
    elements.interviewForm.reset();
    prefillInterviewForm(null);
    pushToast('Interview scheduled and candidate notified.', 'success');
    renderRecruiterPanels();
    renderAdminPanels();
  });

  elements.exportCsv.addEventListener('click', exportToCsv);
  elements.exportPdf.addEventListener('click', () => {
    window.print();
    pushToast('Print dialog opened. Save as PDF to share the report.', 'success');
  });

  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', state.theme === 'dark');
    document.body.classList.toggle('theme-light', state.theme === 'light');
    elements.themeToggle.querySelector('.icon').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  });
}

function updateView() {
  elements.adminSection.classList.toggle('is-visible', state.view === 'admin');
  elements.recruiterSection.classList.toggle('is-visible', state.view === 'recruiter');
  if (state.view === 'admin') {
    renderAdminPanels();
  } else {
    renderRecruiterPanels();
  }
}

function renderAll() {
  renderAdminPanels();
  renderRecruiterPanels();
}

function renderAdminPanels() {
  renderGlobalKpis();
  renderRecruiterPerformance();
  renderTimeToDecision();
  renderFunnel();
  renderAssignmentTable();
  renderRecruiterRoster();
}

function renderRecruiterPanels() {
  if (!state.activeRecruiterId) {
    state.activeRecruiterId = state.recruiters[0]?.id || null;
  }
  updateRecruiterSelector();
  updateFocusSubtitle();
  renderRecruiterProgress();
  renderRecruiterQueue();
  renderRecruiterNotifications();
  renderInterviewOptions();
  renderUpcomingInterviews();
}

function populateRecruiterOptions() {
  const recruiterOptions = state.recruiters
    .map((recruiter) => `<option value="${recruiter.id}">${recruiter.name}</option>`)
    .join('');
  elements.filterRecruiter.innerHTML = `<option value="all">All Recruiters</option>${recruiterOptions}`;
  updateRecruiterSelector();
}

function updateRecruiterSelector() {
  elements.recruiterViewSelector.innerHTML = state.recruiters
    .map((recruiter) => `<option value="${recruiter.id}">${recruiter.name}</option>`)
    .join('');
  if (state.activeRecruiterId && !state.recruiters.find((r) => r.id === state.activeRecruiterId)) {
    state.activeRecruiterId = state.recruiters[0]?.id || null;
  }
  if (state.activeRecruiterId) {
    elements.recruiterViewSelector.value = state.activeRecruiterId;
  }
}

function populateSkillFilter() {
  const skills = new Set();
  state.candidates.forEach((candidate) => {
    candidate.skills.forEach((skill) => skills.add(skill));
  });
  elements.filterSkill.innerHTML =
    '<option value="all">All Skills</option>' +
    Array.from(skills)
      .sort()
      .map((skill) => `<option value="${skill}">${skill}</option>`)
      .join('');
}

function renderGlobalKpis() {
  const totalCandidates = state.candidates.length;
  const pendingReviews = state.candidates.filter((c) => ['Applied', 'Reviewed'].includes(c.stage)).length;
  const approved = state.candidates.filter((c) => c.stage === 'Approved').length;
  const interviews = state.candidates.filter((c) => c.stage === 'Interview Scheduled').length;
  const hiredCandidates = state.candidates.filter((c) => c.stage === 'Hired');
  const avgTimeToHire = hiredCandidates.length
    ? Math.round(
        hiredCandidates.reduce((acc, candidate) => {
          if (!candidate.stageCompleted) return acc;
          const start = new Date(candidate.stageStarted);
          const end = new Date(candidate.stageCompleted);
          const diff = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
          return acc + diff;
        }, 0) / hiredCandidates.length
      )
    : 0;

  const kpis = [
    {
      title: 'Total Candidates',
      value: totalCandidates,
      delta: totalCandidates - state.baseline.totalCandidates
    },
    {
      title: 'Pending Reviews',
      value: pendingReviews,
      delta: pendingReviews - state.baseline.pendingReviews
    },
    {
      title: 'Approved',
      value: approved,
      delta: approved - state.baseline.approved
    },
    {
      title: 'Interviews Scheduled',
      value: interviews,
      delta: interviews - state.baseline.interviews
    },
    {
      title: 'Avg Days to Hire',
      value: `${avgTimeToHire || 0}d`,
      delta: avgTimeToHire ? avgTimeToHire - state.baseline.avgTimeToHire : 0
    }
  ];

  elements.kpiContainer.innerHTML = kpis
    .map((kpi) => {
      const deltaClass = kpi.delta >= 0 ? 'positive' : 'negative';
      const deltaIcon = kpi.delta >= 0 ? '▲' : '▼';
      const deltaValue = `${deltaIcon} ${Math.abs(kpi.delta)}`;
      return `
        <article class="kpi-card">
          <header>
            <p class="kpi-title">${kpi.title}</p>
          </header>
          <p class="kpi-value">${formatNumber(kpi.value)}</p>
          <span class="kpi-delta ${deltaClass}">${deltaValue} vs last week</span>
        </article>
      `;
    })
    .join('');
}

function renderRecruiterPerformance() {
  const performanceCards = state.recruiters.map((recruiter) => {
    const assigned = state.candidates.filter((candidate) => candidate.assignedRecruiterId === recruiter.id);
    const stageCounts = countByStage(assigned);
    const processed = stageCounts.Reviewed + stageCounts.Approved + stageCounts['Interview Scheduled'] + stageCounts.Hired + stageCounts.Rejected;
    const progress = recruiter.weeklyTarget
      ? Math.min(100, Math.round((processed / recruiter.weeklyTarget) * 100))
      : 0;
    const pending = stageCounts.Applied;

    return `
      <article class="recruiter-card">
        <header>
          <h4>${recruiter.name}</h4>
          <p>${recruiter.specialty}</p>
          <span class="badge">${assigned.length} candidates</span>
        </header>
        <div>
          <div class="progress-bar" aria-label="${progress}% of weekly target achieved">
            <span style="width:${progress}%"></span>
          </div>
          <div class="recruiter-kpis">
            <span class="tag">Processed<strong>${processed}</strong></span>
            <span class="tag">Pending<strong>${pending}</strong></span>
            <span class="tag">Interviews<strong>${stageCounts['Interview Scheduled']}</strong></span>
          </div>
        </div>
        <div class="recruiter-kpis">
          <span class="tag">Approved<strong>${stageCounts.Approved}</strong></span>
          <span class="tag">Rejected<strong>${stageCounts.Rejected}</strong></span>
          <span class="tag">Hired<strong>${stageCounts.Hired}</strong></span>
        </div>
      </article>
    `;
  });
  elements.recruiterPerformance.innerHTML = performanceCards.join('');
}

function renderTimeToDecision() {
  elements.timeToDecisionTable.innerHTML = state.recruiters
    .map((recruiter) => {
      const times = recruiter.decisionTimes;
      return `
        <tr>
          <td>${recruiter.name}</td>
          <td>${times.Reviewed}h</td>
          <td>${times.Approved}h</td>
          <td>${times.Rejected}h</td>
          <td>${times['Interview Scheduled']}h</td>
          <td>${times.Hired}h</td>
        </tr>
      `;
    })
    .join('');
}

function renderFunnel() {
  const totals = countByStage(state.candidates);
  const totalCandidates = state.candidates.length || 1;
  elements.funnelContainer.innerHTML = STAGES.map((stage) => {
    const count = totals[stage];
    const percentage = Math.round((count / totalCandidates) * 100);
    return `
      <div class="funnel-step" data-percentage="${percentage}">
        <p class="input-label">${stage}</p>
        <strong>${count}</strong>
        <p>${percentage}% of total</p>
      </div>
    `;
  }).join('');
}

function renderAssignmentTable() {
  const filtered = getFilteredCandidates();
  const rows = filtered
    .map((candidate) => {
      const recruiterOptions = state.recruiters
        .map(
          (recruiter) =>
            `<option value="${recruiter.id}" ${candidate.assignedRecruiterId === recruiter.id ? 'selected' : ''}>${recruiter.name}</option>`
        )
        .join('');
      const skillChips = candidate.skills
        .map((skill) => `<span class="tag">${skill}</span>`)
        .join('');
      const timeInStage = formatTimeInStage(candidate);
      return `
        <tr data-id="${candidate.id}">
          <td><input type="checkbox" class="candidate-select" data-id="${candidate.id}" /></td>
          <td>
            <div>
              <strong>${candidate.name}</strong>
              <p class="text-muted">${candidate.role}</p>
              <p class="text-muted">${candidate.location}</p>
            </div>
          </td>
          <td>
            <select class="assignment-select" data-id="${candidate.id}">
              <option value="">Unassigned</option>
              ${recruiterOptions}
            </select>
          </td>
          <td>
            <div class="recruiter-kpis">${skillChips}</div>
          </td>
          <td>${candidate.experience}+ yrs</td>
          <td>
            <select class="stage-select" data-id="${candidate.id}">
              ${STAGES.map((stage) => `<option value="${stage}" ${candidate.stage === stage ? 'selected' : ''}>${stage}</option>`).join('')}
            </select>
          </td>
          <td>${timeInStage}</td>
          <td>
            ${candidate.cvFile ? `<button class="ghost download-cv" data-id="${candidate.id}">Download</button>` : `<label class="ghost" role="button">Upload<input class="cv-upload" data-id="${candidate.id}" type="file" accept=".pdf,.doc,.docx" hidden /></label>`}
          </td>
        </tr>
      `;
    })
    .join('');
  elements.assignmentTableBody.innerHTML = rows || `<tr><td colspan="8">No candidates match the selected filters.</td></tr>`;
}

function renderRecruiterRoster() {
  elements.rosterList.innerHTML = state.recruiters
    .map((recruiter) => {
      const assignedCount = state.candidates.filter((candidate) => candidate.assignedRecruiterId === recruiter.id).length;
      return `
        <li class="list-item" data-id="${recruiter.id}">
          <div>
            <strong>${recruiter.name}</strong>
            <p>${recruiter.specialty}</p>
          </div>
          <div class="recruiter-kpis">
            <span class="tag">Assigned<strong>${assignedCount}</strong></span>
            <button class="ghost" data-action="remove" data-id="${recruiter.id}">Remove</button>
          </div>
        </li>
      `;
    })
    .join('');

  elements.rosterList.querySelectorAll('button[data-action="remove"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const recruiterId = button.dataset.id;
      const recruiter = getRecruiter(recruiterId);
      if (!recruiter) return;
      const removed = await removeRecruiter(recruiterId);
      if (removed) {
        pushToast(`${recruiter.name} removed from the roster.`, 'warning');
        populateRecruiterOptions();
        renderAll();
      }
    });
  });
}

function renderRecruiterProgress() {
  const recruiter = getActiveRecruiter();
  if (!recruiter) {
    elements.recruiterProgressRing.style.setProperty('--progress', 0);
    elements.recruiterProgressRing.setAttribute('data-progress', '0%');
    elements.recruiterMetrics.innerHTML = '<p class="text-muted">Add a recruiter to see performance metrics.</p>';
    return;
  }
  const assigned = state.candidates.filter((candidate) => candidate.assignedRecruiterId === recruiter.id);
  const stageCounts = countByStage(assigned);
  const processed = stageCounts.Reviewed + stageCounts.Approved + stageCounts['Interview Scheduled'] + stageCounts.Hired + stageCounts.Rejected;
  const progress = recruiter.weeklyTarget
    ? Math.min(100, Math.round((processed / recruiter.weeklyTarget) * 100))
    : 0;

  elements.recruiterProgressRing.style.setProperty('--progress', progress);
  elements.recruiterProgressRing.setAttribute('data-progress', `${progress}%`);
  elements.recruiterMetrics.innerHTML = `
    <div>
      <dt>Assigned</dt>
      <dd>${assigned.length}</dd>
    </div>
    <div>
      <dt>Processed</dt>
      <dd>${processed}</dd>
    </div>
    <div>
      <dt>Pending</dt>
      <dd>${stageCounts.Applied}</dd>
    </div>
    <div>
      <dt>Interviews</dt>
      <dd>${stageCounts['Interview Scheduled']}</dd>
    </div>
  `;
}

function renderRecruiterQueue() {
  const recruiter = getActiveRecruiter();
  if (!recruiter) {
    elements.recruiterQueue.innerHTML = '<p class="text-muted">Assign or add a recruiter to view their queue.</p>';
    elements.recruiterNotifications.innerHTML = '<p class="text-muted">No notifications available.</p>';
    elements.upcomingInterviews.innerHTML = '<p>No upcoming interviews yet.</p>';
    return;
  }
  const filtered = getRecruiterQueueCandidates(recruiter.id);
  elements.recruiterQueue.innerHTML = filtered
    .map((candidate) => {
      const timeInStage = formatTimeInStage(candidate);
      const notifications = buildCandidateAlerts(candidate);
      const notificationBadges = notifications
        .map((note) => `<span class="badge">${note}</span>`)
        .join('');
      return `
        <article class="queue-card" data-id="${candidate.id}">
          <header>
            <h4>${candidate.name}</h4>
            <span class="badge">${candidate.stage}</span>
          </header>
          <p class="text-muted">${candidate.role} · ${candidate.location}</p>
          <div class="meta">
            <span>${candidate.experience}+ yrs experience</span>
            <span>${candidate.skills.slice(0, 3).join(' • ')}</span>
            <span>${timeInStage} in stage</span>
          </div>
          <div class="meta">${notificationBadges}</div>
          <div class="actions">
            <button class="ghost" data-action="cv" data-id="${candidate.id}">Review CV</button>
            <button class="ghost" data-action="reject" data-id="${candidate.id}">Reject</button>
            <button class="primary" data-action="approve" data-id="${candidate.id}">Approve</button>
            <button class="primary" data-action="schedule" data-id="${candidate.id}">Schedule Interview</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderRecruiterNotifications() {
  const recruiter = getActiveRecruiter();
  if (!recruiter) {
    elements.recruiterNotifications.innerHTML = '<li class="list-item"><p>No notifications available.</p></li>';
    return;
  }
  const notifications = buildNotificationsForRecruiter(recruiter.id);
  elements.recruiterNotifications.innerHTML = notifications.length
    ? notifications
        .map((notification) => `
          <li class="list-item">
            <div>
              <strong>${notification.title}</strong>
              <p>${notification.description}</p>
            </div>
            <span class="badge">${notification.tag}</span>
          </li>
        `)
        .join('')
    : '<li class="list-item"><p>No pending notifications 🎉</p></li>';
}

function renderInterviewOptions() {
  const recruiterId = state.activeRecruiterId;
  const candidates = state.candidates.filter((candidate) => candidate.assignedRecruiterId === recruiterId);
  elements.interviewCandidateSelect.innerHTML =
    '<option value="" disabled selected>Select candidate</option>' +
    candidates
      .map((candidate) => `<option value="${candidate.id}">${candidate.name} · ${candidate.stage}</option>`)
      .join('');
}

function renderUpcomingInterviews() {
  const recruiterId = state.activeRecruiterId;
  const upcoming = state.interviews
    .filter((interview) => interview.recruiterId === recruiterId)
    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
  elements.upcomingInterviews.innerHTML = upcoming.length
    ? upcoming
        .map((interview) => {
          const candidate = getCandidate(interview.candidateId);
          const date = new Date(`${interview.date}T${interview.time}`);
          const formatted = date.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
          return `
            <article class="schedule-item">
              <strong>${candidate?.name || 'Candidate'}</strong>
              <span>${formatted} · ${interview.mode}</span>
              <span>${interview.location}</span>
            </article>
          `;
        })
        .join('')
    : '<p>No upcoming interviews yet.</p>';
}

async function handleBulkAction(stage) {
  const selectedIds = getSelectedCandidateIds();
  if (!selectedIds.length) {
    pushToast('Select at least one candidate to apply a bulk action.', 'warning');
    return;
  }
  const results = await Promise.allSettled(selectedIds.map((id) => updateCandidateStage(id, stage)));
  const successful = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  const failed = selectedIds.length - successful;
  if (successful) {
    pushToast(`Updated ${successful} candidate${successful === 1 ? '' : 's'} to ${stage}.`, 'success');
    renderAll();
  }
  if (failed) {
    pushToast(`${failed} update${failed === 1 ? '' : 's'} could not be completed.`, 'warning');
  }
}

async function handleBulkSchedule() {
  const selectedIds = getSelectedCandidateIds();
  if (!selectedIds.length) {
    pushToast('Select candidates to bulk schedule interviews.', 'warning');
    return;
  }
  const startDate = new Date();
  const tasks = selectedIds.map((id, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + (index % 3));
    const isoDate = date.toISOString().split('T')[0];
    const time = ['09:00', '11:00', '14:30'][index % 3];
    const recruiterId = getCandidate(id)?.assignedRecruiterId || state.activeRecruiterId;
    return scheduleInterview({
      candidateId: id,
      recruiterId,
      date: isoDate,
      time,
      mode: 'Virtual',
      location: 'Teams • autogenerated'
    });
  });
  const outcomes = await Promise.allSettled(tasks);
  const successes = outcomes.filter((result) => result.status === 'fulfilled' && result.value).length;
  const failures = selectedIds.length - successes;
  if (successes) {
    pushToast(`Scheduled interviews for ${successes} candidate${successes === 1 ? '' : 's'}.`, 'success');
    renderAll();
  }
  if (failures) {
    pushToast(`${failures} interview${failures === 1 ? '' : 's'} could not be scheduled.`, 'warning');
  }
}

function exportToCsv() {
  const headers = ['Candidate', 'Recruiter', 'Stage', 'Experience (yrs)', 'Skills'];
  const rows = state.candidates.map((candidate) => {
    const recruiter = getRecruiter(candidate.assignedRecruiterId)?.name || 'Unassigned';
    return [candidate.name, recruiter, candidate.stage, candidate.experience, candidate.skills.join(' | ')];
  });
  const csvContent = [headers.join(','), ...rows.map((row) => row.map((value) => `"${value}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mw-recruitment-report.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  pushToast('CSV export generated successfully.', 'success');
}

function getFilteredCandidates() {
  return state.candidates.filter((candidate) => {
    if (state.filters.recruiter !== 'all' && candidate.assignedRecruiterId !== state.filters.recruiter) {
      return false;
    }
    if (state.filters.stage !== 'all' && candidate.stage !== state.filters.stage) {
      return false;
    }
    if (state.filters.skill !== 'all' && !candidate.skills.includes(state.filters.skill)) {
      return false;
    }
    if (state.filters.search) {
      const haystack = `${candidate.name} ${candidate.role} ${candidate.stage} ${candidate.skills.join(' ')}`.toLowerCase();
      if (!haystack.includes(state.filters.search)) {
        return false;
      }
    }
    return true;
  });
}

function getRecruiterQueueCandidates(recruiterId) {
  const queue = state.candidates.filter((candidate) => candidate.assignedRecruiterId === recruiterId);
  return queue.filter((candidate) => {
    const filter = state.recruiterFilters.queue;
    if (filter === 'pending') {
      return ['Applied', 'Reviewed'].includes(candidate.stage);
    }
    if (filter === 'interview') {
      return candidate.stage === 'Interview Scheduled';
    }
    if (filter === 'approved') {
      return candidate.stage === 'Approved';
    }
    return true;
  });
}

function countByStage(candidates) {
  return STAGES.reduce((acc, stage) => {
    acc[stage] = candidates.filter((candidate) => candidate.stage === stage).length;
    return acc;
  }, {});
}

function formatNumber(value) {
  return typeof value === 'number' ? value.toLocaleString() : value;
}

function formatTimeInStage(candidate) {
  if (!candidate.stageStarted) return '—';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(candidate.stageStarted).getTime()) / (1000 * 60 * 60 * 24)));
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day';
  return `${diff} days`;
}

async function mutateCandidate(candidateId, updates) {
  if (!candidateId) return null;
  try {
    const response = await apiRequest(API_ROUTES.candidates, {
      method: 'PATCH',
      body: {
        id: candidateId,
        ...updates
      }
    });
    const updatedCandidate = response?.candidate || response;
    if (updatedCandidate) {
      mergeCandidate(updatedCandidate);
      return updatedCandidate;
    }
  } catch (error) {
    console.error('Failed to update candidate.', error);
    pushToast(error.message || 'Unable to update candidate information.', 'warning');
  }
  return null;
}

async function updateCandidateStage(candidateId, stage) {
  if (!stage) return null;
  const updated = await mutateCandidate(candidateId, { stage });
  if (updated && stage === 'Interview Scheduled') {
    pushToast(`${updated.name} moved to interview scheduling.`, 'success');
  }
  return updated;
}

async function updateCandidateRecruiter(candidateId, recruiterId) {
  if (recruiterId === undefined) return null;
  const updated = await mutateCandidate(candidateId, { assignedRecruiterId: recruiterId });
  if (updated) {
    ensureActiveRecruiter();
  }
  return updated;
}

async function updateCandidateCvFile(candidateId, fileName) {
  if (!fileName) return null;
  return mutateCandidate(candidateId, { cvFile: fileName });
}

async function scheduleInterview({ candidateId, recruiterId, date, time, mode, location }) {
  if (!candidateId || !date || !time) return null;
  try {
    const response = await apiRequest(API_ROUTES.interviews, {
      method: 'POST',
      body: {
        candidateId,
        recruiterId,
        date,
        time,
        mode,
        location
      }
    });
    const interview = response?.interview;
    const candidate = response?.candidate;
    if (interview) {
      mergeInterview(interview);
    }
    if (candidate) {
      mergeCandidate(candidate);
    }
    return interview || candidate || true;
  } catch (error) {
    console.error('Failed to schedule interview.', error);
    pushToast(error.message || 'Unable to schedule the interview.', 'warning');
    return null;
  }
}

async function createRecruiter({ name, email, weeklyTarget }) {
  if (!name || !email) return null;
  try {
    const response = await apiRequest(API_ROUTES.recruiters, {
      method: 'POST',
      body: {
        name,
        email,
        weeklyTarget
      }
    });
    const recruiter = response?.recruiter || response;
    if (recruiter) {
      mergeRecruiter(recruiter);
      return recruiter;
    }
  } catch (error) {
    console.error('Failed to add recruiter.', error);
    pushToast(error.message || 'Unable to add recruiter.', 'warning');
  }
  return null;
}

async function removeRecruiter(recruiterId) {
  if (!recruiterId) return false;
  try {
    const response = await apiRequest(API_ROUTES.recruiters, {
      method: 'DELETE',
      body: { id: recruiterId }
    });
    const removedId = response?.recruiterId || recruiterId;
    if (removedId) {
      state.recruiters = state.recruiters.filter((recruiter) => recruiter.id !== removedId);
      const updatedCandidates = Array.isArray(response?.candidates) ? response.candidates : null;
      if (updatedCandidates) {
        updatedCandidates.forEach((candidate) => mergeCandidate(candidate));
      } else {
        state.candidates = state.candidates.map((candidate) =>
          candidate.assignedRecruiterId === removedId
            ? { ...candidate, assignedRecruiterId: '' }
            : candidate
        );
      }
      ensureActiveRecruiter();
      return true;
    }
  } catch (error) {
    console.error('Failed to remove recruiter.', error);
    pushToast(error.message || 'Unable to remove recruiter.', 'warning');
  }
  return false;
}

function getCandidate(id) {
  return state.candidates.find((candidate) => candidate.id === id);
}

function getRecruiter(id) {
  return state.recruiters.find((recruiter) => recruiter.id === id);
}

function getActiveRecruiter() {
  return getRecruiter(state.activeRecruiterId);
}

function getSelectedCandidateIds() {
  return Array.from(elements.assignmentTableBody.querySelectorAll(".candidate-select:checked")).map(
    (checkbox) => checkbox.dataset.id
  );
}

function prefillInterviewForm(candidateId) {
  if (!candidateId) {
    elements.interviewCandidateSelect.value = '';
    return;
  }
  elements.interviewCandidateSelect.value = candidateId;
  const soon = new Date();
  soon.setDate(soon.getDate() + 1);
  elements.interviewDate.value = soon.toISOString().split('T')[0];
  elements.interviewTime.value = '10:00';
  elements.interviewMode.value = 'Virtual';
}

function pushToast(message, tone = 'success') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function updateFocusSubtitle() {
  const subtitle = document.getElementById('recruiter-progress-subtitle');
  const mapping = {
    today: 'Daily pace compared to goal.',
    week: 'Week-to-date performance vs target.',
    month: 'Monthly hiring momentum overview.'
  };
  subtitle.textContent = mapping[state.recruiterFilters.range];
}

function buildNotificationsForRecruiter(recruiterId) {
  const notifications = [];
  const candidates = state.candidates.filter((candidate) => candidate.assignedRecruiterId === recruiterId);
  candidates.forEach((candidate) => {
    const alerts = buildCandidateAlerts(candidate);
    alerts.forEach((alert) => {
      notifications.push({
        title: candidate.name,
        description: alert,
        tag: candidate.stage
      });
    });
  });
  return notifications;
}

function buildCandidateAlerts(candidate) {
  const alerts = [];
  const timeInStage = Math.max(0, Math.floor((Date.now() - new Date(candidate.stageStarted).getTime()) / (1000 * 60 * 60 * 24)));
  if (['Applied', 'Reviewed'].includes(candidate.stage) && timeInStage > 3) {
    alerts.push(`${timeInStage} days waiting for review`);
  }
  if (candidate.stage === 'Interview Scheduled') {
    const interview = state.interviews.find((item) => item.candidateId === candidate.id);
    if (interview) {
      const interviewDate = new Date(`${interview.date}T${interview.time}`);
      const diffHours = (interviewDate - Date.now()) / (1000 * 60 * 60);
      if (diffHours < 48 && diffHours > 0) {
        alerts.push('Interview within 48h');
      }
      if (diffHours < 0) {
        alerts.push('Interview overdue — update outcome');
      }
    }
  }
  if (!candidate.cvFile) {
    alerts.push('CV missing');
  }
  return alerts;
}

