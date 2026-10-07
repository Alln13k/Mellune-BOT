const crypto = require('node:crypto');
const { prisma } = require('../database/client');

const SESSION_COOKIE = 'mellune_session';
const STATE_COOKIE = 'mellune_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function decrypt(value) {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getSessionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]);
    const session = JSON.parse(decrypted.toString('utf8'));
    if (!session.expiresAt || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return [
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

async function setSessionCookie(headers, value) {
  const id = crypto.randomBytes(32).toString('base64url');
  await prisma.dashboardSession.create({
    data: {
      id,
      discordUserId: value.user.id,
      username: value.user.username,
      globalName: value.user.global_name || null,
      avatar: value.user.avatar || null,
      accessToken: value.accessToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });
  headers.append('Set-Cookie', `${SESSION_COOKIE}=${id}; ${cookieOptions()}`);
}

function clearSessionCookie(headers) {
  headers.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieOptions(0)}`);
}

function setStateCookie(headers, state) {
  headers.append(
    'Set-Cookie',
    `${STATE_COOKIE}=${encrypt({ state, expiresAt: Date.now() + 600000 })}; ${cookieOptions(600)}`,
  );
}

function readCookie(request, name) {
  const value = request.headers.get('cookie') || '';
  return value
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function getSession(request) {
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const session = await prisma.dashboardSession.findUnique({
    where: { id: value },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return {
    accessToken: session.accessToken,
    user: {
      id: session.discordUserId,
      username: session.username,
      global_name: session.globalName,
      avatar: session.avatar,
    },
  };
}

async function destroySession(request) {
  const value = readCookie(request, SESSION_COOKIE);
  if (value) {
    await prisma.dashboardSession.deleteMany({ where: { id: value } });
  }
}

function getOAuthState(request) {
  const value = readCookie(request, STATE_COOKIE);
  return value ? decrypt(value)?.state : null;
}

module.exports = {
  clearSessionCookie,
  destroySession,
  getOAuthState,
  getSession,
  encrypt,
  setSessionCookie,
  setStateCookie,
};
