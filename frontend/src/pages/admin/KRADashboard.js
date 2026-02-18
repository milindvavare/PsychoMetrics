import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Cancel,
  Warning,
  Download
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const KRADashboard = () => {
  const { employeeType, employeeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [employeeKRAs, setEmployeeKRAs] = useState([]);
  const [kpiPerformance, setKpiPerformance] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [performanceData, setPerformanceData] = useState({
    actual_value: '',
    comments: '',
    evidence_url: ''
  });

  useEffect(() => {
    if (employeeType && employeeId) {
      loadData();
    }
  }, [employeeType, employeeId, selectedPeriod]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employee KRAs
      const krasResponse = await api.get(`/kras/employee/${employeeType}/${employeeId}`);
      if (krasResponse.success) {
        setEmployeeKRAs(krasResponse.data || []);
      }

      // Load KPI Performance
      const kpiResponse = await api.get(
        `/kpis/performance/${employeeType}/${employeeId}?period_start=${selectedPeriod.start}&period_end=${selectedPeriod.end}`
      );
      if (kpiResponse.success) {
        setKpiPerformance(kpiResponse.data || []);
      }
    } catch (error) {
      toast.error('Failed to load KRA/KPI data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPerformance = async () => {
    if (!selectedKPI) return;

    try {
      const response = await api.post('/kpis/performance', {
        employee_type: employeeType,
        employee_id: parseInt(employeeId),
        kpi_id: selectedKPI.kpi_id,
        kra_id: selectedKPI.kra_id,
        period_start: selectedPeriod.start,
        period_end: selectedPeriod.end,
        actual_value: parseFloat(performanceData.actual_value),
        comments: performanceData.comments,
        evidence_url: performanceData.evidence_url
      });

      if (response.success) {
        toast.success('KPI performance submitted successfully');
        setSubmitDialogOpen(false);
        setSelectedKPI(null);
        setPerformanceData({ actual_value: '', comments: '', evidence_url: '' });
        loadData();
      } else {
        toast.error(response.message || 'Failed to submit performance');
      }
    } catch (error) {
      toast.error('Failed to submit performance');
    }
  };

  const openSubmitDialog = (kpi) => {
    setSelectedKPI(kpi);
    setPerformanceData({
      actual_value: '',
      comments: '',
      evidence_url: ''
    });
    setSubmitDialogOpen(true);
  };

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Prepare chart data
  const performanceChartData = kpiPerformance.map(p => ({
    name: p.kpi_title,
    target: p.kpi_target || p.target_value,
    actual: p.actual_value,
    achievement: p.achievement_percentage
  }));

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          KRA & KPI Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Start Date"
            type="date"
            value={selectedPeriod.start}
            onChange={(e) => setSelectedPeriod({ ...selectedPeriod, start: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End Date"
            type="date"
            value={selectedPeriod.end}
            onChange={(e) => setSelectedPeriod({ ...selectedPeriod, end: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total KRAs</Typography>
              <Typography variant="h4">{employeeKRAs.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">KPIs Tracked</Typography>
              <Typography variant="h4">{kpiPerformance.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Average Achievement</Typography>
              <Typography variant="h4">
                {kpiPerformance.length > 0
                  ? (kpiPerformance.reduce((sum, p) => sum + (p.achievement_percentage || 0), 0) / kpiPerformance.length).toFixed(1)
                  : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip
                label={kpiPerformance.filter(p => p.status === 'approved').length > 0 ? 'Active' : 'Pending'}
                color="success"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* KRA List */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>Assigned KRAs</Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>KRA Title</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell><strong>Weight</strong></TableCell>
                <TableCell><strong>Start Date</strong></TableCell>
                <TableCell><strong>End Date</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employeeKRAs.map((kra) => (
                <TableRow key={kra.id}>
                  <TableCell>{kra.title}</TableCell>
                  <TableCell>{kra.category || 'N/A'}</TableCell>
                  <TableCell>{kra.weight}</TableCell>
                  <TableCell>{kra.start_date ? new Date(kra.start_date).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>{kra.end_date ? new Date(kra.end_date).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={kra.status}
                      color={kra.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* KPI Performance */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>KPI Performance</Typography>
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
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {kpiPerformance.map((perf) => (
                <TableRow key={perf.id}>
                  <TableCell>{perf.kpi_title}</TableCell>
                  <TableCell>{perf.kra_title}</TableCell>
                  <TableCell>{perf.target_value} {perf.unit || ''}</TableCell>
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
                    <Chip
                      label={perf.status}
                      color={perf.status === 'approved' ? 'success' : perf.status === 'rejected' ? 'error' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {perf.status === 'draft' && (
                      <Button size="small" onClick={() => openSubmitDialog(perf)}>
                        Submit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Performance Chart */}
      {performanceChartData.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Performance Overview</Typography>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={performanceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="target" fill="#8884d8" name="Target" />
              <Bar dataKey="actual" fill="#82ca9d" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Submit Performance Dialog */}
      <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit KPI Performance</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              KPI: {selectedKPI?.kpi_title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Target: {selectedKPI?.target_value} {selectedKPI?.unit || ''}
            </Typography>
            <TextField
              label="Actual Value"
              type="number"
              fullWidth
              value={performanceData.actual_value}
              onChange={(e) => setPerformanceData({ ...performanceData, actual_value: e.target.value })}
              required
            />
            <TextField
              label="Comments"
              fullWidth
              multiline
              rows={3}
              value={performanceData.comments}
              onChange={(e) => setPerformanceData({ ...performanceData, comments: e.target.value })}
            />
            <TextField
              label="Evidence URL (Optional)"
              fullWidth
              value={performanceData.evidence_url}
              onChange={(e) => setPerformanceData({ ...performanceData, evidence_url: e.target.value })}
              placeholder="Link to supporting documents"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitPerformance} variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KRADashboard;

