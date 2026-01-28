/**
 * Email Templates
 *
 * HTML templates for system-generated emails
 */

export interface WelcomeEmailParams {
  customerName: string
  email: string
  password: string
  loginUrl: string
  ticketNumber: string
}

/**
 * Generate welcome email HTML for first-time email users
 *
 * @param params - Template parameters
 * @returns HTML string for the welcome email
 */
export function generateWelcomeEmailHtml(params: WelcomeEmailParams): string {
  const { customerName, email, password, loginUrl, ticketNumber } = params

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #7c3aed; padding: 24px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Welcome to Our Support Platform</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">Dear ${customerName || 'Valued Customer'},</p>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">
                Thank you for contacting us! Your support ticket <strong>#${ticketNumber}</strong> has been received.
              </p>

              <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px;">
                We have created an account for you so you can track your tickets and communicate with our support team through our web platform.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase;">Your Login Credentials</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 80px;">Email:</td>
                        <td style="padding: 4px 0; color: #111827; font-size: 14px; font-weight: 500;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 80px;">Password:</td>
                        <td style="padding: 4px 0; color: #111827; font-size: 14px; font-weight: 500; font-family: monospace;">${password}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">⚠️ Important Security Notice</p>
                    <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;">
                      Please change your password immediately after your first login for security purposes.
                      This temporary password is visible in your ticket history.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      Login to Your Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px 0; color: #7c3aed; font-size: 14px; word-break: break-all;">
                ${loginUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Best regards,<br>
                Customer Support Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

/**
 * Generate welcome email subject line
 */
export function generateWelcomeEmailSubject(ticketNumber: string): string {
  return `Welcome! Your account has been created (Ticket #${ticketNumber})`
}
