const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create reusable transporter
const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '465');
  const secure = port === 465; // true for 465 (SSL), false for other ports (TLS)
  
  const config = {
    host: process.env.SMTP_HOST || 'smtp.ycms.in',
    port: port,
    secure: secure,
    auth: {
      user: process.env.SMTP_USER || 'psychometrics@ycms.in',
      pass: process.env.SMTP_PASSWORD || 'Jl4f61235'
    }
  };

  // Add TLS config for non-SSL ports
  if (!secure) {
    config.tls = {
      rejectUnauthorized: false // For self-signed certificates
    };
  }

  logger.info(`Creating email transporter: ${config.host}:${config.port} (secure: ${secure})`);
  
  return nodemailer.createTransport(config);
};

// Send candidate invitation email
const sendCandidateInvitation = async (candidateEmail, candidateName, setupToken, companyName) => {
  try {
    // Verify SMTP configuration
    if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
      logger.warn('SMTP configuration not found in environment variables, using defaults');
    }

    const transporter = createTransporter();
    
    // Verify connection
    await transporter.verify();
    logger.info('SMTP connection verified successfully');
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const setupLink = `${frontendUrl}/candidate/setup-password?token=${setupToken}`;

    const mailOptions = {
      from: `"${companyName || 'PsychoMetrics'}" <${process.env.SMTP_USER || 'psychometrics@ycms.in'}>`,
      to: candidateEmail,
      subject: 'Invitation to Take Assessment Test',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Assessment Test Invitation</h1>
          </div>
          <div class="content">
            <p>Dear ${candidateName || 'Candidate'},</p>
            
            <p>You have been invited by <strong>${companyName || 'our organization'}</strong> to take an assessment test.</p>
            
            <p>To get started, please set up your password by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${setupLink}" class="button">Set Up Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${setupLink}</p>
            
            <p><strong>Important:</strong> This link will expire in 7 days. If you have any questions, please contact the organization that invited you.</p>
            
            <p>Best regards,<br>The PsychoMetrics Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Assessment Test Invitation
        
        Dear ${candidateName || 'Candidate'},
        
        You have been invited by ${companyName || 'our organization'} to take an assessment test.
        
        To get started, please set up your password by visiting:
        ${setupLink}
        
        This link will expire in 7 days.
        
        Best regards,
        The PsychoMetrics Team
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Invitation email sent to ${candidateEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending invitation email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    
    // Provide more detailed error message
    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to SMTP server. Please check SMTP_HOST and SMTP_PORT.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'SMTP connection timed out. Please check your network connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

// Send password reset email (for future use)
const sendPasswordReset = async (candidateEmail, candidateName, resetToken) => {
  try {
    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/candidate/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"PsychoMetrics" <${process.env.SMTP_USER || 'psychometrics@ycms.in'}>`,
      to: candidateEmail,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Dear ${candidateName || 'Candidate'},</p>
            
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
            
            <p><strong>Important:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
            
            <p>Best regards,<br>The PsychoMetrics Team</p>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${candidateEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendCandidateInvitation,
  sendPasswordReset
};

