# KRA & KPI Management System - Implementation Guide

## Overview

A comprehensive KRA (Key Result Areas) & KPI (Key Performance Indicators) management system has been implemented for the company login. This allows companies to:

1. **Define KRAs** - High-level areas of responsibility
2. **Create KPIs** - Specific measurable metrics for each KRA
3. **Assign KRAs** - Assign KRAs to employees or candidates
4. **Track Performance** - Submit and track KPI performance
5. **Review & Approve** - HR/Admin can review and approve performance submissions
6. **Analytics & Reports** - View performance dashboards and analytics

## Database Schema

### Tables Created

1. **`kras`** - Key Result Areas
2. **`kpis`** - Key Performance Indicators
3. **`employee_kras`** - KRA assignments to employees/candidates
4. **`kpi_performance`** - KPI performance tracking
5. **`kra_performance_summary`** - KRA performance summaries
6. **`kra_templates`** - Templates for quick setup

### Migration

Run the migration file:
```bash
mysql -u root -p psychometrics_db < backend/database/migration_add_kra_kpi.sql
```

Or the schema is already included in `backend/database/schema.sql`

## Backend API Endpoints

### KRA Endpoints

- `GET /api/kras` - Get all KRAs
- `GET /api/kras/:id` - Get single KRA with KPIs
- `POST /api/kras` - Create KRA (Admin/HR only)
- `PUT /api/kras/:id` - Update KRA (Admin/HR only)
- `DELETE /api/kras/:id` - Delete KRA (Admin/Super Admin only)
- `POST /api/kras/assign` - Assign KRA to employee/candidate
- `GET /api/kras/employee/:employee_type/:employee_id` - Get employee KRAs

### KPI Endpoints

- `GET /api/kpis` - Get all KPIs (filter by kra_id, status, search)
- `GET /api/kpis/:id` - Get single KPI
- `POST /api/kpis` - Create KPI (Admin/HR only)
- `PUT /api/kpis/:id` - Update KPI (Admin/HR only)
- `DELETE /api/kpis/:id` - Delete KPI (Admin/Super Admin only)
- `POST /api/kpis/performance` - Submit KPI performance
- `GET /api/kpis/performance/:employee_type/:employee_id` - Get KPI performance
- `PUT /api/kpis/performance/:id/review` - Approve/Reject performance (Admin/HR only)

### User Endpoints

- `GET /api/users` - Get all users for company

## Frontend Pages

### 1. KRA Management (`/dashboard/kras`)

**Features:**
- View all KRAs in a table
- Create new KRA
- Edit existing KRA
- Delete KRA
- Assign KRA to employees/candidates
- Filter by status, category, search

**Fields:**
- Title (required)
- Description
- Category (e.g., Sales, Operations, HR, Technical)
- Weight (default: 1.0)
- Status (active, inactive, archived)

### 2. KPI Management (`/dashboard/kpis`)

**Features:**
- View all KPIs in a table
- Create new KPI (linked to a KRA)
- Edit existing KPI
- Delete KPI
- Filter by KRA, status, search

**Fields:**
- KRA (required - dropdown)
- Title (required)
- Description
- Measurement Type (percentage, number, currency, rating, boolean, text)
- Target Value
- Unit (e.g., %, $, hours)
- Frequency (daily, weekly, monthly, quarterly, yearly, custom)
- Weight (default: 1.0)
- Formula (optional - for automatic calculation)
- Status (active, inactive, archived)

### 3. KRA/KPI Dashboard (`/dashboard/kra-dashboard/:employeeType/:employeeId`)

**Features:**
- View assigned KRAs
- View KPI performance
- Submit KPI performance
- View performance charts
- Filter by date period
- Performance ratings and status

## Key Features

### KRA Assignment

- Assign KRAs to both **users** (employees) and **candidates**
- Set start and end dates
- Assign weight for each KRA
- Add notes/comments

### KPI Performance Tracking

- Submit actual values for KPIs
- Automatic calculation of achievement percentage
- Automatic rating assignment:
  - Excellent: ≥100%
  - Good: 90-99%
  - Satisfactory: 75-89%
  - Needs Improvement: 60-74%
  - Poor: <60%
- Status workflow: Draft → Submitted → Approved/Rejected
- Add comments and evidence URLs

### Performance Review

- HR/Admin can review submitted performance
- Approve or reject submissions
- Add review comments
- Track approval history

## Integration Points

### With Candidates

- KRAs can be assigned to candidates
- KPIs can be tracked for candidates
- Performance can be linked to test results

### With Employees (Users)

- KRAs can be assigned to company users
- KPIs can be tracked for employees
- Performance reviews and appraisals

## Usage Flow

### For HR/Admin:

1. **Create KRAs:**
   - Go to KRA Management
   - Click "Create KRA"
   - Fill in details
   - Save

2. **Create KPIs:**
   - Go to KPI Management
   - Click "Create KPI"
   - Select KRA
   - Fill in KPI details
   - Save

3. **Assign KRAs:**
   - Go to KRA Management
   - Click "Assign" icon
   - Select employee type (user/candidate)
   - Select employee/candidate
   - Set dates and weight
   - Assign

4. **Review Performance:**
   - View employee KRA/KPI dashboard
   - Review submitted performance
   - Approve or reject with comments

### For Employees/Candidates:

1. **View Assigned KRAs:**
   - Access KRA/KPI dashboard
   - View all assigned KRAs

2. **Submit KPI Performance:**
   - Select KPI
   - Enter actual value
   - Add comments/evidence
   - Submit

3. **Track Progress:**
   - View performance charts
   - Check achievement percentages
   - See ratings and status

## Menu Integration

The KRA & KPI management has been added to the admin sidebar:
- **KRA Management** - Icon: TrendingUp
- **KPI Management** - Icon: ShowChart

## Database Relationships

```
Companies
  └── KRAs (1 to many)
       └── KPIs (1 to many)
            └── KPI Performance (many to many with employees/candidates)

Employees/Candidates
  └── Employee KRAs (many to many)
       └── KPI Performance (tracked per period)
```

## Future Enhancements

1. **KRA Templates** - Quick setup with predefined KRAs/KPIs
2. **Automated Reminders** - Email reminders for performance submission
3. **Performance Reports** - Comprehensive performance reports
4. **Goal Setting** - Annual/quarterly goal setting
5. **360-Degree Feedback** - Peer reviews and feedback
6. **Performance Appraisals** - Formal appraisal process
7. **Integration with Test Results** - Link psychometric scores to KPI performance

## Testing

To test the system:

1. **Create a KRA:**
   - Navigate to `/dashboard/kras`
   - Click "Create KRA"
   - Fill in details and save

2. **Create a KPI:**
   - Navigate to `/dashboard/kpis`
   - Click "Create KPI"
   - Select KRA and fill details

3. **Assign KRA:**
   - Go to KRA Management
   - Click "Assign" on a KRA
   - Select employee/candidate and assign

4. **Submit Performance:**
   - Access employee dashboard
   - Submit KPI performance
   - Verify calculation and rating

## Notes

- All KRA/KPI operations require authentication
- Create/Update/Delete operations require Admin/HR role
- Performance submission is available to all authenticated users
- Review/Approve requires Admin/HR role
- System supports both employees (users) and candidates

