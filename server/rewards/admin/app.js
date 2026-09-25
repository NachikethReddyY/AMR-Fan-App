const byId = (id) => document.getElementById(id);
let token = null;
let selected = null;
let cursor = null;
let pending = null;
let busy = false;
const message = (text) => {
  byId('message').textContent = text;
};
function fields() {
  const kind = byId('kind').value;
  byId('content-field').hidden = kind !== 'content';
  byId('content').required = kind === 'content';
  byId('discount-field').hidden = kind !== 'discount';
  byId('percentage').required = kind === 'discount';
  byId('fulfilment').hidden = kind === 'content';
}
function clear() {
  selected = null;
  pending = null;
  byId('editor').reset();
  byId('editor-title').textContent = 'New offer';
  byId('version').textContent = '';
  byId('save').textContent = 'Create offer';
  byId('kind').disabled = false;
  fields();
}
function signedOut() {
  token = null;
  cursor = null;
  clear();
  byId('workspace').hidden = true;
  byId('logout').hidden = true;
  byId('signin').hidden = false;
  byId('offers').replaceChildren();
}
async function api(path, method = 'GET', value) {
  const response = await fetch(path, {
    method,
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) signedOut();
    throw new Error(data.error ?? 'Request failed.');
  }
  return data;
}
async function work(action) {
  if (busy) return;
  busy = true;
  for (const control of document.querySelectorAll(
    'button, input, textarea, select',
  ))
    control.disabled = true;
  message('Working…');
  try {
    await action();
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    for (const control of document.querySelectorAll(
      'button, input, textarea, select',
    ))
      control.disabled = false;
    byId('kind').disabled = selected !== null;
  }
}
function edit(offer) {
  selected = offer;
  pending = null;
  byId('editor-title').textContent = 'Edit offer';
  byId('version').textContent = `Version ${offer.version}`;
  byId('kind').value = offer.product.kind;
  byId('kind').disabled = true;
  byId('title').value = offer.product.title;
  byId('description').value = offer.product.description;
  byId('price').value = offer.product.pointsPrice;
  byId('content').value =
    offer.product.kind === 'content' ? offer.product.text : '';
  byId('percentage').value =
    offer.product.kind === 'discount' ? offer.product.percentage : '';
  byId('availability').value = String(offer.enabled);
  byId('save').textContent = 'Save offer';
  fields();
  byId('title').focus();
}
async function catalogue(append = false) {
  const result = await api(
    `/v1/admin/rewards/offers${append && cursor ? `?after=${cursor}` : ''}`,
  );
  if (!append) byId('offers').replaceChildren();
  for (const offer of result.offers) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = offer.product.title;
    const description = document.createElement('p');
    description.textContent = offer.product.description;
    const detail = document.createElement('p');
    detail.textContent = `${offer.product.pointsPrice} points · Version ${offer.version} · ${offer.enabled ? 'Available' : 'Disabled'}${offer.product.kind === 'discount' ? ` · ${offer.product.percentage}% discount` : ''}`;
    const button = document.createElement('button');
    button.textContent = `Edit ${offer.product.title}`;
    button.disabled = busy;
    button.addEventListener('click', () => edit(offer));
    section.append(title, description, detail, button);
    byId('offers').append(section);
  }
  cursor = result.nextCursor;
  byId('more').hidden = !cursor;
  byId('empty').hidden = byId('offers').children.length > 0;
}
for (const button of document.querySelectorAll('[data-fixture]'))
  button.addEventListener('click', () =>
    work(async () => {
      const data = await api('/v1/dev/session', 'POST', {
        fixture: button.dataset.fixture,
      });
      token = data.token;
      await api('/v1/admin/session');
      byId('signin').hidden = true;
      byId('workspace').hidden = false;
      byId('logout').hidden = false;
      await catalogue();
      message('');
    }),
  );
byId('logout').addEventListener('click', () =>
  work(async () => {
    await api('/v1/session', 'DELETE');
    signedOut();
    message('Signed out.');
  }),
);
byId('kind').addEventListener('change', fields);
byId('new').addEventListener('click', clear);
byId('more').addEventListener('click', () =>
  work(async () => {
    await catalogue(true);
    message('');
  }),
);
byId('editor').addEventListener('submit', (event) => {
  event.preventDefault();
  const product = {
    kind: byId('kind').value,
    title: byId('title').value.trim(),
    description: byId('description').value.trim(),
    pointsPrice: Number(byId('price').value),
  };
  if (product.kind === 'content') product.text = byId('content').value.trim();
  if (product.kind === 'discount')
    product.percentage = Number(byId('percentage').value);
  const input = {
    enabled: byId('availability').value === 'true',
    product,
    ...(selected
      ? { offerId: selected.id, expectedVersion: selected.version }
      : {}),
  };
  const signature = JSON.stringify(input);
  if (!pending || pending.signature !== signature)
    pending = {
      signature,
      input: { ...input, requestId: crypto.randomUUID() },
      method: selected ? 'PATCH' : 'POST',
    };
  void work(async () => {
    const saved = await api(
      '/v1/admin/rewards/offers',
      pending.method,
      pending.input,
    );
    pending = null;
    edit(saved);
    message(`Saved ${saved.product.title}, version ${saved.version}.`);
    try {
      await catalogue();
    } catch {
      message('Offer saved. Reload the page to refresh the catalogue.');
    }
  });
});
try {
  const config = await api('/admin/config');
  byId('fixtures').hidden = !config.synthetic;
  byId('setup').textContent = config.synthetic
    ? ''
    : 'Admin sign-in setup is pending. No local test sign-in is enabled.';
} catch {
  byId('setup').textContent = 'Sign-in is unavailable. Reload to try again.';
}
