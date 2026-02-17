# PsychoMetrics - Production-Ready Psychometric Testing SaaS Platform

A comprehensive, production-ready backend and frontend system for psychometric testing with advanced features including multi-company support, AI interpretation, and anti-cheating mechanisms.

## Features

### Core Features
- ✅ **Test Management** - Complete CRUD operations for tests
- ✅ **Question Bank** - Manage questions with categories
- ✅ **Advanced Scoring Engine** - Category scoring, reverse scoring, negative marking
- ✅ **Percentile Calculation** - Automatic percentile ranking
- ✅ **Attempt Limits** - Configurable maximum attempts per test
- ✅ **Multi-Company Support** - SaaS-ready architecture with company isolation
- ✅ **IP Logging** - Track candidate IP addresses and user agents

### Advanced Features
- ✅ **Radar Chart API** - Generate radar charts for category performance
- ✅ **AI Interpretation Engine** - AI-powered test result interpretation
- ✅ **Benchmark Comparison** - Compare scores against benchmarks
- ✅ **Shortlist Recommendation** - Automated candidate shortlisting
- ✅ **PDF Report Generator** - Generate detailed PDF reports
- ✅ **Anti-Cheating System** - Tab switch detection and monitoring

### Frontend
- ✅ **React Candidate Test UI** - Modern, responsive test-taking interface
- ✅ **Real-time Timer** - Countdown timer with visual indicators
- ✅ **Question Navigation** - Easy navigation between questions
- ✅ **Answer Persistence** - Auto-save answers
- ✅ **Tab Detection** - Frontend tab switch monitoring

## Tech Stack

### Backend
- Node.js + Express
- MySQL
- JWT Authentication
- PDF Generation (PDFKit)
- Winston Logging

### Frontend
- React 18
- React Router
- Chart.js (Radar Charts)
- Axios
- React Toastify

## Project Structure

```
PychoMetrics/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── testController.js
│   │   ├── questionController.js
│   │   ├── attemptController.js
│   │   ├── scoreController.js
│   │   ├── radarController.js
│   │   ├── aiController.js
│   │   ├── benchmarkController.js
│   │   ├── shortlistController.js
│   │   ├── reportController.js
│   │   └── companyController.js
│   ├── database/
│   │   └── schema.sql
│   ├── middleware/
│   │   ├── auth.js
│   │   └── antiCheat.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tests.js
│   │   ├── questions.js
│   │   ├── attempts.js
│   │   ├── scores.js
│   │   ├── radar.js
│   │   ├── ai.js
│   │   ├── benchmark.js
│   │   ├── shortlist.js
│   │   ├── reports.js
│   │   └── companies.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── scoring.js
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Timer.js
│   │   │   └── QuestionCard.js
│   │   ├── pages/
│   │   │   ├── TestPage.js
│   │   │   └── TestComplete.js
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── tabDetection.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── package.json
└── README.md
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Backend Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file in root directory:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=psychometrics_db

JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

LOG_LEVEL=info
```

3. Create MySQL database:
```sql
CREATE DATABASE psychometrics_db;
```

4. Start the backend server:
```bash
npm run dev
```

The server will automatically initialize the database schema on first run.

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Create `.env` file in frontend directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

3. Start the frontend:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Tests
- `GET /api/tests` - Get all tests
- `GET /api/tests/:id` - Get single test
- `POST /api/tests` - Create test
- `PUT /api/tests/:id` - Update test
- `DELETE /api/tests/:id` - Delete test

### Questions
- `GET /api/questions` - Get all questions
- `GET /api/questions/:id` - Get single question
- `POST /api/questions` - Create question
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question
- `POST /api/questions/test/add` - Add question to test

### Attempts
- `POST /api/attempts/start` - Start test attempt
- `POST /api/attempts/answer` - Submit answer
- `POST /api/attempts/submit` - Submit attempt
- `GET /api/attempts/:id` - Get attempt details
- `POST /api/attempts/track-tab` - Track tab switch

### Scores
- `GET /api/scores/test/:test_id` - Get test scores
- `GET /api/scores/candidate/:candidate_id` - Get candidate scores
- `GET /api/scores/statistics/:test_id` - Get score statistics

### Radar Charts
- `GET /api/radar/attempt/:attempt_id` - Get radar data for attempt
- `GET /api/radar/test/:test_id/comparative` - Get comparative radar data

### AI Interpretation
- `POST /api/ai/interpret/:attempt_id` - Generate AI interpretation
- `GET /api/ai/interpret/:attempt_id` - Get interpretation

### Benchmarks
- `GET /api/benchmark/attempt/:attempt_id` - Get benchmark comparison
- `GET /api/benchmark` - Get benchmarks
- `POST /api/benchmark` - Create benchmark

### Shortlist
- `POST /api/shortlist/test/:test_id/generate` - Generate shortlist
- `GET /api/shortlist/test/:test_id` - Get shortlist recommendations

### Reports
- `GET /api/reports/attempt/:attempt_id/pdf` - Download PDF report

## Database Schema

The system includes comprehensive database schema with:
- Companies (multi-tenant support)
- Users (role-based access)
- Candidates
- Tests
- Questions
- Test Categories
- Test Attempts
- Answers
- Scores
- Benchmarks
- AI Interpretations
- Shortlist Recommendations
- Reports

## Security Features

- JWT-based authentication
- Role-based authorization (super_admin, admin, hr, viewer)
- Company-level data isolation
- IP address logging
- Tab switch detection
- Rate limiting
- Helmet security headers
- CORS configuration

## Scoring Engine

The advanced scoring engine supports:
- **Category Scoring** - Score by test categories
- **Reverse Scoring** - Invert scores for specific categories
- **Negative Marking** - Deduct points for wrong answers
- **Weighted Scoring** - Category weights
- **Percentile Calculation** - Automatic percentile ranking
- **Pass/Fail Determination** - Based on passing score

## Usage Example

### Creating a Test

```javascript
POST /api/tests
{
  "title": "Personality Assessment",
  "description": "Comprehensive personality test",
  "duration_minutes": 60,
  "max_attempts": 1,
  "negative_marking": true,
  "negative_mark_percentage": 25,
  "enable_percentile": true,
  "category_ids": [
    { "id": 1, "weight": 1.0 },
    { "id": 2, "weight": 1.5 }
  ]
}
```

### Starting a Test Attempt

```javascript
POST /api/attempts/start
{
  "test_id": 1,
  "candidate_id": 1
}
```

### Candidate Test URL

```
http://localhost:3000/test/{testId}/{candidateId}
```

## Development

### Running Both Backend and Frontend

```bash
npm run dev:all
```

### Backend Only

```bash
npm run dev
```

### Frontend Only

```bash
npm run client
```

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Update database credentials
3. Set strong `JWT_SECRET`
4. Build frontend: `cd frontend && npm run build`
5. Serve frontend build with a web server (nginx, Apache, etc.)
6. Use PM2 or similar for Node.js process management

## License

ISC

## Support

For issues and questions, please create an issue in the repository.

