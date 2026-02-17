import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import {
  Download,
  Home,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { toast } from 'react-toastify';
import api from '../utils/api';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const TestComplete = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [score, setScore] = useState(null);
  const [radarData, setRadarData] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setIsLoading(true);

      // Use candidate token if available (for candidates viewing their results)
      const candidateToken = localStorage.getItem('candidate_token');
      const adminToken = localStorage.getItem('token');
      
      // Temporarily set the token for this request
      const originalToken = candidateToken || adminToken;
      
      const attemptResponse = await api.get(`/attempts/${attemptId}`);
      if (attemptResponse.success) {
        setAttempt(attemptResponse.data);
        setScore(attemptResponse.data.score);
      } else {
        throw new Error(attemptResponse.message || 'Failed to load attempt');
      }

      try {
        const radarResponse = await api.get(`/radar/attempt/${attemptId}`);
        if (radarResponse.success) {
          setRadarData(radarResponse.data);
        }
      } catch (error) {
        console.error('Radar data error:', error);
      }

      try {
        const aiResponse = await api.post(`/ai/interpret/${attemptId}`);
        if (aiResponse.success && aiResponse.data) {
          // Ensure arrays are properly parsed
          const interpretation = {
            ...aiResponse.data,
            strengths: Array.isArray(aiResponse.data.strengths) 
              ? aiResponse.data.strengths 
              : (typeof aiResponse.data.strengths === 'string' ? JSON.parse(aiResponse.data.strengths || '[]') : []),
            weaknesses: Array.isArray(aiResponse.data.weaknesses) 
              ? aiResponse.data.weaknesses 
              : (typeof aiResponse.data.weaknesses === 'string' ? JSON.parse(aiResponse.data.weaknesses || '[]') : []),
            recommendations: Array.isArray(aiResponse.data.recommendations) 
              ? aiResponse.data.recommendations 
              : (typeof aiResponse.data.recommendations === 'string' ? JSON.parse(aiResponse.data.recommendations || '[]') : [])
          };
          setInterpretation(interpretation);
        }
      } catch (error) {
        console.error('AI interpretation error:', error);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = async () => {
    try {
      // Use candidate token if available, otherwise admin token
      const candidateToken = localStorage.getItem('candidate_token');
      const adminToken = localStorage.getItem('token');
      const token = candidateToken || adminToken;
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/attempt/${attemptId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `test-report-${attemptId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  if (isLoading) {
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
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading results...
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!attempt || !score) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Results Not Found</Typography>
          <Typography>Unable to load test results.</Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        <Paper elevation={10} sx={{ p: 4, borderRadius: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              Test Completed!
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Your results are ready
            </Typography>
          </Box>

          {/* Score Summary */}
          <Card
            sx={{
              mb: 4,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h5" gutterBottom>
                Your Score
              </Typography>
              <Typography variant="h2" fontWeight="bold" gutterBottom>
                {score.percentage_score}%
              </Typography>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {score.total_score} / {score.max_score} points
              </Typography>
              {score.percentile && (
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Percentile: {score.percentile}%
                </Typography>
              )}
              <Chip
                icon={score.passed ? <CheckCircle /> : <Cancel />}
                label={score.passed ? 'Passed' : 'Failed'}
                color={score.passed ? 'success' : 'error'}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
              />
            </CardContent>
          </Card>

          {/* Radar Chart */}
          {radarData && radarData.labels && radarData.labels.length > 0 && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h5" gutterBottom fontWeight="bold">
                  Category Performance
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ maxWidth: 600, margin: '0 auto' }}>
                  <Radar
                    data={radarData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      scales: {
                        r: {
                          beginAtZero: true,
                          max: 100,
                          ticks: {
                            stepSize: 20
                          }
                        }
                      }
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Category Scores */}
          {score.category_scores && Object.keys(score.category_scores).length > 0 && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h5" gutterBottom fontWeight="bold">
                  Category Breakdown
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  {Object.values(score.category_scores).map((category, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {category.category_name}
                          </Typography>
                          <Typography variant="h4" color="primary" fontWeight="bold">
                            {category.percentage}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {category.correct_count} / {category.total_count} correct
                          </Typography>
                          <Box
                            sx={{
                              width: '100%',
                              height: 8,
                              bgcolor: 'grey.200',
                              borderRadius: 1,
                              mt: 2,
                              overflow: 'hidden'
                            }}
                          >
                            <Box
                              sx={{
                                width: `${category.percentage}%`,
                                height: '100%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* AI Interpretation */}
          {interpretation && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h5" gutterBottom fontWeight="bold">
                  AI Interpretation
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                  {interpretation.interpretation_text}
                </Typography>

                {interpretation.strengths && 
                 ((Array.isArray(interpretation.strengths) && interpretation.strengths.length > 0) || 
                  (typeof interpretation.strengths === 'string' && interpretation.strengths.trim() !== '')) && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" color="success.main" gutterBottom>
                      Strengths
                    </Typography>
                    <Box component="ul" sx={{ pl: 2 }}>
                      {Array.isArray(interpretation.strengths) && interpretation.strengths.length > 0 ? (
                        interpretation.strengths.map((strength, index) => (
                          <li key={index}>
                            <Typography variant="body2">
                              {typeof strength === 'object' ? (strength.message || strength.category || JSON.stringify(strength)) : String(strength)}
                            </Typography>
                          </li>
                        ))
                      ) : (
                        <li>
                          <Typography variant="body2" color="text.secondary" fontStyle="italic">
                            {typeof interpretation.strengths === 'string' ? interpretation.strengths : 'No specific strengths identified.'}
                          </Typography>
                        </li>
                      )}
                    </Box>
                  </Box>
                )}

                {interpretation.weaknesses && 
                 ((Array.isArray(interpretation.weaknesses) && interpretation.weaknesses.length > 0) || 
                  (typeof interpretation.weaknesses === 'string' && interpretation.weaknesses.trim() !== '')) && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" color="error.main" gutterBottom>
                      Areas for Improvement
                    </Typography>
                    <Box component="ul" sx={{ pl: 2 }}>
                      {Array.isArray(interpretation.weaknesses) && interpretation.weaknesses.length > 0 ? (
                        interpretation.weaknesses.map((weakness, index) => (
                          <li key={index}>
                            <Typography variant="body2">
                              {typeof weakness === 'object' ? (weakness.message || weakness.category || JSON.stringify(weakness)) : String(weakness)}
                            </Typography>
                          </li>
                        ))
                      ) : (
                        <li>
                          <Typography variant="body2" color="text.secondary" fontStyle="italic">
                            {typeof interpretation.weaknesses === 'string' ? interpretation.weaknesses : 'No specific areas for improvement identified.'}
                          </Typography>
                        </li>
                      )}
                    </Box>
                  </Box>
                )}

                {interpretation.recommendations && 
                 ((Array.isArray(interpretation.recommendations) && interpretation.recommendations.length > 0) || 
                  (typeof interpretation.recommendations === 'string' && interpretation.recommendations.trim() !== '')) && (
                  <Box>
                    <Typography variant="h6" color="primary.main" gutterBottom>
                      Recommendations
                    </Typography>
                    <Box component="ul" sx={{ pl: 2 }}>
                      {Array.isArray(interpretation.recommendations) && interpretation.recommendations.length > 0 ? (
                        interpretation.recommendations.map((rec, index) => (
                          <li key={index}>
                            <Typography variant="body2">
                              {typeof rec === 'object' ? (rec.suggestion || rec.category || JSON.stringify(rec)) : String(rec)}
                            </Typography>
                          </li>
                        ))
                      ) : (
                        <li>
                          <Typography variant="body2" color="text.secondary" fontStyle="italic">
                            {typeof interpretation.recommendations === 'string' ? interpretation.recommendations : 'No specific recommendations at this time.'}
                          </Typography>
                        </li>
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Download />}
              onClick={downloadReport}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                px: 4,
                py: 1.5
              }}
            >
              Download PDF Report
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Home />}
              onClick={() => {
                // Navigate to candidate dashboard if candidate, otherwise home
                const candidateToken = localStorage.getItem('candidate_token');
                if (candidateToken) {
                  navigate('/candidate/dashboard');
                } else {
                  navigate('/');
                }
              }}
            >
              Back to Dashboard
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default TestComplete;
