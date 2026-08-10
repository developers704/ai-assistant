const ACCESS_TOKEN_KEY = "mail_access_token";
const MAIL_TOKEN_KEY = "mail_mail_token";
const EMAIL_KEY = "mail_login_email";
const PASSWORD_KEY = "mail_login_password";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getMailToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(MAIL_TOKEN_KEY);
}

export function getSavedEmail(): string {
  if (!canUseStorage()) return "";
  return (localStorage.getItem(EMAIL_KEY) ?? "").trim().toLowerCase();
}

export function getSavedPassword(): string {
  if (!canUseStorage()) return "";
  return localStorage.getItem(PASSWORD_KEY) ?? "";
}

export function saveTokens(accessToken: string, mailToken: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(MAIL_TOKEN_KEY, mailToken);
}

export function saveMailToken(mailToken: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(MAIL_TOKEN_KEY, mailToken);
}

export function saveLoginCredentials(email: string, password: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  localStorage.setItem(PASSWORD_KEY, password);
}

export function clearMailSession(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(MAIL_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(PASSWORD_KEY);
}

export function hasMailSession(): boolean {
  const access = getAccessToken();
  const mail = getMailToken();
  return !!access && !!mail;
}
