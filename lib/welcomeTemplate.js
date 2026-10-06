const PLACEHOLDERS = ['user', 'username', 'server', 'memberCount', 'userId'];

/**
 * Replaces `{placeholder}` tokens with values. Unknown tokens are left as-is
 * and values are never interpreted as templates themselves.
 */
function renderTemplate(template, values) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    PLACEHOLDERS.includes(key) && values[key] !== undefined
      ? String(values[key])
      : match,
  );
}

module.exports = { PLACEHOLDERS, renderTemplate };
