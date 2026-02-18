import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Download,
  Visibility,
  ArrowBack,
  Search,
  TrendingUp,
  Person,
  Assessment
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const TestResults = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [scores, setScores] = useState([]);
  const [test, setTest] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [testId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load test details
      const testResponse = await api.get(`/tests/${testId}`);
      if (testResponse.success) {
        setTest(testResponse.data);
      }

      // Load scores
      const scoresResponse = await api.get(`/scores/test/${testId}`);
      if (scoresResponse.success) {
        setScores(scoresResponse.data || []);
      }

      // Load statistics
      try {
        const statsResponse = await api.get(`/scores/test/${testId}/statistics`);
        if (statsResponse.success) {
          setStatistics(statsResponse.data);
        }
      } catch (error) {
        console.error('Failed to load statistics:', error);
        // Statistics might not be available, continue without them
      }
    } catch (error) {
      toast.error('Failed to load test results');
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (attemptId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/attempt/${attemptId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
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

  const viewCandidateDetails = async (score) => {
    try {
      // Load attempt details
      const attemptResponse = await api.get(`/attempts/${score.attempt_id}`);
      if (attemptResponse.success) {
        setSelectedCandidate({
          ...score,
          attempt: attemptResponse.data
        });
        setViewDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load candidate details');
    }
  };

  const filteredScores = scores.filter(score => {
    const searchLower = searchTerm.toLowerCase();
    const name = `${score.first_name || ''} ${score.last_name || ''}`.toLowerCase();
    const email = (score.email || '').toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower);
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/dashboard/reports')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">
          Test Results: {test?.title || 'Loading...'}
        </Typography>
      </Box>

      {/* Statistics Cards */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Person sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Attempts
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {statistics.total_attempts || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average Score
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {statistics.average_score ? `${parseFloat(statistics.average_score).toFixed(1)}%` : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Assessment sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Passed
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {statistics.passed_count || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <TrendingUp sx={{ fontSize: 40, color: 'info.main' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Max Score
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {statistics.max_score ? `${parseFloat(statistics.max_score).toFixed(1)}%` : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by candidate name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Overall Performance Spider Chart */}
      {scores.length > 0 && (() => {
        // Calculate average scores per category across all candidates
        const categoryAverages = {};
        let candidateCount = 0;

        scores.forEach(score => {
          if (score.category_scores && typeof score.category_scores === 'object') {
            candidateCount++;
            Object.values(score.category_scores).forEach(cat => {
              if (!categoryAverages[cat.category_name]) {
                categoryAverages[cat.category_name] = { total: 0, count: 0 };
              }
              categoryAverages[cat.category_name].total += parseFloat(cat.percentage || 0);
              categoryAverages[cat.category_name].count++;
            });
          }
        });

        const radarData = Object.entries(categoryAverages).map(([name, data]) => ({
          category: name,
          average: candidateCount > 0 ? (data.total / candidateCount) : 0,
          fullMark: 100
        }));

        if (radarData.length > 0) {
          return (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                Overall Performance - Category Averages
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Average performance across all candidates by category
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis 
                    dataKey="category" 
                    tick={{ fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10 }}
                  />
                  <Radar
                    name="Average Performance"
                    dataKey="average"
                    stroke="#667eea"
                    fill="#667eea"
                    fillOpacity={0.6}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value.toFixed(2)}%`, 'Average Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>
          );
        }
        return null;
      })()}

      {/* Results Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Rank</strong></TableCell>
                <TableCell><strong>Candidate Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Score</strong></TableCell>
                <TableCell><strong>Percentage</strong></TableCell>
                <TableCell><strong>Percentile</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Submitted</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredScores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      {searchTerm ? 'No candidates found matching your search' : 'No test results available yet'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredScores.map((score, index) => (
                  <TableRow key={score.id} hover>
                    <TableCell>
                      <Chip
                        label={`#${index + 1}`}
                        size="small"
                        color={index === 0 ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {score.first_name || score.last_name
                        ? `${score.first_name || ''} ${score.last_name || ''}`.trim()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{score.email}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {score.total_score} / {score.max_score}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${score.percentage_score}%`}
                        color={
                          score.percentage_score >= 80 ? 'success' :
                          score.percentage_score >= 60 ? 'warning' : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {score.percentile ? `${score.percentile}%` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={score.passed ? 'Passed' : 'Failed'}
                        color={score.passed ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {score.submitted_at
                        ? new Date(score.submitted_at).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => viewCandidateDetails(score)}
                        color="primary"
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/dashboard/reports/hr-detailed/${score.attempt_id}`)}
                        color="info"
                        title="View HR Detailed Report"
                      >
                        <Assessment />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => downloadReport(score.attempt_id)}
                        color="secondary"
                        title="Download Report"
                      >
                        <Download />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Candidate Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Candidate Details: {selectedCandidate?.first_name} {selectedCandidate?.last_name}
        </DialogTitle>
        <DialogContent>
          {selectedCandidate && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">{selectedCandidate.email}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Score
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedCandidate.total_score} / {selectedCandidate.max_score} ({selectedCandidate.percentage_score}%)
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={selectedCandidate.passed ? 'Passed' : 'Failed'}
                    color={selectedCandidate.passed ? 'success' : 'error'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Percentile
                  </Typography>
                  <Typography variant="body1">
                    {selectedCandidate.percentile ? `${selectedCandidate.percentile}%` : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              {/* Category Scores */}
              {selectedCandidate.category_scores && Object.keys(selectedCandidate.category_scores).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Category Breakdown
                  </Typography>
                  <Grid container spacing={2}>
                    {Object.values(selectedCandidate.category_scores).map((category, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {category.category_name}
                            </Typography>
                            <Typography variant="h5" color="primary">
                              {category.percentage}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {category.correct_count} / {category.total_count} correct
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Spider Chart - Performance Visualization */}
              {selectedCandidate.category_scores && Object.keys(selectedCandidate.category_scores).length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Performance Spider Chart
                  </Typography>
                  <Paper sx={{ p: 2, mt: 2 }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart
                        data={Object.values(selectedCandidate.category_scores).map(cat => ({
                          category: cat.category_name,
                          score: parseFloat(cat.percentage || 0),
                          fullMark: 100
                        }))}
                      >
                        <PolarGrid />
                        <PolarAngleAxis 
                          dataKey="category" 
                          tick={{ fontSize: 12 }}
                        />
                        <PolarRadiusAxis 
                          angle={90} 
                          domain={[0, 100]} 
                          tick={{ fontSize: 10 }}
                        />
                        <Radar
                          name="Performance"
                          dataKey="score"
                          stroke="#667eea"
                          fill="#667eea"
                          fillOpacity={0.6}
                        />
                        <Tooltip 
                          formatter={(value) => [`${value.toFixed(2)}%`, 'Score']}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedCandidate && (
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => downloadReport(selectedCandidate.attempt_id)}
            >
              Download Report
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TestResults;

