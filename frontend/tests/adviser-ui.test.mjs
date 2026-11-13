import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173' });
for (const name of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement: h } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
let server, root, Login, Register, Profile, Settings, Avatar, Header;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  Login = (await server.ssrLoadModule('/src/components/auth/loginForm.jsx')).default;
  Register = (await server.ssrLoadModule('/src/components/auth/RegisterForm.jsx')).default;
  Profile = (await server.ssrLoadModule('/src/components/Shoppers/ShopperMyProfile.jsx')).default;
  Settings = (await server.ssrLoadModule('/src/components/Shoppers/ShopperSettings.jsx')).default;
  Avatar = (await server.ssrLoadModule('/src/components/shared/Avatar.jsx')).default;
  Header = (await server.ssrLoadModule('/src/components/Shoppers/ShopperHeader.jsx')).default;
});
afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null; } });
after(async () => { await server.close(); dom.window.close(); });
async function mount(component, props = {}) { root = createRoot(document.getElementById('root')); await act(async () => root.render(h(MemoryRouter, null, h(component, props)))); }
const button = label => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
async function click(el) { assert.ok(el); await act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))); }
const account = { id: 4, email: 'ana@example.test', email_verified_at: '2026-11-01', profile: { first_name: 'Ana', last_name: 'Cruz', address: 'Original address', phone_number: '09123456789' } };

test('Login retains email/password and registration while removing disconnected Google and reset controls', async () => {
  await mount(Login);
  assert.equal(document.querySelector('input[name="email"]').required, true);
  assert.equal(document.querySelector('input[name="password"]').required, true);
  assert.ok(button('Login'));
  assert.equal(document.querySelector('a[href="/register"]').textContent, 'Register');
  assert.doesNotMatch(document.body.textContent, /Google|or sign up with|Forgot Password/i);
});
test('Registration keeps contact/terms/password confirmation and verified-email navigation form', async () => {
  await mount(Register);
  assert.ok(button('Create Account'));
  for (const name of ['email','phoneNumber','password','confirmPassword','agreeToTerms']) assert.ok(document.querySelector(`[name="${name}"]`));
  assert.equal(document.querySelector('a[href="/login"]').textContent, 'Login');
  assert.doesNotMatch(document.body.textContent, /Google|or sign up with/i);
});
test('Profile cancel discards unsaved edits and never exposes email, phone, role or verification edits', async () => {
  await mount(Profile, { user: account, onProfileUpdated() {} });
  await click(button('Edit Profile'));
  assert.equal(document.querySelector('[name="first_name"]').value, 'Ana');
  for (const name of ['email','phone_number','role','email_verified_at']) assert.equal(document.querySelector(`[name="${name}"]`), null);
  assert.equal(document.querySelector('#profile-photo').accept, 'image/jpeg,image/png,image/webp');
  await click(button('Cancel'));
  assert.equal(document.querySelector('[name="first_name"]'), null);
  assert.match(document.body.textContent, /Original address/);
});
test('Account & Security shows only working password controls and preserves cancellation', async () => {
  await mount(Settings, { user: account });
  assert.doesNotMatch(document.body.textContent, /Notification Preferences|Save Preferences|Budget Monitoring|preview controls/i);
  await click(button('Change password'));
  assert.ok(document.querySelector('[name="current_password"]'));
  await click(button('Cancel'));
  assert.equal(document.querySelector('[name="current_password"]'), null);
});
test('Initials avatar rerenders from the current account name and safely falls back after a failed image', async () => {
  await mount(Avatar, { profile: account.profile }); assert.equal(document.querySelector('[role="img"]').textContent, 'AC');
  await act(async () => root.render(h(Avatar, { profile: { first_name: 'Maria', last_name: 'Santos' }, imageUrl: '/unavailable.png' })));
  await act(async () => document.querySelector('img').dispatchEvent(new Event('error')));
  assert.equal(document.querySelector('img'), null);
  assert.equal(document.querySelector('[role="img"]').textContent, 'MS');
});

test('saving Shopper details updates the shared parent identity and header while preserving contact and verification fields', async t => {
  document.cookie = 'XSRF-TOKEN=secure';
  let updated;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/csrf-cookie')) return new Response(null, { status: 204 });
    assert.ok(url.endsWith('/shopper/profile')); assert.equal(options.method, 'PUT');
    const data = JSON.parse(options.body); assert.deepEqual(Object.keys(data).sort(), ['address','first_name','last_name']);
    updated = { ...account, profile: { ...account.profile, ...data } };
    return new Response(JSON.stringify({ user: updated, message: 'Profile updated successfully.' }), { headers: { 'Content-Type': 'application/json' } });
  });
  const { useState } = await import('react');
  function Workspace() { const [user, setUser] = useState(account); return h('div', null, h(Header, { user }), h(Profile, { user, onProfileUpdated: setUser })); }
  await mount(Workspace); await click(button('Edit Profile'));
  const field = document.querySelector('[name="first_name"]');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'Maria'); field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => field.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(updated.profile.first_name, 'Maria'); assert.equal(updated.profile.phone_number, account.profile.phone_number); assert.equal(updated.email_verified_at, account.email_verified_at);
  assert.match(document.body.textContent, /Profile updated successfully/); assert.equal(document.querySelector('header [role="img"]').getAttribute('aria-label'), 'Maria Cruz avatar');
});
