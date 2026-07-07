/* Robustesse mot de passe — porté du prototype (RugbyApp.jsx pwdStrength).
   Le HACHAGE n'est plus fait côté client : Supabase Auth s'en charge (bcrypt/serveur).
   Ces critères servent uniquement à guider l'utilisateur à la création du compte. */

export const COMMON = [
  "password", "motdepasse", "123456789", "azerty123",
  "qwerty123", "rugby2026", "performance", "000000000",
];

export function pwdStrength(p) {
  const checks = {
    len: p.length >= 10,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /[0-9]/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
    notCommon: !COMMON.some((c) => p.toLowerCase().includes(c)),
  };
  let s = 0;
  Object.values(checks).forEach((v) => v && s++);
  if (p.length >= 14) s++;
  const valid =
    checks.len && checks.upper && checks.lower && checks.digit && checks.special && checks.notCommon;
  return { score: s, checks, valid };
}
