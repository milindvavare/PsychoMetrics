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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  OutlinedInput
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Remove
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const Questions = () => {
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
    const [formData, setFormData] = useState({
      category_id: '',
      question_text: '',
      question_type: 'MCQ_SINGLE',
      options: ['', '', '', ''],
      correct_answer: '',
      points: 1.0,
      negative_points: 0.0,
      difficulty: 'medium',
      explanation: ''
    });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [questionsRes, categoriesRes] = await Promise.all([
        api.get('/questions'),
        api.get('/categories')
      ]);
      if (questionsRes.success) {
        setQuestions(questionsRes.data || []);
      }
      if (categoriesRes.success) {
        setCategories(categoriesRes.data || []);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (question = null) => {
    if (question) {
      setEditingQuestion(question);
      
      // Safely parse options
      let options = question.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (e) {
          // If parsing fails, treat as array with single value
          options = [options];
        }
      }
      if (!Array.isArray(options)) {
        options = ['', '', '', ''];
      }
      
      // Safely parse correct_answer
      let correctAnswer = question.correct_answer;
      if (typeof correctAnswer === 'string') {
        try {
          // Try to parse as JSON
          correctAnswer = JSON.parse(correctAnswer);
        } catch (e) {
          // If parsing fails, it's already a string, use it as is
          correctAnswer = correctAnswer;
        }
      }
      // If it's an array, convert to string for single choice, or keep as is for multiple
      if (Array.isArray(correctAnswer)) {
        correctAnswer = (question.question_type === 'MCQ_MULTI' || question.question_type === 'RANKING')
          ? correctAnswer 
          : correctAnswer[0] || '';
      }
      
      setFormData({
        category_id: question.category_id || '',
        question_text: question.question_text || '',
        question_type: question.question_type || 'MCQ_SINGLE',
        options: options.length > 0 ? options : ['', '', '', ''],
        correct_answer: correctAnswer || '',
        points: question.points || 1.0,
        negative_points: question.negative_points || 0.0,
        difficulty: question.difficulty || 'medium',
        explanation: question.explanation || ''
      });
    } else {
      setEditingQuestion(null);
        setFormData({
          category_id: '',
          question_text: '',
          question_type: 'MCQ_SINGLE',
          options: ['', '', '', ''],
          correct_answer: '',
          points: 1.0,
          negative_points: 0.0,
          difficulty: 'medium',
          explanation: ''
        });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingQuestion(null);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleQuestionTypeChange = (newType) => {
    let newOptions = [];
    let newCorrectAnswer = '';

    switch (newType) {
      case 'MCQ_SINGLE':
        newOptions = ['', '', '', ''];
        newCorrectAnswer = '';
        break;
      case 'MCQ_MULTI':
        newOptions = ['', '', '', ''];
        newCorrectAnswer = [];
        break;
      case 'LIKERT':
        // Likert scale typically has 5 options
        newOptions = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
        newCorrectAnswer = '';
        break;
      case 'TRUE_FALSE':
        newOptions = ['True', 'False'];
        newCorrectAnswer = '';
        break;
      case 'NUMERIC':
        newOptions = []; // No options for numeric
        newCorrectAnswer = '';
        break;
      case 'SJT':
        // Situational Judgment Test - scenarios with options
        newOptions = ['', '', '', ''];
        newCorrectAnswer = '';
        break;
      case 'RANKING':
        newOptions = ['', '', '', ''];
        newCorrectAnswer = [];
        break;
      default:
        newOptions = ['', '', '', ''];
        newCorrectAnswer = '';
    }

    setFormData({
      ...formData,
      question_type: newType,
      options: newOptions,
      correct_answer: newCorrectAnswer
    });
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, '']
    });
  };

  const removeOption = (index) => {
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      options: newOptions
    });
  };

  const handleCorrectAnswerChange = (value) => {
    if (formData.question_type === 'MCQ_MULTI' || formData.question_type === 'RANKING') {
      // For multiple choice and ranking, value is an array of selected options
      // Convert indices to actual option values if needed
      const selectedValues = Array.isArray(value) ? value : [value];
      const mappedValues = selectedValues.map(val => {
        // If it's a number (index), get the actual option value
        if (typeof val === 'number') {
          return formData.options[val] || val;
        }
        // If it's already an option value, use it
        return val;
      });
      setFormData({ ...formData, correct_answer: mappedValues });
    } else {
      setFormData({ ...formData, correct_answer: value });
    }
  };

  const handleSubmit = async () => {
    try {
      // Filter out empty options (except for LIKERT and TRUE_FALSE which have fixed options)
      let filteredOptions = formData.options;
      if (formData.question_type !== 'LIKERT' && formData.question_type !== 'TRUE_FALSE') {
        filteredOptions = formData.options.filter(opt => opt.trim() !== '');
      }

      // Handle correct answer based on question type
      let correctAnswer = formData.correct_answer;
      if (formData.question_type === 'MCQ_MULTI' || formData.question_type === 'RANKING') {
        // For multiple choice and ranking, ensure it's an array
        if (!Array.isArray(correctAnswer)) {
          correctAnswer = [correctAnswer];
        }
        // Convert option indices/values to actual option values
        correctAnswer = correctAnswer.map(val => {
          if (typeof val === 'number') {
            return filteredOptions[val] || val;
          }
          return val;
        });
      } else if (formData.question_type === 'NUMERIC') {
        // For numeric, convert to number
        correctAnswer = parseFloat(correctAnswer) || 0;
      }

      const data = {
        ...formData,
        options: filteredOptions,
        correct_answer: correctAnswer
      };

      if (editingQuestion) {
        await api.put(`/questions/${editingQuestion.id}`, data);
        toast.success('Question updated successfully');
      } else {
        await api.post('/questions', data);
        toast.success('Question created successfully');
      }
      handleCloseDialog();
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to save question');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await api.delete(`/questions/${id}`);
        toast.success('Question deleted successfully');
        loadData();
      } catch (error) {
        toast.error('Failed to delete question');
      }
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
          Question Bank
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          Add Question
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Question</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Category</strong></TableCell>
              <TableCell><strong>Difficulty</strong></TableCell>
              <TableCell><strong>Points</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 400 }}>
                    {question.question_text}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={question.question_type} size="small" />
                </TableCell>
                <TableCell>{question.category_name || 'Uncategorized'}</TableCell>
                <TableCell>
                  <Chip
                    label={question.difficulty}
                    color={
                      question.difficulty === 'easy' ? 'success' :
                      question.difficulty === 'medium' ? 'warning' : 'error'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>{question.points}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpenDialog(question)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(question.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              select
              label="Category"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Question Text"
              fullWidth
              multiline
              rows={3}
              value={formData.question_text}
              onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
              required
            />
            <TextField
              select
              label="Question Type"
              value={formData.question_type}
              onChange={(e) => handleQuestionTypeChange(e.target.value)}
              fullWidth
              required
            >
              <MenuItem value="MCQ_SINGLE">MCQ Single Choice</MenuItem>
              <MenuItem value="MCQ_MULTI">MCQ Multiple Choice</MenuItem>
              <MenuItem value="LIKERT">Likert Scale</MenuItem>
              <MenuItem value="TRUE_FALSE">True/False</MenuItem>
              <MenuItem value="NUMERIC">Numeric</MenuItem>
              <MenuItem value="SJT">Situational Judgment Test (SJT)</MenuItem>
              <MenuItem value="RANKING">Ranking</MenuItem>
            </TextField>

            {/* Options Section - Show for all types except NUMERIC */}
            {formData.question_type !== 'NUMERIC' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Options:
                  </Typography>
                  {(formData.question_type === 'MCQ_SINGLE' || 
                    formData.question_type === 'MCQ_MULTI' || 
                    formData.question_type === 'SJT' || 
                    formData.question_type === 'RANKING') && (
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={addOption}
                      variant="outlined"
                    >
                      Add Option
                    </Button>
                  )}
                </Box>
                {formData.options.map((option, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      fullWidth
                      disabled={formData.question_type === 'LIKERT' || formData.question_type === 'TRUE_FALSE'}
                    />
                    {(formData.question_type === 'MCQ_SINGLE' || 
                      formData.question_type === 'MCQ_MULTI' || 
                      formData.question_type === 'SJT' || 
                      formData.question_type === 'RANKING') && 
                      formData.options.length > 2 && (
                      <IconButton
                        color="error"
                        onClick={() => removeOption(index)}
                        sx={{ mt: 1 }}
                      >
                        <Remove />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </>
            )}

            {/* Correct Answer Section */}
            {formData.question_type === 'NUMERIC' && (
              <TextField
                label="Correct Answer (Numeric)"
                type="number"
                value={formData.correct_answer}
                onChange={(e) => handleCorrectAnswerChange(e.target.value)}
                fullWidth
                helperText="Enter the correct numeric value"
              />
            )}
            {formData.question_type === 'MCQ_SINGLE' && (
              <TextField
                select
                label="Correct Answer"
                value={formData.correct_answer}
                onChange={(e) => handleCorrectAnswerChange(e.target.value)}
                fullWidth
                helperText="Select the correct option"
              >
                {formData.options.map((option, index) => (
                  <MenuItem key={index} value={option || `Option ${index + 1}`}>
                    {option || `Option ${index + 1}`}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {formData.question_type === 'MCQ_MULTI' && (
              <FormControl fullWidth>
                <InputLabel>Correct Answer(s)</InputLabel>
                <Select
                  multiple
                  value={Array.isArray(formData.correct_answer) ? formData.correct_answer : []}
                  onChange={(e) => handleCorrectAnswerChange(e.target.value)}
                  input={<OutlinedInput label="Correct Answer(s)" />}
                  renderValue={(selected) => {
                    const selectedOptions = formData.options.filter((_, index) => 
                      selected.includes(formData.options[index]) || selected.includes(index)
                    );
                    return selectedOptions.join(', ') || selected.map(i => formData.options[i] || `Option ${i + 1}`).join(', ');
                  }}
                >
                  {formData.options.map((option, index) => {
                    const optionValue = option || `Option ${index + 1}`;
                    const isSelected = Array.isArray(formData.correct_answer) && 
                      (formData.correct_answer.includes(option) || 
                       formData.correct_answer.includes(optionValue) ||
                       formData.correct_answer.includes(index));
                    return (
                      <MenuItem key={index} value={option || optionValue}>
                        <Checkbox checked={isSelected} />
                        <ListItemText primary={optionValue} />
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
            {(formData.question_type === 'LIKERT' || formData.question_type === 'TRUE_FALSE') && (
              <TextField
                select
                label="Correct Answer"
                value={formData.correct_answer}
                onChange={(e) => handleCorrectAnswerChange(e.target.value)}
                fullWidth
                helperText="Select the correct option"
              >
                {formData.options.map((option, index) => (
                  <MenuItem key={index} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {formData.question_type === 'SJT' && (
              <TextField
                select
                label="Correct Answer"
                value={formData.correct_answer}
                onChange={(e) => handleCorrectAnswerChange(e.target.value)}
                fullWidth
                helperText="Select the most appropriate response"
              >
                {formData.options.map((option, index) => (
                  <MenuItem key={index} value={option || `Option ${index + 1}`}>
                    {option || `Option ${index + 1}`}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {formData.question_type === 'RANKING' && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Correct Ranking Order (Drag or select in order):
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Rank Options</InputLabel>
                  <Select
                    multiple
                    value={Array.isArray(formData.correct_answer) ? formData.correct_answer : []}
                    onChange={(e) => handleCorrectAnswerChange(e.target.value)}
                    input={<OutlinedInput label="Rank Options" />}
                    renderValue={(selected) => {
                      return selected.map((val, idx) => {
                        const optionIndex = typeof val === 'number' ? val : formData.options.indexOf(val);
                        return `${idx + 1}. ${formData.options[optionIndex] || `Option ${optionIndex + 1}`}`;
                      }).join(', ');
                    }}
                  >
                    {formData.options.map((option, index) => {
                      const optionValue = option || `Option ${index + 1}`;
                      const isSelected = Array.isArray(formData.correct_answer) && 
                        (formData.correct_answer.includes(option) || 
                         formData.correct_answer.includes(optionValue) ||
                         formData.correct_answer.includes(index));
                      return (
                        <MenuItem key={index} value={option || optionValue}>
                          <Checkbox checked={isSelected} />
                          <ListItemText primary={optionValue} />
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Select options in the correct ranking order
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Points"
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseFloat(e.target.value) })}
              />
              <TextField
                label="Negative Points"
                type="number"
                value={formData.negative_points}
                onChange={(e) => setFormData({ ...formData, negative_points: parseFloat(e.target.value) })}
              />
              <TextField
                select
                label="Difficulty"
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              >
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </TextField>
            </Box>
            <TextField
              label="Explanation"
              fullWidth
              multiline
              rows={2}
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingQuestion ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Questions;

