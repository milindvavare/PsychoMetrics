# Quick Start Guide - Running PsychoMetrics

This guide will help you get both the backend and frontend running quickly.

## Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v5.7 or higher) - Already installed with XAMPP
- **npm** (comes with Node.js)

## Step 1: Install Dependencies

### Install Backend Dependencies

Open terminal/command prompt in the project root directory:

```bash
npm install
```

### Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

**OR** use the combined install script (if available):

```bash
npm run install:all
```

## Step 2: Set Up Database

### 2.1 Start MySQL (XAMPP)

1. Open **XAMPP Control Panel**
2. Start **MySQL** service
3. Make sure MySQL is running (green status)

### 2.2 Create Database

Open **phpMyAdmin** (http://localhost/phpmyadmin) or use MySQL command line:

```sql
CREATE DATABASE psychometrics_db;
```

### 2.3 Configure Database Connection

Create a `.env` file in the **root directory** (same level as `package.json`):

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration (XAMPP Default)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=psychometrics_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
JWT_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
```

**Note:** If your XAMPP MySQL has a password, update `DB_PASSWORD` accordingly.

## Step 3: Configure Frontend

Create a `.env` file in the **frontend directory**:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Step 4: Run the Application

You have **two options** to run both frontend and backend:

### Option 1: Run Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Option 2: Run Together (Single Command)

```bash
npm run dev:all
```

This will start both backend and frontend simultaneously.

## Step 5: Access the Application

Once both servers are running:

- **Landing Page:** http://localhost:3000
- **Admin Login:** http://localhost:3000/login
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/health

## Step 6: Initial Setup (First Time Only)

### 6.1 Create a Company

You can create a company via API or directly in the database:

**Via Database (phpMyAdmin):**
```sql
INSERT INTO companies (name, domain, subscription_tier) 
VALUES ('My Company', 'mycompany.com', 'premium');
```

**Note the company ID** (usually 1 if it's the first one)

### 6.2 Create Admin User

**Via API (using Postman, curl, or browser console):**

```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123",
  "company_id": 1,
  "role": "admin",
  "first_name": "Admin",
  "last_name": "User"
}
```

**OR via Database:**
```sql
-- First, hash the password (use bcrypt or online tool)
-- For "admin123", the hash might be: $2a$10$...
-- For now, you can use a simple approach or use the API

INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
VALUES (1, 'admin@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin', 'User', 'admin');
```

**Note:** The password hash above is for "admin123". For production, always use the API registration endpoint.

### 6.3 Login

1. Go to http://localhost:3000/login
2. Enter:
   - **Email:** admin@example.com
   - **Password:** admin123
   - **Company ID:** 1 (optional)
3. Click "Login"

## Troubleshooting

### Backend Issues

**Port 5000 already in use:**
```bash
# Change PORT in .env file to another port (e.g., 5001)
PORT=5001
```

**Database connection error:**
- Check MySQL is running in XAMPP
- Verify database credentials in `.env`
- Ensure database `psychometrics_db` exists
- Check MySQL port (default: 3306)

**Module not found errors:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Frontend Issues

**Port 3000 already in use:**
- The React app will ask to use another port (usually 3001)
- Or change it in `frontend/package.json` scripts

**API connection errors:**
- Verify `REACT_APP_API_URL` in `frontend/.env`
- Check backend is running on correct port
- Check CORS settings in backend

**Module not found errors:**
```bash
cd frontend
rm -rf node_modules
npm install
```

### Database Issues

**Schema not initialized:**
- The backend automatically creates tables on first run
- Check backend logs for any errors
- Verify database user has CREATE TABLE permissions

**Tables already exist:**
- This is normal if you've run the app before
- The app will continue normally

## Development Workflow

1. **Start MySQL** (XAMPP)
2. **Start Backend:** `npm run dev` (in root directory)
3. **Start Frontend:** `cd frontend && npm start` (in new terminal)
4. **Make changes** - Both servers auto-reload on file changes
5. **Test** - Access http://localhost:3000

## Production Build

### Build Frontend:
```bash
cd frontend
npm run build
```

### Start Backend (Production):
```bash
NODE_ENV=production npm start
```

## Common Commands

```bash
# Install all dependencies
npm run install:all

# Run backend only
npm run dev

# Run frontend only
cd frontend && npm start

# Run both together
npm run dev:all

# Build frontend for production
cd frontend && npm run build
```

## Next Steps

After successful setup:

1. ✅ Create test categories
2. ✅ Add questions to question bank
3. ✅ Create a test
4. ✅ Add questions to test
5. ✅ Create candidates
6. ✅ Share test link with candidates
7. ✅ View results and reports

## Need Help?

- Check `SETUP.md` for detailed setup instructions
- Check `README.md` for API documentation
- Review backend logs in `logs/` directory
- Check browser console for frontend errors

