import { bindPasswordSignIn, loadAdminConfig } from '../../../auth/admin.js';

(() => {
  const byId = (id) => document.getElementById(id);
  let token = null;
  let actor = null;
  let busy = false;
  let stale = false;
  let rankingCursor = null;
  let sessionsCursor = null;
  // One unresolved immutable intent per authenticated actor, only in this page's memory.
  const intents = new Map();
  const message = (text) => {
    byId('message').textContent = text;
  };
  const currentIntent = () => (actor ? intents.get(actor) : undefined);
  function controls() {
    for (const control of document.querySelectorAll('button,select,textarea'))
      control.disabled =
        busy ||
        (control.hasAttribute('data-mutation') && (stale || !!currentIntent()));
    byId('workspace').setAttribute('aria-busy', String(busy));
    const intent = currentIntent();
    byId('pending').hidden = !intent;
    byId('retry').hidden = !intent;
    byId('pending').textContent = intent
      ? `${intent.label}: outcome unconfirmed. Retry the original action before starting another. Do not reload this page while the outcome is unknown.`
      : '';
  }
  function signedOut() {
    token = null;
    actor = null;
    stale = false;
    rankingCursor = null;
    sessionsCursor = null;
    byId('workspace').hidden = true;
    byId('logout').hidden = true;
    byId('signin').hidden = false;
    for (const id of ['ranking', 'sessions', 'receipt'])
      byId(id).replaceChildren();
    byId('receipt').hidden = true;
    controls();
  }
  async function api(path, method = 'GET', value) {
    const response = await fetch(path, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    if (response.status === 401 || response.status === 403) signedOut();
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error ?? 'Request failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function work(action) {
    if (busy) return;
    busy = true;
    controls();
    message('Working…');
    try {
      await action();
    } catch (error) {
      message(
        `${error.message} ${token ? 'Refresh or retry the original action when ready.' : 'Sign in with a current assigned admin account.'}`,
      );
    } finally {
      busy = false;
      controls();
    }
  }
  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  const paragraph = (value, className = 'muted') => text('p', value, className);
  function button(label, action, attribute) {
    const node = text('button', label);
    node.type = 'button';
    if (attribute) node.setAttribute(attribute, '');
    node.setAttribute('data-mutation', '');
    node.addEventListener('click', action);
    return node;
  }
  function frozen(session, content = []) {
    const section = document.createElement('div');
    section.append(text('h3', 'Original selection'));
    if (!session.selections.length)
      section.append(paragraph('No submissions selected.'));
    const list = document.createElement('ol');
    for (const selection of session.selections) {
      const item = document.createElement('li');
      const submission = content.find(
        (row) => row.id === selection.submissionId,
      );
      if (submission) item.append(paragraph(submission.text, 'entry-reason'));
      item.append(
        paragraph(
          `Place ${selection.rank} · Submission ${selection.submissionId}`,
          'entry-reason',
        ),
        paragraph(
          `${selection.rankingPointsAtClose} points at close · Approved ${selection.approvedAt}`,
        ),
        paragraph(
          `Selected ${selection.selectedAt} · Selection ${selection.id}`,
        ),
      );
      list.append(item);
    }
    section.append(list);
    return section;
  }
  function showReceipt(result, intent) {
    const receipt = byId('receipt');
    receipt.replaceChildren(
      text('h2', 'Recorded action'),
      paragraph(intent.label, 'entry-reason'),
    );
    if (result.state) {
      receipt.append(
        paragraph(
          `Session ${result.id} · ${result.state} · Created ${result.createdAt} by ${result.createdBy}`,
        ),
      );
      if (result.state === 'closed')
        receipt.append(
          paragraph(`Closed ${result.closedAt} by ${result.closedBy}`),
          frozen(result),
        );
    } else {
      receipt.append(
        paragraph(`Selection ${result.id} · ${result.status} · demonstration`),
        paragraph(`${result.resolvedAt} · ${result.resolvedBy}`),
        paragraph(result.reason, 'entry-reason'),
      );
    }
    receipt.hidden = false;
  }
  async function retry() {
    const owner = actor;
    const intent = currentIntent();
    if (!intent) return;
    let result;
    try {
      result = await api(intent.path, 'POST', intent.body);
    } catch (error) {
      // A conclusive rejected request cannot have applied this intent. Auth/unknown failures retain it.
      if ([400, 404, 409, 413, 422].includes(error.status)) {
        intents.delete(owner);
        stale = true;
      }
      throw error;
    }
    intents.delete(owner);
    showReceipt(result, intent);
    try {
      await refresh();
      message('Action recorded.');
    } catch (error) {
      if (token) {
        stale = true;
        message('Action recorded. Refresh to update ranking and sessions.');
      } else
        message(
          `${error.message} Action recorded. Sign in again to read current state.`,
        );
    }
    if (token) byId('receipt').focus();
  }
  async function mutate(path, payload, label) {
    if (!actor || stale || currentIntent()) return;
    intents.set(actor, {
      path,
      body: Object.freeze({ requestId: crypto.randomUUID(), ...payload }),
      label,
    });
    controls();
    await retry();
  }
  function renderRanking(items, append) {
    const list = byId('ranking');
    if (!append) list.replaceChildren();
    // Preserve server ordering and exact decimal/timestamp text, including microseconds.
    for (const row of items) {
      const item = document.createElement('li');
      item.append(
        paragraph(row.text, 'entry-reason'),
        paragraph(
          `${row.rankingPoints} points · ${row.status}${row.tag ? ` · ${row.tag}` : ''}`,
        ),
        paragraph(`Approved ${row.approvedAt} · Submission ${row.id}`),
      );
      if (row.status === 'fulfilled')
        item.append(paragraph('Fulfilment: demonstration.'));
      list.append(item);
    }
    byId('ranking-empty').hidden = list.children.length !== 0;
    byId('ranking-more').hidden = !rankingCursor;
  }
  function resolutionForm(selection) {
    const form = document.createElement('form');
    form.className = 'selection-form';
    form.setAttribute('data-resolution', selection.id);
    const select = document.createElement('select');
    select.id = `action-${selection.id}`;
    select.setAttribute('data-mutation', '');
    for (const [value, label] of [
      ['release', 'Release to backlog'],
      ['fulfil', 'Record demonstration fulfilment'],
    ]) {
      const option = text('option', label);
      option.value = value;
      select.append(option);
    }
    const actionLabel = text('label', 'Resolution');
    actionLabel.htmlFor = select.id;
    const reason = document.createElement('textarea');
    reason.id = `reason-${selection.id}`;
    reason.required = true;
    reason.maxLength = 500;
    reason.rows = 2;
    reason.setAttribute('data-mutation', '');
    const reasonLabel = text('label', 'Reason');
    reasonLabel.htmlFor = reason.id;
    const submit = text('button', 'Record resolution');
    submit.type = 'submit';
    submit.setAttribute('data-mutation', '');
    form.append(actionLabel, select, reasonLabel, reason, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = reason.value.trim();
      if (!value || value.length > 500) {
        reason.setCustomValidity('Enter a reason of 1 to 500 characters.');
        reason.reportValidity();
        return;
      }
      reason.setCustomValidity('');
      void work(() =>
        mutate(
          `/v1/admin/submission-selections/${selection.id}/resolve`,
          { action: select.value, reason: value },
          `${select.value === 'fulfil' ? 'Demonstration fulfilment' : 'Release'} of selection ${selection.id}`,
        ),
      );
    });
    reason.addEventListener('input', () => reason.setCustomValidity(''));
    return form;
  }
  function renderSessions(items, append) {
    const list = byId('sessions');
    if (!append) list.replaceChildren();
    for (const { session, selections, content } of items) {
      const item = document.createElement('li');
      item.append(
        text('h3', `Session ${session.sequence} · ${session.state}`),
        paragraph(
          `Session ${session.id} · Created ${session.createdAt} by ${session.createdBy}`,
        ),
      );
      if (session.state === 'open') {
        const confirm = document.createElement('div');
        confirm.hidden = true;
        confirm.append(
          paragraph(
            `Close session ${session.id}? The current top three eligible submissions will be frozen, or fewer if fewer qualify. This session cannot reopen.`,
            'entry-reason',
          ),
        );
        const actions = document.createElement('div');
        actions.className = 'profile-controls';
        const close = button(
          'Close session…',
          () => {
            confirm.hidden = false;
            close.hidden = true;
            confirm.querySelector('button').focus();
          },
          'data-close',
        );
        actions.append(
          button(
            'Confirm close',
            () =>
              work(() =>
                mutate(
                  `/v1/admin/submission-sessions/${session.id}/close`,
                  {},
                  `Close session ${session.id}`,
                ),
              ),
            'data-confirm-close',
          ),
          button(
            'Cancel',
            () => {
              confirm.hidden = true;
              close.hidden = false;
              close.focus();
            },
            'data-cancel-close',
          ),
        );
        confirm.append(actions);
        item.append(close, confirm);
      } else {
        item.append(
          paragraph(`Closed ${session.closedAt} by ${session.closedBy}`),
          frozen(session, content),
          text('h3', 'Current resolution'),
        );
        if (!selections.length)
          item.append(paragraph('No selections to resolve.'));
        for (const selection of selections) {
          const section = document.createElement('div');
          section.append(
            paragraph(
              `Selection ${selection.id} · Submission ${selection.submissionId} · ${selection.status}`,
              'entry-reason',
            ),
          );
          if (selection.status === 'selected')
            section.append(resolutionForm(selection));
          else
            section.append(
              paragraph(
                `Resolved ${selection.resolvedAt} by ${selection.resolvedBy} · demonstration`,
              ),
              paragraph(selection.reason, 'entry-reason'),
            );
          item.append(section);
        }
      }
      list.append(item);
    }
    byId('sessions-empty').hidden = list.children.length !== 0;
    byId('sessions-more').hidden = !sessionsCursor;
    controls();
  }
  async function refresh() {
    stale = true;
    await api('/v1/admin/session');
    const ranks = await api('/v1/submissions/ranking');
    const sessions = await api('/v1/admin/submission-sessions');
    rankingCursor = ranks.nextCursor;
    sessionsCursor = sessions.nextCursor;
    renderRanking(ranks.items, false);
    renderSessions(sessions.items, false);
    stale = false;
  }
  async function activate(nextToken) {
    token = nextToken;
    await api('/v1/admin/session');
    const account = await api('/v1/me');
    actor = account.id;
    byId('signin').hidden = true;
    byId('workspace').hidden = false;
    byId('logout').hidden = false;
    await refresh();
    message('');
  }
  for (const button of document.querySelectorAll('[data-fixture]'))
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
      await api('/v1/session', 'DELETE');
      signedOut();
      message('Signed out.');
    }),
  );
  byId('refresh').addEventListener('click', () =>
    work(async () => {
      await refresh();
      message('');
    }),
  );
  byId('create').addEventListener('click', () =>
    work(() =>
      mutate('/v1/admin/submission-sessions', {}, 'Create open session'),
    ),
  );
  byId('retry').addEventListener('click', () => work(retry));
  byId('ranking-more').addEventListener('click', () =>
    work(async () => {
      await api('/v1/admin/session');
      const page = await api(
        `/v1/submissions/ranking?${new URLSearchParams({ after: rankingCursor })}`,
      );
      rankingCursor = page.nextCursor;
      renderRanking(page.items, true);
      message('');
    }),
  );
  byId('sessions-more').addEventListener('click', () =>
    work(async () => {
      const page = await api(
        `/v1/admin/submission-sessions?${new URLSearchParams({ before: sessionsCursor })}`,
      );
      sessionsCursor = page.nextCursor;
      renderSessions(page.items, true);
      message('');
    }),
  );
  void (async () => {
    try {
      const config = await loadAdminConfig();
      byId('fixtures').hidden = !config.synthetic;
      bindPasswordSignIn(config.auth, { work, onSession: activate });
      byId('setup').textContent =
        config.synthetic || config.auth?.mode === 'supabase'
          ? ''
          : 'Admin sign-in setup is pending. No local test sign-in is enabled.';
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
    } catch {
      byId('setup').textContent =
        'Sign-in is unavailable. Reload to try again.';
    }
  })();
})();
