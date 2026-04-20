export const WELCOME_PASSWORD_MARKER = 'WelcomePasswordSet:'
export const WELCOME_EMAIL_MARKER = 'WelcomeEmailSent:'

export type EmailUserWelcomeState =
  | 'new_email_user'
  | 'password_set'
  | 'completed'

export function hasPasswordBeenSet(note?: string | null): boolean {
  if (!note) return false
  return note.includes(WELCOME_PASSWORD_MARKER)
}

export function hasWelcomeEmailSent(note?: string | null): boolean {
  if (!note) return false
  return note.includes(WELCOME_EMAIL_MARKER)
}

export function getEmailUserWelcomeState(note?: string | null): EmailUserWelcomeState {
  if (hasWelcomeEmailSent(note)) {
    return 'completed'
  }

  if (hasPasswordBeenSet(note)) {
    return 'password_set'
  }

  return 'new_email_user'
}

export function isFirstTimeEmailUserByState(note?: string | null): boolean {
  return getEmailUserWelcomeState(note) === 'new_email_user'
}
