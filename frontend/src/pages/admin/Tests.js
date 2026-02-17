import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  CircularProgress,
  Typography
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  PlayArrow,
  Assignment
} from '@mui/icons-material';
import {
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const Tests = () => {
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [testQuestions, setTestQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [assigningTest, setAssigningTest] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [editingTest, setEditingTest] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    duration_minutes: 30,
    passing_score: 60,
    max_attempts: 1,
    negative_marking: false,
    negative_mark_percentage: 0,
    enable_percentile: true,
    enable_ai_interpretation: true,
    enable_benchmark: true,
    enable_shortlist: true,
    status: 'draft'
  });

  useEffect(() => {
    loadTests();
    loadQuestions();
  }, []);

  const loadTests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tests');
      if (response.success) {
        setTests(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const response = await api.get('/questions');
      if (response.success) {
        setQuestions(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
  };

  const loadTestQuestions = async (testId) => {
    try {
      const response = await api.get(`/tests/${testId}`);
      if (response.success && response.data.questions) {
        setTestQuestions(response.data.questions.map(q => q.id));
      }
    } catch (error) {
      console.error('Failed to load test questions:', error);
    }
  };

  const handleOpenDialog = (test = null) => {
    if (test) {
      setEditingTest(test);
      setFormData({
        title: test.title || '',
        description: test.description || '',
        instructions: test.instructions || '',
        duration_minutes: test.duration_minutes || 30,
        passing_score: test.passing_score || 60,
        max_attempts: test.max_attempts || 1,
        negative_marking: test.negative_marking || false,
        negative_mark_percentage: test.negative_mark_percentage || 0,
        enable_percentile: test.enable_percentile !== false,
        enable_ai_interpretation: test.enable_ai_interpretation !== false,
        enable_benchmark: test.enable_benchmark !== false,
        enable_shortlist: test.enable_shortlist !== false,
        status: test.status || 'draft'
      });
    } else {
      setEditingTest(null);
      setFormData({
        title: '',
        description: '',
        instructions: '',
        duration_minutes: 30,
        passing_score: 60,
        max_attempts: 1,
        negative_marking: false,
        negative_mark_percentage: 0,
        enable_percentile: true,
        enable_ai_interpretation: true,
        enable_benchmark: true,
        enable_shortlist: true,
        status: 'draft'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTest(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingTest) {
        const response = await api.put(`/tests/${editingTest.id}`, formData);
        if (response.success) {
          toast.success('Test updated successfully');
          handleCloseDialog();
          loadTests();
        } else {
          toast.error(response.message || 'Failed to update test');
        }
      } else {
        const response = await api.post('/tests', formData);
        if (response.success) {
          toast.success('Test created successfully');
          handleCloseDialog();
          loadTests();
        } else {
          toast.error(response.message || 'Failed to create test');
        }
      }
    } catch (error) {
      // Check if it's an authentication error
      if (error.message && error.message.includes('401')) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error(error.message || 'Failed to save test');
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await api.delete(`/tests/${id}`);
        toast.success('Test deleted successfully');
        loadTests();
      } catch (error) {
        toast.error('Failed to delete test');
      }
    }
  };

  const handleAssignQuestionsClick = async (test) => {
    setAssigningTest(test);
    await loadTestQuestions(test.id);
    setSelectedQuestions([]);
    setOpenAssignDialog(true);
  };

  const handleAssignQuestionsClose = () => {
    setOpenAssignDialog(false);
    setAssigningTest(null);
    setSelectedQuestions([]);
    setTestQuestions([]);
  };

  const handleAssignQuestionsSubmit = async () => {
    if (!assigningTest || selectedQuestions.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    try {
      const response = await api.post('/questions/test/add', {
        test_id: assigningTest.id,
        question_ids: selectedQuestions
      });

      if (response.success) {
        if (response.data.added > 0) {
          toast.success(`${response.data.added} question(s) added successfully`);
        }
        if (response.data.skipped > 0) {
          toast.warning(`${response.data.skipped} question(s) were already assigned`);
        }
        handleAssignQuestionsClose();
        loadTests();
        if (assigningTest) {
          await loadTestQuestions(assigningTest.id);
        }
      } else {
        toast.error(response.message || 'Failed to assign questions');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to assign questions');
    }
  };

  const handleRemoveQuestion = async (testId, questionId) => {
    if (window.confirm('Are you sure you want to remove this question from the test?')) {
      try {
        await api.delete(`/questions/test/${testId}/${questionId}`);
        toast.success('Question removed from test');
        loadTests();
        if (assigningTest && assigningTest.id === testId) {
          await loadTestQuestions(testId);
        }
      } catch (error) {
        toast.error('Failed to remove question');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'default';
      case 'archived': return 'secondary';
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Test Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          Create Test
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Duration</strong></TableCell>
              <TableCell><strong>Max Attempts</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Questions</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tests.map((test) => (
              <TableRow key={test.id}>
                <TableCell>{test.title}</TableCell>
                <TableCell>{test.duration_minutes} min</TableCell>
                <TableCell>{test.max_attempts}</TableCell>
                <TableCell>
                  <Chip
                    label={test.status}
                    color={getStatusColor(test.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{test.question_count || 0}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpenDialog(test)} title="Edit">
                    <Edit />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleAssignQuestionsClick(test)} 
                    color="secondary"
                    title="Assign Questions"
                  >
                    <Assignment />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(test.id)} color="error" title="Delete">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingTest ? 'Edit Test' : 'Create New Test'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Title"
              fullWidth
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              label="Instructions"
              fullWidth
              multiline
              rows={3}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Duration (minutes)"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              />
              <TextField
                label="Passing Score (%)"
                type="number"
                value={formData.passing_score}
                onChange={(e) => setFormData({ ...formData, passing_score: parseFloat(e.target.value) })}
              />
              <TextField
                label="Max Attempts"
                type="number"
                value={formData.max_attempts}
                onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
              />
            </Box>
            <TextField
              select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.negative_marking}
                  onChange={(e) => setFormData({ ...formData, negative_marking: e.target.checked })}
                />
              }
              label="Enable Negative Marking"
            />
            {formData.negative_marking && (
              <TextField
                label="Negative Mark Percentage"
                type="number"
                value={formData.negative_mark_percentage}
                onChange={(e) => setFormData({ ...formData, negative_mark_percentage: parseFloat(e.target.value) })}
              />
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable_percentile}
                  onChange={(e) => setFormData({ ...formData, enable_percentile: e.target.checked })}
                />
              }
              label="Enable Percentile Calculation"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable_ai_interpretation}
                  onChange={(e) => setFormData({ ...formData, enable_ai_interpretation: e.target.checked })}
                />
              }
              label="Enable AI Interpretation"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable_benchmark}
                  onChange={(e) => setFormData({ ...formData, enable_benchmark: e.target.checked })}
                />
              }
              label="Enable Benchmark Comparison"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enable_shortlist}
                  onChange={(e) => setFormData({ ...formData, enable_shortlist: e.target.checked })}
                />
              }
              label="Enable Shortlist Recommendation"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTest ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Questions Dialog */}
      <Dialog open={openAssignDialog} onClose={handleAssignQuestionsClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Assign Questions to Test: {assigningTest?.title}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Select questions to add to this test. Questions already assigned are shown in the list below.
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Select Questions</InputLabel>
              <Select
                multiple
                value={selectedQuestions}
                onChange={(e) => setSelectedQuestions(e.target.value)}
                input={<OutlinedInput label="Select Questions" />}
                renderValue={(selected) => `${selected.length} question(s) selected`}
              >
                {questions
                  .filter(q => !testQuestions.includes(q.id))
                  .map((question) => (
                    <MenuItem key={question.id} value={question.id}>
                      <Checkbox checked={selectedQuestions.indexOf(question.id) > -1} />
                      <ListItemText 
                        primary={question.question_text?.substring(0, 60) + (question.question_text?.length > 60 ? '...' : '')}
                        secondary={`Type: ${question.question_type} | Points: ${question.points}`}
                      />
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {testQuestions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Currently Assigned Questions ({testQuestions.length}):
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
                  {questions
                    .filter(q => testQuestions.includes(q.id))
                    .map((question) => (
                      <Box 
                        key={question.id} 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          py: 1,
                          borderBottom: '1px solid #eee'
                        }}
                      >
                        <Typography variant="body2">
                          {question.question_text?.substring(0, 50) + (question.question_text?.length > 50 ? '...' : '')}
                        </Typography>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleRemoveQuestion(assigningTest.id, question.id)}
                          title="Remove from test"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAssignQuestionsClose}>Cancel</Button>
          <Button 
            onClick={handleAssignQuestionsSubmit} 
            variant="contained" 
            disabled={selectedQuestions.length === 0}
          >
            Add Selected Questions
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Tests;

