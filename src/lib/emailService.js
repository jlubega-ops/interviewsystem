import nodemailer from "nodemailer";
import { appAbsoluteUrl } from "./appUrl";

// Create transporter with Google SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Use App Password for Gmail
    },
  });
};

// Email templates
export const emailTemplates = {
  accountActivation: (userName, activationLink) => ({
    subject: "Activate Your Account - Interview System",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Activation</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 40px 30px; }
          .content h2 { color: #1f2937; margin: 0 0 20px 0; font-size: 24px; }
          .content p { color: #6b7280; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .button:hover { opacity: 0.9; }
          .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
          .footer p { color: #9ca3af; margin: 0; font-size: 14px; }
          .highlight { background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          .highlight p { color: #92400e; margin: 0; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Interview System</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Your account has been created successfully. To complete your registration and start using the system, please activate your account by clicking the button below.</p>
            
            <div style="text-align: center;">
              <a href="${activationLink}" class="button">Activate Account</a>
            </div>
            
            <div class="highlight">
              <p>⏰ This activation link will expire in 2 days for security reasons.</p>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px;">${activationLink}</p>
            
            <p>Once activated, you'll be able to log in and access all the features of the interview system.</p>
          </div>
          <div class="footer">
            <p>This email was sent from the Interview System. If you didn't request this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordReset: (userName, resetLink) => ({
    subject: "Reset Your Password - Interview System",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 40px 30px; }
          .content h2 { color: #1f2937; margin: 0 0 20px 0; font-size: 24px; }
          .content p { color: #6b7280; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px; }
          .button { display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .button:hover { opacity: 0.9; }
          .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
          .footer p { color: #9ca3af; margin: 0; font-size: 14px; }
          .highlight { background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0; }
          .highlight p { color: #991b1b; margin: 0; font-weight: 500; }
          .security { background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 20px 0; }
          .security p { color: #0c4a6e; margin: 0; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>We received a request to reset your password for your Interview System account. If you made this request, click the button below to reset your password.</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <div class="highlight">
              <p>⏰ This password reset link will expire in 30 minutes for security reasons.</p>
            </div>
            
            <div class="security">
              <p>🛡️ If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px;">${resetLink}</p>
          </div>
          <div class="footer">
            <p>This email was sent from the Interview System. If you didn't request this password reset, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send email function
export const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Interview System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

// Send account activation email
export const sendActivationEmail = async (email, userName, activationToken) => {
  const activationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/activate-account?token=${activationToken}`;
  const template = emailTemplates.accountActivation(userName, activationLink);

  return await sendEmail(email, template.subject, template.html);
};

// Send password reset email
export const sendPasswordResetEmail = async (email, userName, resetToken) => {
  const resetLink = appAbsoluteUrl(
    `/reset-password?token=${encodeURIComponent(resetToken)}`
  );
  const template = emailTemplates.passwordReset(userName, resetLink);

  return await sendEmail(email, template.subject, template.html);
};
