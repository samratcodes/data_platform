/**
 * Accounts on this platform belong to companies, so only company-owned email domains
 * may register or log in. Consumer mailbox providers are rejected on both surfaces.
 */

export const businessEmailMessage = "Use your company email address. Personal email providers such as Gmail, Yahoo, and Outlook are not accepted.";

/** Providers whose every domain is consumer mail, including their country variants (yahoo.co.uk, live.de, …). */
const personalDomainRoots = new Set([
  "gmail", "googlemail", "yahoo", "ymail", "rocketmail", "hotmail", "outlook", "live", "msn", "passport",
  "icloud", "aol", "proton", "protonmail", "gmx", "yandex", "zoho", "tutanota", "tuta", "fastmail",
  "hushmail", "rediffmail", "naver", "qq", "aim", "juno", "lycos", "excite",
]);

/** Consumer providers whose domain cannot be recognised from its first label alone. */
const personalDomains = new Set([
  "me.com", "mac.com", "pm.me", "mail.com", "email.com", "usa.com", "consultant.com", "post.com",
  "mail.ru", "bk.ru", "list.ru", "inbox.ru", "internet.ru", "rambler.ru", "ya.ru",
  "163.com", "126.com", "yeah.net", "sina.com", "sina.cn", "sohu.com", "foxmail.com", "139.com", "188.com",
  "daum.net", "hanmail.net", "nate.com", "seznam.cz", "centrum.cz", "atlas.cz", "interia.pl", "onet.pl",
  "wp.pl", "o2.pl", "abv.bg", "mynet.com", "web.de", "t-online.de", "freenet.de", "arcor.de",
  "libero.it", "virgilio.it", "tiscali.it", "alice.it", "orange.fr", "wanadoo.fr", "laposte.net",
  "free.fr", "sfr.fr", "bbox.fr", "numericable.fr", "telenet.be", "skynet.be", "ziggo.nl", "kpnmail.nl",
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "globo.com", "bigpond.com", "optusnet.com.au",
  "xtra.co.nz", "sympatico.ca", "shaw.ca", "rogers.com", "telus.net", "btinternet.com", "sky.com",
  "virginmedia.com", "talktalk.net", "ntlworld.com", "blueyonder.co.uk", "comcast.net", "verizon.net",
  "att.net", "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net", "earthlink.net", "roadrunner.com",
  "gmx.net", "gmx.de", "mailfence.com", "posteo.de", "disroot.org", "riseup.net", "zohomail.com",
]);

/** The domain part of an email address, lowercased; empty when the address is malformed. */
export function emailDomain(email: string) {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
}

/** True when the address belongs to a company domain rather than a consumer mailbox provider. */
export function isBusinessEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain || !domain.includes(".")) return false;
  if (personalDomains.has(domain)) return false;
  return !personalDomainRoots.has(domain.split(".")[0]);
}

/** The message to show for a non-business address, or null when the address is acceptable. */
export function validateBusinessEmail(email: string) {
  return isBusinessEmail(email) ? null : businessEmailMessage;
}
