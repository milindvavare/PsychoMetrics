# How to Run PsychoMetrics - Step by Step

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies

**Open terminal in project root:**

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Start MySQL (XAMPP)

1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. Wait until it shows **green** (running)

### 3. Create Database

**Option A: Using phpMyAdmin (Easier)**
1. Go to http://localhost/phpmyadmin
2. Click **New** in left sidebar
3. Database name: `psychometrics_db`
4. Click **Create**

**Option B: Using MySQL Command Line**
```sql
CREATE DATABASE psychometrics_db;
```

### 4. Create Environment Files

**Create `.env` in root directory:**
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=psychometrics_db

JWT_SECRET=your-secret-key-12345
JWT_EXPIRES_IN=7d

# Email Configuration (SMTP)
SMTP_HOST=smtp.ycms.in
SMTP_PORT=465
SMTP_USER=psychometrics@ycms.in
SMTP_PASSWORD=Jl4f61235

LOG_LEVEL=info
```

**Create `.env` in frontend directory:**
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 5. Run the Application

**Open TWO terminal windows:**

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

**OR use single command (both together):**
```bash
npm run dev:all
```

### 6. Access the Application

- 🌐 **Landing Page:** http://localhost:3000
- 🔐 **Admin Login:** http://localhost:3000/login
- 🔧 **API:** http://localhost:5000
- ✅ **Health Check:** http://localhost:5000/health

## 📝 First Time Setup

### Create Admin User

**Step 1: Create Company (via Database)**

Go to phpMyAdmin → `psychometrics_db` → SQL tab:

```sql
INSERT INTO companies (name, domain, subscription_tier) 
VALUES ('My Company', 'mycompany.com', 'premium');
```

**Step 2: Create Admin User (via API)**

Use Postman, curl, or browser console:

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

**Step 3: Login**

1. Go to http://localhost:3000/login
2. Email: `admin@example.com`
3. Password: `admin123`
4. Company ID: `1` (optional)
5. Click **Login**

## 🎯 What You'll See

### Backend Terminal:
```
Server running on port 5000
Environment: development
Database connection established
Database schema initialized successfully
```

### Frontend Terminal:
```
Compiled successfully!
You can now view psychometrics-frontend in the browser.
Local: http://localhost:3000
```

### Browser:
- Beautiful landing page
- Professional admin interface after login
- Full dashboard with statistics

## ⚠️ Troubleshooting

### Backend Won't Start

**Error: Port 5000 in use**
```bash
# Change PORT in .env to 5001
PORT=5001
```

**Error: Cannot connect to database**
- ✅ Check MySQL is running in XAMPP
- ✅ Verify database exists: `psychometrics_db`
- ✅ Check `.env` database credentials
- ✅ Default XAMPP: user=`root`, password=`` (empty)

**Error: Module not found**
```bash
rm -rf node_modules
npm install
```

### Frontend Won't Start

**Error: Port 3000 in use**
- React will automatically use port 3001
- Or change in `frontend/package.json`

**Error: Cannot connect to API**
- ✅ Check backend is running
- ✅ Verify `REACT_APP_API_URL` in `frontend/.env`
- ✅ Check CORS settings

**Error: Module not found**
```bash
cd frontend
rm -rf node_modules
npm install
```

### Database Issues

**Tables not created:**
- Backend auto-creates tables on first run
- Check backend logs for errors
- Verify database user has CREATE permissions

**Connection refused:**
- Start MySQL in XAMPP
- Check MySQL port (default: 3306)
- Verify XAMPP MySQL is running

## 📋 Complete Command Reference

```bash
# Install everything
npm run install:all

# Run backend only
npm run dev

# Run frontend only
cd frontend && npm start

# Run both together
npm run dev:all

# Production build
cd frontend && npm run build
NODE_ENV=production npm start
```

## ✅ Verification Checklist

- [ ] MySQL is running (XAMPP)
- [ ] Database `psychometrics_db` exists
- [ ] `.env` file in root directory
- [ ] `.env` file in frontend directory
- [ ] Backend dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`cd frontend && npm install`)
- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] Can access http://localhost:3000
- [ ] Can access http://localhost:5000/health

## 🎉 You're Ready!

Once everything is running:
1. Login at http://localhost:3000/login
2. Create test categories
3. Add questions
4. Create tests
5. Add candidates
6. Share test links
7. View results!

For detailed API documentation, see `README.md`

