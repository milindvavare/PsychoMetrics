import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Radio,
  Checkbox,
  FormControlLabel,
  Chip,
  TextField,
  RadioGroup,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';

const QuestionCard = ({ question, answer, onAnswerChange }) => {
  const [numericValue, setNumericValue] = useState(answer || '');
  const [rankingOrder, setRankingOrder] = useState(Array.isArray(answer) ? answer : []);

  // Normalize question type to handle both old and new naming conventions
  const normalizeQuestionType = (type) => {
    if (!type) return type;
    
    // Map old database types to new frontend types
    const typeMap = {
      'single_choice': 'MCQ_SINGLE',
      'multiple_choice': 'MCQ_MULTI',
      'true_false': 'TRUE_FALSE',
      'rating_scale': 'LIKERT'
    };
    
    // If it's an old type, map it to new type
    if (typeMap[type.toLowerCase()]) {
      return typeMap[type.toLowerCase()];
    }
    
    // Otherwise return as-is (for new types like NUMERIC, SJT, RANKING)
    return type.toUpperCase();
  };

  const questionType = normalizeQuestionType(question.question_type);

  // Update local state when answer prop changes
  useEffect(() => {
    if (questionType === 'NUMERIC') {
      setNumericValue(answer || '');
    } else if (questionType === 'RANKING') {
      setRankingOrder(Array.isArray(answer) ? answer : []);
    }
  }, [answer, questionType]);

  const handleAnswerSelect = (selectedAnswer) => {
    if (questionType === 'MCQ_MULTI') {
      // Toggle selection for multiple choice
      const currentAnswers = Array.isArray(answer) ? answer : [];
      const isSelected = currentAnswers.includes(selectedAnswer);
      
      if (isSelected) {
        onAnswerChange(currentAnswers.filter(a => a !== selectedAnswer));
      } else {
        onAnswerChange([...currentAnswers, selectedAnswer]);
      }
    } else {
      // Single selection for other types
      onAnswerChange(selectedAnswer);
    }
  };

  const handleNumericChange = (value) => {
    setNumericValue(value);
    onAnswerChange(value);
  };

  const handleRankingChange = (option, newPosition) => {
    const currentOrder = Array.isArray(rankingOrder) ? [...rankingOrder] : [];
    // Remove option from current position if it exists
    const filtered = currentOrder.filter(item => item !== option);
    // Insert at new position
    filtered.splice(newPosition - 1, 0, option);
    setRankingOrder(filtered);
    onAnswerChange(filtered);
  };

  const isSelected = (option) => {
    if (!answer) return false;
    
    if (questionType === 'MCQ_MULTI') {
      return Array.isArray(answer) && answer.includes(option);
    }
    
    return answer === option;
  };

  // Parse options safely
  let options = [];
  try {
    if (question.options) {
      options = typeof question.options === 'string' 
        ? JSON.parse(question.options) 
        : question.options;
      if (!Array.isArray(options)) {
        options = [];
      }
    }
  } catch (e) {
    console.error('Error parsing options:', e);
    options = [];
  }

  // Safely get points value as a number
  const getPointsValue = () => {
    if (question.points == null) return 0;
    if (typeof question.points === 'number') return question.points;
    const parsed = parseFloat(question.points);
    return isNaN(parsed) ? 0 : parsed;
  };

  const pointsValue = getPointsValue();

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <Typography variant="h5" component="h2" fontWeight="bold" sx={{ flex: 1 }}>
            {question.question_text}
          </Typography>
          {pointsValue > 0 && (
            <Chip
              label={`${pointsValue.toFixed(2)} point${pointsValue !== 1 ? 's' : ''}`}
              color="primary"
              sx={{ ml: 2 }}
            />
          )}
        </Box>

        <Box sx={{ mt: 3 }}>
          {/* NUMERIC Question Type */}
          {questionType === 'NUMERIC' && (
            <TextField
              type="number"
              fullWidth
              label="Enter your answer"
              value={numericValue}
              onChange={(e) => handleNumericChange(e.target.value)}
              variant="outlined"
              sx={{ maxWidth: 400 }}
              inputProps={{
                step: 'any'
              }}
            />
          )}

          {/* TRUE_FALSE Question Type */}
          {questionType === 'TRUE_FALSE' && (
            <FormControl component="fieldset">
              <RadioGroup
                value={answer || ''}
                onChange={(e) => onAnswerChange(e.target.value)}
              >
                <FormControlLabel
                  value="true"
                  control={<Radio />}
                  label="True"
                  sx={{ mb: 1 }}
                />
                <FormControlLabel
                  value="false"
                  control={<Radio />}
                  label="False"
                />
              </RadioGroup>
            </FormControl>
          )}

          {/* LIKERT Scale Question Type */}
          {questionType === 'LIKERT' && options.length > 0 && (
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Select your response:</FormLabel>
              <RadioGroup
                value={answer || ''}
                onChange={(e) => onAnswerChange(e.target.value)}
                row
                sx={{ mt: 2 }}
              >
                {options.map((option, index) => (
                  <FormControlLabel
                    key={index}
                    value={option}
                    control={<Radio />}
                    label={option}
                    sx={{ flex: 1 }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          )}

          {/* MCQ_SINGLE Question Type */}
          {questionType === 'MCQ_SINGLE' && options.length > 0 && (
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={answer || ''}
                onChange={(e) => onAnswerChange(e.target.value)}
              >
                {options.map((option, index) => (
                  <Card
                    key={index}
                    onClick={() => onAnswerChange(option)}
                    sx={{
                      mb: 2,
                      p: 2,
                      border: 2,
                      borderColor: isSelected(option) ? 'primary.main' : 'grey.300',
                      bgcolor: isSelected(option) ? 'primary.light' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Radio
                          checked={isSelected(option)}
                          onChange={() => onAnswerChange(option)}
                        />
                      }
                      label={<Typography variant="body1">{option}</Typography>}
                      sx={{ m: 0 }}
                    />
                  </Card>
                ))}
              </RadioGroup>
            </FormControl>
          )}

          {/* MCQ_MULTI Question Type */}
          {questionType === 'MCQ_MULTI' && options.length > 0 && (
            <Box>
              {options.map((option, index) => (
                <Card
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  sx={{
                    mb: 2,
                    p: 2,
                    border: 2,
                    borderColor: isSelected(option) ? 'primary.main' : 'grey.300',
                    bgcolor: isSelected(option) ? 'primary.light' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isSelected(option)}
                        onChange={() => handleAnswerSelect(option)}
                      />
                    }
                    label={<Typography variant="body1">{option}</Typography>}
                    sx={{ m: 0 }}
                  />
                </Card>
              ))}
            </Box>
          )}

          {/* SJT (Situational Judgment Test) Question Type */}
          {questionType === 'SJT' && options.length > 0 && (
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Select the best response:</FormLabel>
              <RadioGroup
                value={answer || ''}
                onChange={(e) => onAnswerChange(e.target.value)}
                sx={{ mt: 2 }}
              >
                {options.map((option, index) => (
                  <Card
                    key={index}
                    onClick={() => onAnswerChange(option)}
                    sx={{
                      mb: 2,
                      p: 2,
                      border: 2,
                      borderColor: isSelected(option) ? 'primary.main' : 'grey.300',
                      bgcolor: isSelected(option) ? 'primary.light' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Radio
                          checked={isSelected(option)}
                          onChange={() => onAnswerChange(option)}
                        />
                      }
                      label={<Typography variant="body1">{option}</Typography>}
                      sx={{ m: 0 }}
                    />
                  </Card>
                ))}
              </RadioGroup>
            </FormControl>
          )}

          {/* RANKING Question Type */}
          {questionType === 'RANKING' && options.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Rank the options in order (1 = highest priority, {options.length} = lowest priority):
              </Typography>
              {options.map((option, index) => (
                <Box key={index} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body1" sx={{ flex: 1 }}>
                    {option}
                  </Typography>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Rank</InputLabel>
                    <Select
                      value={
                        Array.isArray(rankingOrder) && rankingOrder.includes(option)
                          ? rankingOrder.indexOf(option) + 1
                          : ''
                      }
                      label="Rank"
                      onChange={(e) => handleRankingChange(option, parseInt(e.target.value))}
                    >
                      {options.map((_, rankIndex) => (
                        <MenuItem key={rankIndex} value={rankIndex + 1}>
                          {rankIndex + 1}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              ))}
            </Box>
          )}

          {/* Fallback for unknown question types or questions without options */}
          {!['NUMERIC', 'TRUE_FALSE', 'LIKERT', 'MCQ_SINGLE', 'MCQ_MULTI', 'SJT', 'RANKING'].includes(questionType) && (
            <Typography variant="body2" color="error">
              Unsupported question type: {questionType || 'Unknown'}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default QuestionCard;

