import React, { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  TextField
} from '@mui/material';
import {
  Download,
  Visibility,
  Assessment,
  TrendingUp
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';

const Reports = () => {
  const [tests, setTests] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' or 'kpi'
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadTests(), loadCandidates()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const loadTests = async () => {
    try {
      const response = await api.get('/tests');
      if (response.success) {
        setTests(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load tests');
      console.error('Load tests error:', error);
    }
  };

  const loadCandidates = async () => {
    try {
      const response = await api.get('/candidates');
      if (response.success) {
        setCandidates(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load candidates:', error);
      // Don't show toast for candidates - it's not critical for the page
    }
  };

  const downloadReport = async (attemptId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/attempt/${attemptId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
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
        Reports & Analytics
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View test results, generate reports, and analyze candidate performance.
      </Typography>

      {/* Tabs for Test Reports and KPI Reports */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<Assessment />} 
            iconPosition="start"
            label="Test Reports" 
            value="tests" 
          />
          <Tab 
            icon={<TrendingUp />} 
            iconPosition="start"
            label="KPI Performance Reports" 
            value="kpi" 
          />
        </Tabs>
      </Paper>

      {activeTab === 'tests' && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Total Tests
                  </Typography>
                  <Typography variant="h3" color="primary">
                    {tests.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Active Tests
                  </Typography>
                  <Typography variant="h3" color="success.main">
                    {tests.filter(t => t.status === 'active').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Draft Tests
                  </Typography>
                  <Typography variant="h3" color="warning.main">
                    {tests.filter(t => t.status === 'draft').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Test Title</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Questions</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>{test.title}</TableCell>
                      <TableCell>
                        <Chip
                          label={test.status}
                          color={
                            test.status === 'active' ? 'success' :
                            test.status === 'draft' ? 'default' : 'secondary'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{test.question_count || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => navigate(`/dashboard/reports/test/${test.id}`)}
                          variant="contained"
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          }}
                        >
                          View Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {activeTab === 'kpi' && (
        <KPIPerformanceReports candidates={candidates} navigate={navigate} />
      )}
    </Box>
  );
};

// KPI Performance Reports Component
const KPIPerformanceReports = ({ candidates, navigate }) => {
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [kpiPerformance, setKpiPerformance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const loadKPIPerformance = async () => {
    if (!selectedCandidate) {
      setKpiPerformance([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(
        `/kpis/performance/candidate/${selectedCandidate}?period_start=${selectedPeriod.start}&period_end=${selectedPeriod.end}`
      );
      
      console.log('KPI Performance Response:', response);
      
      if (response && response.success) {
        setKpiPerformance(response.data || []);
      } else {
        // Handle case where response doesn't have success property
        if (Array.isArray(response)) {
          setKpiPerformance(response);
        } else if (response?.data) {
          setKpiPerformance(Array.isArray(response.data) ? response.data : []);
        } else {
          setKpiPerformance([]);
        }
        
        if (response?.message && !response.message.toLowerCase().includes('not found')) {
          toast.error(response.message);
        }
      }
    } catch (error) {
      console.error('Load KPI performance error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load KPI performance';
      
      // Don't show error toast for 404 or "not found" - just show empty state
      if (!errorMessage.includes('404') && !errorMessage.toLowerCase().includes('not found')) {
        toast.error(errorMessage);
      }
      setKpiPerformance([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKPIPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidate, selectedPeriod.start, selectedPeriod.end]);

  const getRatingColor = (rating) => {
    switch (rating) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'satisfactory': return 'warning';
      case 'needs_improvement': return 'error';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          KPI Performance Reports
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          View KPI performance data for candidates. Select a candidate to see their KPI performance reports.
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              label="Select Candidate"
              fullWidth
              value={selectedCandidate}
              onChange={(e) => setSelectedCandidate(e.target.value)}
              SelectProps={{
                native: true
              }}
            >
              <option value="">-- Select Candidate --</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.first_name || candidate.last_name
                    ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
                    : candidate.email}
                </option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              value={selectedPeriod.start}
              onChange={(e) => setSelectedPeriod({ ...selectedPeriod, start: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              value={selectedPeriod.end}
              onChange={(e) => setSelectedPeriod({ ...selectedPeriod, end: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>

        {selectedCandidate && (
          <Button
            variant="outlined"
            startIcon={<TrendingUp />}
            onClick={() => navigate(`/dashboard/kra-dashboard/candidate/${selectedCandidate}`)}
            sx={{ mt: 1 }}
          >
            View Full KRA/KPI Dashboard
          </Button>
        )}
      </Paper>

      {selectedCandidate && loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : selectedCandidate ? (
        <Paper>
          {kpiPerformance.length === 0 ? (
            <Box p={4} textAlign="center">
              <Typography variant="body1" color="text.secondary">
                No KPI performance data found for this candidate in the selected period.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Make sure KRAs are assigned to the candidate and KPIs have performance data.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>KPI</strong></TableCell>
                    <TableCell><strong>KRA</strong></TableCell>
                    <TableCell><strong>Target</strong></TableCell>
                    <TableCell><strong>Actual</strong></TableCell>
                    <TableCell><strong>Achievement</strong></TableCell>
                    <TableCell><strong>Rating</strong></TableCell>
                    <TableCell><strong>Period</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpiPerformance.map((perf) => (
                    <TableRow key={perf.id}>
                      <TableCell>{perf.kpi_title}</TableCell>
                      <TableCell>{perf.kra_title}</TableCell>
                      <TableCell>{perf.kpi_target || perf.target_value} {perf.unit || ''}</TableCell>
                      <TableCell>{perf.actual_value} {perf.unit || ''}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${perf.achievement_percentage?.toFixed(1)}%`}
                          color={perf.achievement_percentage >= 100 ? 'success' : perf.achievement_percentage >= 75 ? 'warning' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {perf.rating && (
                          <Chip
                            label={perf.rating}
                            color={getRatingColor(perf.rating)}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {perf.period_start && perf.period_end
                          ? `${new Date(perf.period_start).toLocaleDateString()} - ${new Date(perf.period_end).toLocaleDateString()}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={perf.status}
                          color={perf.status === 'approved' ? 'success' : perf.status === 'rejected' ? 'error' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Box textAlign="center">
            <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Select a candidate to view KPI performance reports
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default Reports;

