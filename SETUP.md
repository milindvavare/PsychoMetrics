# Setup Guide

## Quick Start

### 1. Database Setup

1. Create MySQL database:
```sql
CREATE DATABASE psychometrics_db;
```

2. Update `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=psychometrics_db
```

### 2. Backend Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file in root directory (copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=psychometrics_db

JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

LOG_LEVEL=info
```

3. Start backend:
```bash
npm run dev
```

The database schema will be automatically initialized on first run.

### 3. Frontend Setup

1. Navigate to frontend:
```bash
cd frontend
npm install
```

2. Create `.env` file in frontend directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

3. Start frontend:
```bash
npm start
```

### 4. Initial Data Setup

After starting the backend, you'll need to:

1. **Create a Company** (via API or directly in database):
```sql
INSERT INTO companies (name, domain, subscription_tier) 
VALUES ('Test Company', 'testcompany.com', 'premium');
```

2. **Create a User** (via API):
```bash
POST /api/auth/register
{
  "email": "admin@testcompany.com",
  "password": "password123",
  "company_id": 1,
  "role": "admin",
  "first_name": "Admin",
  "last_name": "User"
}
```

3. **Login**:
```bash
POST /api/auth/login
{
  "email": "admin@testcompany.com",
  "password": "password123",
  "company_id": 1
}
```

4. **Create Test Categories**:
```bash
POST /api/categories
{
  "name": "Cognitive Ability",
  "description": "Tests cognitive skills",
  "weight": 1.0,
  "reverse_score": false
}
```

5. **Create Questions**:
```bash
POST /api/questions
{
  "category_id": 1,
  "question_text": "What is 2 + 2?",
  "question_type": "single_choice",
  "options": ["2", "3", "4", "5"],
  "correct_answer": "4",
  "points": 1.0,
  "difficulty": "easy"
}
```

6. **Create a Test**:
```bash
POST /api/tests
{
  "title": "Sample Test",
  "description": "A sample psychometric test",
  "duration_minutes": 30,
  "max_attempts": 1,
  "negative_marking": false,
  "enable_percentile": true,
  "category_ids": [{"id": 1, "weight": 1.0}],
  "status": "active"
}
```

7. **Add Questions to Test**:
```bash
POST /api/questions/test/add
{
  "test_id": 1,
  "question_id": 1,
  "display_order": 1
}
```

8. **Create a Candidate**:
```bash
POST /api/candidates
{
  "email": "candidate@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

### 5. Test the Candidate UI

Access the test at:
```
http://localhost:3000/test/{testId}/{candidateId}
```

Replace `{testId}` and `{candidateId}` with the IDs from your database.

## API Testing

You can use tools like Postman, Insomnia, or curl to test the API endpoints.

### Example: Start a Test Attempt

```bash
curl -X POST http://localhost:5000/api/attempts/start \
  -H "Content-Type: application/json" \
  -d '{
    "test_id": 1,
    "candidate_id": 1
  }'
```

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check database credentials in `.env`
- Ensure database exists

### Port Already in Use
- Change `PORT` in `.env` for backend
- Change port in `frontend/package.json` scripts for frontend

### CORS Issues
- Verify `FRONTEND_URL` in backend `.env` matches frontend URL

### Module Not Found
- Run `npm install` in both root and frontend directories
- Delete `node_modules` and reinstall if issues persist

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper database credentials
4. Set up SSL/HTTPS
5. Use process manager (PM2) for Node.js
6. Build frontend: `cd frontend && npm run build`
7. Serve frontend build with nginx or similar
8. Configure reverse proxy for API

## Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Use strong database passwords
- [ ] Enable HTTPS in production
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable helmet security headers
- [ ] Regular database backups
- [ ] Monitor logs for suspicious activity

