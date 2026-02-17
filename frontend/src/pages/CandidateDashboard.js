import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import {
  Quiz,
  ExitToApp,
  Person
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../utils/api';

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingTest, setStartingTest] = useState(null);
  const [candidate, setCandidate] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get candidate info
      const candidateResponse = await api.get('/candidate-auth/me');
      if (candidateResponse.success) {
        setCandidate(candidateResponse.data);
      }

      // Get available tests (this will show updated attempt counts)
      const testsResponse = await api.get('/candidate-auth/tests');
      if (testsResponse.success) {
        setTests(testsResponse.data || []);
      }
    } catch (error) {
      toast.error('Failed to load data');
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Reload data when component becomes visible again (when user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also reload when window gains focus
    window.addEventListener('focus', loadData);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', loadData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('candidate_token');
    localStorage.removeItem('candidate');
    toast.success('Logged out successfully');
    navigate('/candidate/login');
  };

  const handleStartTest = async (testId) => {
    if (!candidate) {
      toast.error('Candidate information not available');
      return;
    }

    // Prevent double clicks
    if (startingTest === testId) {
      return;
    }

    setStartingTest(testId);

    try {
      // Start the attempt first to ensure it's created and counted immediately
      const response = await api.post('/attempts/start', {
        test_id: parseInt(testId)
      });
      
      if (response.success) {
        // Reload test data immediately to get updated attempt count from server
        // This ensures the count is accurate
        await loadData();
        
        // Navigate to the test page
        navigate(`/test/${testId}/${candidate.id}`);
      } else {
        toast.error(response.message || 'Failed to start test');
        setStartingTest(null);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to start test');
      console.error('Start test error:', error);
      setStartingTest(null);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Toolbar>
          <Quiz sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Candidate Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {candidate && (
              <Typography variant="body2">
                {candidate.first_name} {candidate.last_name}
              </Typography>
            )}
            <IconButton color="inherit" onClick={handleLogout}>
              <ExitToApp />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Available Tests
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Select a test to begin
        </Typography>

        {tests.length === 0 ? (
          <Alert severity="info">
            No tests available at the moment. Please check back later.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {tests.map((test) => (
              <Grid item xs={12} md={6} key={test.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h5" gutterBottom fontWeight="bold">
                      {test.title}
                    </Typography>
                    {test.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {test.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {test.duration_minutes && (
                        <Chip label={`${test.duration_minutes} min`} size="small" />
                      )}
                      <Chip 
                        label={`${test.question_count || 0} questions`} 
                        size="small" 
                        color="primary"
                      />
                      {test.remaining_attempts !== undefined && (
                        <Chip 
                          label={`${test.remaining_attempts} attempts left`} 
                          size="small"
                          color={test.remaining_attempts > 0 ? 'success' : 'error'}
                        />
                      )}
                    </Box>

                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => handleStartTest(test.test_id || test.id)}
                      disabled={!test.can_attempt || startingTest === (test.test_id || test.id)}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #6a3d91 100%)'
                        }
                      }}
                    >
                      {startingTest === (test.test_id || test.id) ? 'Starting...' : (test.can_attempt ? 'Start Test' : 'No Attempts Remaining')}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default CandidateDashboard;

