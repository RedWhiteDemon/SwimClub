const validator = require("validator");

const EMAIL_MAX_LENGTH = 254;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Проверка формата email для регистрации, входа, сброса пароля.
 * Без «почти email» (пробелы, IP вместо домена, отсутствие TLD).
 */
function isValidEmail(email) {
  const s = normalizeEmail(email);
  if (!s || s.length > EMAIL_MAX_LENGTH) {
    return false;
  }
  if (/\s/.test(String(email || ""))) {
    return false;
  }
  if (s.includes("..")) {
    return false;
  }
  return validator.isEmail(s, {
    allow_display_name: false,
    allow_utf8_local_part: false,
    require_tld: true,
    allow_ip_domain: false
  });
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  EMAIL_MAX_LENGTH
};
