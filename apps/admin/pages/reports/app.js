import { bindPasswordSignIn, loadAdminConfig } from '../../auth/admin.js';

const byId = (id) => window.document.getElementById(id);
const fieldNames = [
  'name',
  'value',
  'unit',
  'period',
  'category',
  'meaning',
  'method',
];
let token = null;
let document = null;
let revision = null;
let busy = false;
let cursor = null;
let lastRequest = null;
const message = (value) => {
  byId('message').textContent = value;
};
function requestId(intent) {
  const text = JSON.stringify(intent);
  if (lastRequest?.intent !== text)
    lastRequest = { intent: text, id: crypto.randomUUID() };
  return lastRequest.id;
}
function signedOut() {
  token = null;
  document = null;
  revision = null;
  lastRequest = null;
  byId('workspace').hidden = true;
  byId('detail').hidden = true;
  byId('logout').hidden = true;
  byId('signin').hidden = false;
  for (const id of [
    'source',
    'official',
    'audit',
    'attempts',
    'report',
    'candidate',
    'replacement',
  ])
    byId(id).replaceChildren();
  byId('review-form').reset();
}
async function api(path, method = 'GET', value, pdf = false) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(pdf ? 65000 : 20000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(value === undefined
        ? {}
        : { 'Content-Type': pdf ? 'application/pdf' : 'application/json' }),
    },
    body: value === undefined ? undefined : pdf ? value : JSON.stringify(value),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) signedOut();
    const data = await response.json();
    throw new Error(data.error ?? 'Request failed.');
  }
  return response.headers.get('content-type')?.includes('text/plain')
    ? response.blob()
    : response.json();
}
async function work(action) {
  if (busy) return;
  busy = true;
  for (const control of window.document.querySelectorAll(
    'button,input,textarea,select',
  ))
    control.disabled = true;
  try {
    await action();
  } catch (error) {
    message(`${error.message} Check report status before retrying a decision.`);
  } finally {
    busy = false;
    for (const control of window.document.querySelectorAll(
      'button,input,textarea,select',
    ))
      control.disabled = false;
  }
}
function option(select, text, value) {
  const item = window.document.createElement('option');
  item.textContent = text;
  item.value = value;
  select.append(item);
}
function line(list, text) {
  const item = window.document.createElement('li');
  item.textContent = text;
  list.append(item);
}
async function refreshReports(append = false) {
  const rows = await api(
    `/v1/admin/reports${append && cursor ? `?after=${cursor}` : ''}`,
  );
  if (!append) {
    byId('report').replaceChildren();
    option(
      byId('report'),
      rows.length ? 'Select a report to review' : 'No reports uploaded yet',
      '',
    );
  }
  for (const row of rows)
    option(
      byId('report'),
      `${row.title} · ${row.sourceKind} · ${row.status}`,
      row.id,
    );
  cursor = rows.length === 50 ? rows.at(-1).id : null;
  byId('report').disabled = rows.length === 0;
  byId('more').hidden = !cursor;
}
async function refreshOfficial() {
  const records = await api('/v1/impact/official');
  byId('official').replaceChildren();
  byId('replacement').replaceChildren();
  option(byId('replacement'), 'Publish as a new figure', '');
  for (const row of records) {
    const name = row.fields.name?.text ?? 'Unnamed';
    const label = `${name}: ${row.fields.value?.text ?? 'Missing'} ${row.fields.unit?.text ?? ''} · ${row.period ?? 'Period missing'}`;
    line(
      byId('official'),
      `${row.sourceKind === 'synthetic' ? 'Synthetic example. ' : ''}${label}. ${row.fields.meaning?.text ?? 'Meaning missing'}. Source: ${row.title}, page ${row.evidence.page}. ${row.evidence.quote}`,
    );
    option(byId('replacement'), label, row.approvalId);
  }
}
function showPage() {
  const page = document?.pages.find(
    (value) => value.page === Number(byId('page').value),
  );
  byId('source').textContent = page?.text.trim()
    ? page.text
    : 'This page has no usable text layer. Check your original PDF; automatic extraction cannot read this page.';
}
function selectRevision() {
  const id = byId('candidate').value;
  revision =
    document?.revisions.filter((value) => value.candidateId === id).at(-1) ??
    null;
  for (const name of fieldNames)
    byId(name).value = revision?.fields.fields[name]?.text ?? '';
  byId('quote').value = revision?.fields.evidence.quote ?? '';
  byId('reason').value = '';
  byId('decision-reason').value = '';
  if (revision) byId('page').value = String(revision.fields.evidence.page);
  showPage();
  byId('missing').textContent = revision?.fields.missing.length
    ? `Missing: ${revision.fields.missing.join(', ')}.`
    : '';
  byId('decision-form').hidden = !revision;
  byId('audit').replaceChildren();
  for (const value of document?.revisions.filter(
    (value) => value.candidateId === id,
  ) ?? [])
    line(
      byId('audit'),
      `${value.createdAt}. ${value.reason}. Reviewer: ${value.actorId}. ${JSON.stringify(Object.fromEntries(fieldNames.map((name) => [name, value.fields.fields[name]?.text ?? null])))}`,
    );
  for (const value of document?.decisions.filter(
    (value) => value.candidateId === id,
  ) ?? [])
    line(
      byId('audit'),
      `${value.kind} at ${value.recordedAt} by ${value.actorId}. ${value.reason}`,
    );
}
async function openReport(id, candidateId = '') {
  document = await api(`/v1/admin/reports/${id}`);
  byId('detail').hidden = false;
  byId('report-title').textContent = document.title;
  byId('status').textContent =
    `${document.sourceKind === 'synthetic' ? 'Synthetic example. ' : ''}${document.status}${document.failure ? `: ${document.failure}` : ''}. ${document.pages.length} retained pages. Parser: ${document.parserVersion ?? 'pending'}.`;
  byId('attempts').replaceChildren();
  for (const attempt of document.extractions)
    line(
      byId('attempts'),
      `Pages ${attempt.pages.join(', ')}: ${attempt.status}${attempt.failure ? ` (${attempt.failure})` : ''}${attempt.metadata ? `. ${attempt.metadata.model}, ${attempt.metadata.adapterVersion}` : ''}.`,
    );
  if (!document.extractions.length)
    line(byId('attempts'), 'No extraction attempts recorded.');
  byId('page').replaceChildren();
  for (const page of document.pages)
    option(byId('page'), `Page ${page.page}`, String(page.page));
  byId('candidate').replaceChildren();
  option(byId('candidate'), 'New manual candidate', '');
  const current = new Map(
    document.revisions.map((value) => [value.candidateId, value]),
  );
  for (const [key, value] of current)
    option(
      byId('candidate'),
      value.fields.fields.name?.text ?? 'Unnamed candidate',
      key,
    );
  byId('candidate').value = candidateId;
  selectRevision();
  await refreshOfficial();
}
async function activate(nextToken) {
  token = nextToken;
  await api('/v1/admin/session');
  byId('signin').hidden = true;
  byId('workspace').hidden = false;
  byId('logout').hidden = false;
  await refreshReports();
  await refreshOfficial();
  message('Signed in with assigned admin access.');
}
for (const button of window.document.querySelectorAll('[data-fixture]'))
  button.addEventListener('click', () =>
    work(async () => {
      const session = await api('/v1/dev/session', 'POST', {
        fixture: button.dataset.fixture,
      });
      await activate(session.token);
    }),
  );
