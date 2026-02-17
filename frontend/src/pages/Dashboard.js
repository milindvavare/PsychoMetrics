import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  Quiz,
  QuestionAnswer,
  People,
  Assessment
} from '@mui/icons-material';
import api from '../utils/api';

const StatCard = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography color="text.secondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h3" component="div" color="white" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Box sx={{ color: 'white', opacity: 0.8 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    tests: 0,
    questions: 0,
    candidates: 0,
    attempts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [testsRes, questionsRes, candidatesRes] = await Promise.all([
        api.get('/tests'),
        api.get('/questions'),
        api.get('/candidates')
      ]);

      setStats({
        tests: testsRes.data?.length || 0,
        questions: questionsRes.data?.length || 0,
        candidates: candidatesRes.data?.length || 0,
        attempts: 0 // You can add an endpoint for this
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Welcome back! Here's an overview of your platform.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Tests"
            value={stats.tests}
            icon={<Quiz sx={{ fontSize: 60 }} />}
            color="#667eea"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Questions"
            value={stats.questions}
            icon={<QuestionAnswer sx={{ fontSize: 60 }} />}
            color="#764ba2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Candidates"
            value={stats.candidates}
            icon={<People sx={{ fontSize: 60 }} />}
            color="#f093fb"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Test Attempts"
            value={stats.attempts}
            icon={<Assessment sx={{ fontSize: 60 }} />}
            color="#4facfe"
          />
        </Grid>
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
              <CardContent>
                <Typography variant="h6">Create New Test</Typography>
                <Typography variant="body2" color="text.secondary">
                  Set up a new psychometric test
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
              <CardContent>
                <Typography variant="h6">Add Questions</Typography>
                <Typography variant="body2" color="text.secondary">
                  Expand your question bank
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
              <CardContent>
                <Typography variant="h6">View Reports</Typography>
                <Typography variant="body2" color="text.secondary">
                  Analyze test results
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
              <CardContent>
                <Typography variant="h6">Manage Candidates</Typography>
                <Typography variant="body2" color="text.secondary">
                  Add or update candidates
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Dashboard;

