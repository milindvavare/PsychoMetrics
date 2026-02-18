import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Download,
  ArrowBack,
  CheckCircle,
  Cancel,
  Warning,
  TrendingUp,
  TrendingDown
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

const HRDetailedReport = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  useEffect(() => {
    loadReport();
  }, [attemptId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/reports/hr-detailed/${attemptId}`);
      console.log('HR Detailed Report Response:', response);
      
      if (response && response.success) {
        setReport(response.data);
      } else {
        const errorMsg = response?.message || response?.error || 'Failed to load report';
        toast.error(errorMsg);
        console.error('Report load error:', response);
      }
    } catch (error) {
      console.error('Load report error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to load report';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/attempt/${attemptId}/pdf?report_type=detailed`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `HR-Report-${attemptId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case 'strong_hire': return 'success';
      case 'consider': return 'warning';
      case 'not_recommended': return 'error';
      case 'reject': return 'error';
      default: return 'default';
    }
  };

  const getRecommendationLabel = (recommendation) => {
    switch (recommendation) {
      case 'strong_hire': return 'Strong Hire';
      case 'consider': return 'Consider';
      case 'not_recommended': return 'Not Recommended';
      case 'reject': return 'Reject';
      default: return recommendation;
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
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

  if (!report) {
    return (
      <Box p={3}>
        <Alert severity="error">Report not found</Alert>
      </Box>
    );
  }

  // Prepare chart data
  const categoryChartData = Object.values(report.category_scores || {}).map(cat => ({
    name: cat.category_name,
    score: cat.percentage || 0
  }));

  const radarData = Object.values(report.category_scores || {}).map(cat => ({
    category: cat.category_name,
    score: cat.percentage || 0,
    fullMark: 100
  }));

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            HR Detailed Report
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {report.company_name || 'Nirmatra Training Solutions'}
          </Typography>
        </Box>
        <Box>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={downloadPDF}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      {/* Section 1: Candidate Overview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 1: Candidate Overview
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography><strong>Candidate Name:</strong> {report.candidate_name}</Typography>
            <Typography><strong>Test Name:</strong> {report.test_name}</Typography>
            <Typography><strong>Date:</strong> {new Date(report.test_date).toLocaleDateString()}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography><strong>Duration Taken:</strong> {Math.floor((report.duration_taken_seconds || 0) / 60)} minutes</Typography>
            <Typography><strong>Attempt Number:</strong> {report.attempt_number}</Typography>
            <Typography><strong>Violation Score:</strong> 
              <Chip 
                label={report.violation_score} 
                color={report.violation_score === 0 ? 'success' : report.violation_score >= 20 ? 'error' : 'warning'}
                size="small"
                sx={{ ml: 1 }}
              />
            </Typography>
            <Typography><strong>Percentile Rank:</strong> {report.percentile_rank?.toFixed(2)}%</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 2: Overall Performance */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 2: Overall Performance
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Total Score</Typography>
                <Typography variant="h3" color="primary">
                  {report.total_score?.toFixed(2)} / {Object.values(report.category_scores || {}).reduce((sum, cat) => sum + (cat.max_score || 0), 0).toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Percentage: {((report.total_score / Object.values(report.category_scores || {}).reduce((sum, cat) => sum + (cat.max_score || 0), 0)) * 100).toFixed(2)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Percentile Ranking</Typography>
                <Typography variant="h3" color="secondary">
                  {report.percentile_ranking?.toFixed(2)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Better than {report.percentile_ranking?.toFixed(0)}% of candidates
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Pass / Fail Status</Typography>
                <Box display="flex" alignItems="center" mt={1}>
                  {report.pass_fail_status === 'pass' ? (
                    <CheckCircle color="success" sx={{ fontSize: 40, mr: 1 }} />
                  ) : (
                    <Cancel color="error" sx={{ fontSize: 40, mr: 1 }} />
                  )}
                  <Typography variant="h4">
                    {report.pass_fail_status === 'pass' ? 'PASSED' : 'FAILED'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Company Average Comparison */}
        {report.company_average_comparison && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Company Average Comparison</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Candidate Score</Typography>
                    <Typography variant="h5">{report.company_average_comparison.candidate_score?.toFixed(2)}%</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Company Average</Typography>
                    <Typography variant="h5">{report.company_average_comparison.company_average?.toFixed(2)}%</Typography>
                    <Box display="flex" alignItems="center" mt={1}>
                      {report.company_average_comparison.difference >= 0 ? (
                        <TrendingUp color="success" />
                      ) : (
                        <TrendingDown color="error" />
                      )}
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {report.company_average_comparison.difference >= 0 ? '+' : ''}
                        {report.company_average_comparison.difference?.toFixed(2)}%
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Hiring Recommendation */}
        <Box mt={3} p={2} bgcolor="background.default" borderRadius={1}>
          <Typography variant="h6" gutterBottom>Hiring Recommendation</Typography>
          <Chip
            label={getRecommendationLabel(report.hiring_recommendation)}
            color={getRecommendationColor(report.hiring_recommendation)}
            sx={{ mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {report.recommendation_reason}
          </Typography>
        </Box>
      </Paper>

      {/* Section 3: Category-wise Analysis */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 3: Category-wise Analysis
        </Typography>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell align="right"><strong>Score</strong></TableCell>
                <TableCell align="right"><strong>Percentage</strong></TableCell>
                <TableCell align="center"><strong>Strength Level</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.values(report.category_scores || {}).map((category, index) => {
                const strengthLevel = report.trait_details?.[category.category_name]?.strengthLevel || 'Moderate';
                const getStrengthColor = (level) => {
                  if (level === 'Excellent') return 'success';
                  if (level === 'Strong') return 'info';
                  if (level === 'Moderate') return 'warning';
                  return 'default';
                };
                return (
                  <TableRow key={index}>
                    <TableCell>{category.category_name}</TableCell>
                    <TableCell align="right">{category.score?.toFixed(2)} / {category.max_score?.toFixed(2)}</TableCell>
                    <TableCell align="right">{category.percentage?.toFixed(2)}%</TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={strengthLevel} 
                        color={getStrengthColor(strengthLevel)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Charts */}
        <Grid container spacing={3} mt={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Bar Chart</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="#667eea" />
              </BarChart>
            </ResponsiveContainer>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Radar Chart</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Score" dataKey="score" stroke="#667eea" fill="#667eea" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Grid>
        </Grid>

        {/* Category Ranking */}
        {report.category_ranking && report.category_ranking.length > 0 && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Category Ranking</Typography>
            <List>
              {report.category_ranking.map((item, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${item.rank}. ${item.category}`}
                    secondary={`Score: ${item.score?.toFixed(2)}%`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>

      {/* Section 4: Trait Interpretation */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 4: Trait Interpretation
        </Typography>
        {report.trait_details && Object.entries(report.trait_details).map(([category, details]) => (
          <Box key={category} mb={2} p={2} bgcolor="background.default" borderRadius={1}>
            <Typography variant="h6">{category}</Typography>
            <Chip 
              label={details.strengthLevel} 
              color={details.strengthLevel === 'Excellent' ? 'success' : details.strengthLevel === 'Strong' ? 'info' : 'warning'}
              size="small"
              sx={{ mb: 1 }}
            />
            <Typography variant="body2">{details.interpretation}</Typography>
          </Box>
        ))}
      </Paper>

      {/* Section 5: Behavioral Risk Indicators */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 5: Behavioral Risk Indicators
        </Typography>
        {report.behavioral_risks && report.behavioral_risks.length > 0 ? (
          report.behavioral_risks.map((risk, index) => (
            <Alert 
              key={index}
              severity={risk.level === 'high' ? 'error' : risk.level === 'medium' ? 'warning' : 'info'}
              icon={<Warning />}
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2"><strong>{risk.type}</strong></Typography>
              <Typography variant="body2">{risk.description}</Typography>
            </Alert>
          ))
        ) : (
          <Alert severity="success">No significant behavioral risks detected.</Alert>
        )}
      </Paper>

      {/* Section 6: Work Environment Fit */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 6: Work Environment Fit
        </Typography>
        <Grid container spacing={2}>
          {report.work_environment_fit && report.work_environment_fit.map((fit, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6">{fit.environment}</Typography>
                  <Chip 
                    label={fit.suitability} 
                    color={fit.suitability === 'High' ? 'success' : 'default'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {fit.reason}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Section 7: Role Suitability */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 7: Role Suitability
        </Typography>
        <Grid container spacing={2}>
          {report.role_suitability && report.role_suitability.map((role, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{role.role}</Typography>
                  <Typography variant="h4" color="primary">{role.score?.toFixed(0)}%</Typography>
                  <Chip 
                    label={role.suitability} 
                    color={role.suitability === 'High' ? 'success' : 'default'}
                    size="small"
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Section 8: Interview Guidance */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 8: Interview Guidance
        </Typography>
        {report.interview_guidance && report.interview_guidance.map((guidance, index) => (
          <Box key={index} mb={2} p={2} bgcolor="background.default" borderRadius={1}>
            <Typography variant="h6">{guidance.area}</Typography>
            <Chip 
              label={guidance.priority} 
              color={guidance.priority === 'high' ? 'error' : 'warning'}
              size="small"
              sx={{ mb: 1 }}
            />
            <Typography variant="body2">{guidance.focus}</Typography>
          </Box>
        ))}
        
        {report.suggested_questions && report.suggested_questions.length > 0 && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Suggested Interview Questions</Typography>
            <List>
              {report.suggested_questions.map((q, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={q.question}
                    secondary={`Category: ${q.category}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>

      {/* Section 9: Cheating / Integrity Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
          📌 Section 9: Cheating / Integrity Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Violations</Typography>
                <Typography variant="h4">{report.total_violations}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Tab Switch Count</Typography>
                <Typography variant="h4">{report.tab_switch_count}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">Suspicion Risk Level</Typography>
                <Chip 
                  label={report.suspicion_risk_level?.toUpperCase()} 
                  color={getRiskColor(report.suspicion_risk_level)}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Box mt={2}>
          <Typography variant="body2" color="text.secondary">
            {report.integrity_summary}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default HRDetailedReport;