byId('logout').addEventListener('click', () =>
  work(async () => {
    try {
      await api('/v1/session', 'DELETE');
    } finally {
      signedOut();
    }
  }),
);
byId('select-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void work(() => openReport(byId('report').value));
});
byId('more').addEventListener('click', () => work(() => refreshReports(true)));
byId('page').addEventListener('change', showPage);
byId('candidate').addEventListener('change', selectRevision);
byId('upload-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void work(async () => {
    const file = byId('file').files[0];
    if (!file || file.size > 10 * 1024 * 1024)
      throw new Error('Select a PDF up to 10 MiB.');
    const bytes = await file.arrayBuffer();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    const title = byId('title').value;
    const sourceKind = byId('source-kind').value;
    const reserved = await api('/v1/admin/reports', 'POST', {
      requestId: requestId(['upload', title, hash, sourceKind]),
      title,
      sourceKind,
    });
    await api(`/v1/admin/reports/${reserved.id}/source`, 'PUT', bytes, true);
    await refreshReports();
    byId('report').value = reserved.id;
    await openReport(reserved.id);
    message('Page text saved. Review it before approving any figure.');
  });
});
byId('download').addEventListener('click', () =>
  work(async () => {
    const blob = await api(`/v1/admin/reports/${document.id}/source`);
    const url = URL.createObjectURL(blob),
      anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = 'report.txt';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }),
);
byId('extract-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void work(async () => {
    const pages = byId('extract-pages')
      .value.split(',')
      .map((value) => Number(value.trim()));
    const result = await api(
      `/v1/admin/reports/${document.id}/extractions`,
      'POST',
      { requestId: requestId(['extract', document.id, pages]), pages },
    );
    await openReport(document.id);
    message(
      result.status === 'unavailable'
        ? `Extraction unavailable: ${result.failure}. Manual review remains available.`
        : 'Candidates are ready for review.',
    );
  });
});
byId('review-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void work(async () => {
    const page = document.pages.find(
      (value) => value.page === Number(byId('page').value),
    );
    const quote = byId('quote').value,
      start = page?.text.indexOf(quote) ?? -1;
    if (!quote || start < 0 || page.text.indexOf(quote, start + 1) !== -1)
      throw new Error('Use an exact, unique quote from the selected page.');
    const fields = Object.fromEntries(
      fieldNames.map((name) => [name, byId(name).value || null]),
    );
    fields.evidence = {
      page: page.page,
      quote,
      start,
      end: start + quote.length,
    };
    const reason = byId('reason').value;
    const action = {
      fields,
      reason,
      requestId: requestId([
        'review',
        document.id,
        revision?.id ?? null,
        fields,
        reason,
      ]),
    };
    const result = revision
      ? await api(
          `/v1/admin/report-candidates/${revision.candidateId}/revisions`,
          'POST',
          { ...action, expectedRevisionId: revision.id },
        )
      : await api(
          `/v1/admin/reports/${document.id}/candidates`,
          'POST',
          action,
        );
    await openReport(document.id, result.candidateId);
    message('Review revision saved. It is not official until approved.');
  });
});
byId('decision-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const kind = event.submitter.value;
  void work(async () => {
    const expectedApprovalId =
      kind === 'approved' ? byId('replacement').value || null : null;
    const reason = byId('decision-reason').value;
    const action = {
      revisionId: revision.id,
      kind,
      expectedApprovalId,
      reason,
    };
    await api(
      `/v1/admin/report-candidates/${revision.candidateId}/decisions`,
      'POST',
      {
        ...action,
        requestId: requestId(['decision', revision.candidateId, action]),
      },
    );
    await openReport(document.id, revision.candidateId);
    message(`Current revision ${kind}.`);
  });
});
void work(async () => {
  const config = await loadAdminConfig();
  byId('fixtures').hidden = !config.synthetic;
  bindPasswordSignIn(config.auth, { work, onSession: activate });
  byId('setup').textContent = config.synthetic
    ? 'Choose the assigned local test admin.'
    : ['supabase', 'oidc'].includes(config.auth?.mode)
      ? ''
      : 'Admin sign-in setup is pending.';
  try {
    await activate(null);
  } catch (error) {
    if (
      !['Sign in again.', 'Assigned admin access required.'].includes(
        error.message,
      )
    )
      throw error;
  }
});
