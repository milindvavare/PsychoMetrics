# Email Invitation System for Candidates

## Overview

The email invitation system allows company admins to invite candidates to take assessment tests. When a candidate is added, they receive an email with a secure link to set up their password and access the platform.

## Features

- ✅ Automatic email invitation when candidate is created
- ✅ Secure password setup via token-based link
- ✅ Token expiration (7 days)
- ✅ Professional HTML email templates
- ✅ Password validation and security
- ✅ Candidate can login after setting password

## Setup

### 1. Install Dependencies

The `nodemailer` package has been added to `package.json`. Install it:

```bash
npm install
```

### 2. Configure SMTP Settings

Add these settings to your `.env` file in the root directory:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.ycms.in
SMTP_PORT=465
SMTP_USER=psychometrics@ycms.in
SMTP_PASSWORD=Jl4f61235
FRONTEND_URL=http://localhost:3000
```

**Note:** For production, use environment variables and never commit passwords to version control.

### 3. Database Migration

If you have an existing database, run the migration script:

```sql
-- Run this in phpMyAdmin or MySQL command line
SOURCE backend/database/migration_add_candidate_password_fields.sql;
```

Or manually add these columns to the `candidates` table:

```sql
ALTER TABLE candidates 
ADD COLUMN password_hash VARCHAR(255) AFTER email,
ADD COLUMN password_setup_token VARCHAR(255) AFTER password_hash,
ADD COLUMN password_setup_expires DATETIME AFTER password_setup_token,
ADD COLUMN status ENUM('active', 'inactive', 'blocked') DEFAULT 'active' AFTER metadata;

ALTER TABLE candidates 
ADD UNIQUE KEY unique_email_company (email, company_id),
ADD INDEX idx_password_setup_token (password_setup_token);
```

## How It Works

### 1. Admin Creates Candidate

When an admin creates a candidate through the admin panel:

```javascript
POST /api/candidates
{
  "email": "candidate@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "1234567890",
  "send_invitation": true  // Optional, defaults to true
}
```

**What happens:**
- Candidate record is created in database
- A secure token is generated (`password_setup_token`)
- Token expiration is set (7 days from now)
- Invitation email is automatically sent (if `send_invitation` is not false)

### 2. Candidate Receives Email

The candidate receives a professional HTML email with:
- Welcome message
- Company name
- Secure password setup link
- Link expiration notice

**Email Link Format:**
```
http://localhost:3000/candidate/setup-password?token=<secure-token>
```

### 3. Candidate Sets Password

When candidate clicks the link:
- Token is verified (valid and not expired)
- Password setup form is displayed
- Candidate enters password (min 6 characters)
- Password is hashed and stored
- Token is cleared
- Candidate status is set to 'active'

### 4. Candidate Can Login

After setting password, candidate can login:
- Go to `/candidate/login`
- Enter email and password
- Access dashboard to view available tests

## API Endpoints

### Verify Setup Token
```
GET /api/candidate-auth/verify-setup-token/:token
```
**Response:**
```json
{
  "success": true,
  "data": {
    "email": "candidate@example.com",
    "name": "John Doe"
  }
}
```

### Setup Password
```
POST /api/candidate-auth/setup-password
Body: {
  "token": "abc123...",
  "password": "securepassword"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password set successfully. You can now login."
}
```

## Frontend Routes

- `/candidate/setup-password?token=<token>` - Password setup page
- `/candidate/login` - Candidate login page
- `/candidate/dashboard` - Candidate dashboard (after login)

## Email Customization

The email template is in `backend/utils/emailService.js`. You can customize:

- Email subject
- HTML template
- Email styling
- Company branding
- Link expiration message

## Security Features

1. **Token Security:**
   - Cryptographically secure random tokens (32 bytes)
   - Tokens expire after 7 days
   - One-time use (cleared after password setup)

2. **Password Security:**
   - Minimum 6 characters
   - Bcrypt hashing (10 rounds)
   - Never stored in plain text

3. **Account Status:**
   - Candidates must be 'active' to login
   - Inactive/blocked accounts cannot access system

## Troubleshooting

### Email Not Sending

1. **Check SMTP Settings:**
   - Verify SMTP credentials in `.env`
   - Test SMTP connection
   - Check firewall/network restrictions

2. **Check Logs:**
   - Backend logs will show email errors
   - Check `backend/logs/` directory

3. **Common Issues:**
   - Wrong SMTP port (use 465 for SSL, 587 for TLS)
   - Incorrect credentials
   - SMTP server blocking connection

### Token Expired

- Candidate must request a new invitation
- Admin can resend invitation by updating candidate
- Token expiration is 7 days (configurable in code)

### Password Already Set

- If candidate already set password, they should login instead
- Token becomes invalid after password is set
- Use login page: `/candidate/login`

## Testing

### Test Email Sending

1. Create a test candidate via admin panel
2. Check email inbox (and spam folder)
3. Click the setup link
4. Set password
5. Login with credentials

### Test Token Expiration

1. Create candidate
2. Wait 7+ days (or manually expire token in database)
3. Try to use the link
4. Should show "Token expired" message

## Future Enhancements

- Resend invitation email option
- Password reset functionality
- Email templates customization UI
- Multiple email providers support
- Email delivery tracking

