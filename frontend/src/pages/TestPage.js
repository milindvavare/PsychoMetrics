import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  CheckCircle,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../utils/api';
import TabDetection from '../utils/tabDetection';
import Timer from '../components/Timer';
import QuestionCard from '../components/QuestionCard';

const TestPage = () => {
  const { testId, candidateId } = useParams();
  const navigate = useNavigate();
  
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warningShown, setWarningShown] = useState(false);
  
  const tabDetectionRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Only initialize once when component mounts
    let isMounted = true;
    let initialized = false;
    
    const init = async () => {
      if (isMounted && !initialized) {
        initialized = true;
        await initializeTest();
      }
    };
    
    init();
    
    return () => {
      isMounted = false;
      initialized = false;
      if (tabDetectionRef.current) {
        tabDetectionRef.current.destroy();
        tabDetectionRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [testId]); // Only re-run if testId changes

  const initializeTest = async () => {
    try {
      setIsLoading(true);
      
      // First, get test details and questions
      const testResponse = await api.get(`/tests/${testId}`);
      if (!testResponse.success) {
        toast.error(testResponse.message || 'Failed to load test');
        setIsLoading(false);
        return;
      }

      setTest(testResponse.data);
      setQuestions(testResponse.data.questions || []);
      
      if (testResponse.data.questions && testResponse.data.questions.length === 0) {
        toast.error('This test has no questions assigned');
        setIsLoading(false);
        return;
      }

      // Then start or resume attempt
      // The backend will check for existing in_progress attempts and return them instead of creating duplicates
      const attemptResponse = await api.post('/attempts/start', {
        test_id: parseInt(testId)
      });

      if (attemptResponse.success) {
        setAttemptId(attemptResponse.data.attempt_id);
        
        // Set timer if duration is specified
        if (testResponse.data.duration_minutes && !attemptResponse.data.is_resumed) {
          // Only start timer for new attempts
          const durationSeconds = testResponse.data.duration_minutes * 60;
          // Use setTimeout to ensure state is updated before starting timer
          setTimeout(() => {
            setTimeRemaining(durationSeconds);
            startTimer(durationSeconds);
          }, 50);
        } else if (attemptResponse.data.is_resumed && testResponse.data.duration_minutes) {
          // For resumed attempts, start with full duration
          // TODO: Calculate actual remaining time based on attempt start time
          const durationSeconds = testResponse.data.duration_minutes * 60;
          setTimeout(() => {
            setTimeRemaining(durationSeconds);
            startTimer(durationSeconds);
          }, 50);
        }

        // Initialize tab detection
        tabDetectionRef.current = new TabDetection(handleTabSwitch);
        
        if (!warningShown) {
          toast.warning('Please do not switch tabs during the test. Tab switches are being monitored.');
          setWarningShown(true);
        }
      } else {
        toast.error(attemptResponse.message || 'Failed to start test attempt');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to initialize test');
      console.error('Initialize test error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startTimer = (duration) => {
    // Clear any existing timer first to prevent multiple intervals
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Set initial time
    setTimeRemaining(duration);
    
    // Use a ref to track the current time to avoid closure issues
    let currentTime = duration;
    
    // Create new interval - ensure it runs exactly every 1000ms
    timerRef.current = setInterval(() => {
      currentTime = currentTime - 1;
      
      if (currentTime <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimeRemaining(0);
        handleTimeUp();
      } else {
        setTimeRemaining(currentTime);
      }
    }, 1000);
  };

  const handleTimeUp = async () => {
    // Prevent multiple calls
    if (isSubmitting) {
      return;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    toast.info('Time is up! Submitting your test automatically...');
    
    // Ensure all answers are saved before submitting
    try {
      // Save any pending answers
      for (const questionId in answers) {
        await saveAnswer(parseInt(questionId), answers[questionId]);
      }
      
      // Submit the test
      await submitTest();
    } catch (error) {
      console.error('Error during auto-submit:', error);
      toast.error('Error submitting test. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleTabSwitch = async (data) => {
    if (!attemptId) return;
    
    try {
      // API interceptor will automatically add candidate token
      await api.post('/attempts/track-tab', {
        attempt_id: attemptId,
        tab_switch: true,
        suspicious_activity: data.suspicious_activity || {}
      });
      
      if (data.suspicious_activity?.type === 'tab_switch') {
        toast.warning(`Warning: Tab switch detected. This is being recorded.`);
      } else if (data.suspicious_activity?.type === 'dev_tools') {
        toast.error(`Warning: Developer tools detected. This is a serious violation.`);
      } else if (data.suspicious_activity?.type === 'copy' || data.suspicious_activity?.type === 'paste') {
        toast.warning(`Warning: Copy/Paste attempt detected.`);
      }
    } catch (error) {
      console.error('Tab switch tracking error:', error);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const saveAnswer = async (questionId, answer) => {
    if (!attemptId) return;
    
    try {
      // API interceptor will automatically add candidate token
      await api.post('/attempts/answer', {
        attempt_id: attemptId,
        question_id: questionId,
        answer_data: answer
      });
    } catch (error) {
      console.error('Save answer error:', error);
    }
  };

  const handleNext = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion && answers[currentQuestion.id]) {
      saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleQuestionClick = (index) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion && answers[currentQuestion.id]) {
      saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
    }
    setCurrentQuestionIndex(index);
  };

  const submitTest = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion && answers[currentQuestion.id]) {
        await saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
      }

      for (const questionId in answers) {
        await saveAnswer(parseInt(questionId), answers[questionId]);
      }

      // API interceptor will automatically add candidate token
      const response = await api.post('/attempts/submit', {
        attempt_id: attemptId
      });

      if (response.success) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        navigate(`/test/complete/${attemptId}`);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const unansweredCount = questions.filter(
      q => !answers[q.id]
    ).length;

    if (unansweredCount > 0) {
      const confirm = window.confirm(
        `You have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirm) return;
    }

    submitTest();
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
            Loading test...
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Test Not Found</Typography>
          <Typography>The test you're looking for doesn't exist or is not available.</Typography>
        </Alert>
      </Container>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

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
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold">
              {test.title}
            </Typography>
            {test.instructions && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2"><strong>Instructions:</strong> {test.instructions}</Typography>
              </Alert>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
              p: 2,
              background: '#f5f5f5',
              borderRadius: 2
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {answeredCount} answered
              </Typography>
            </Box>
            
            {timeRemaining !== null && (
              <Timer seconds={timeRemaining} onTimeUp={handleTimeUp} />
            )}
          </Box>

          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4, mb: 3 }}
          />

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {questions.map((q, index) => (
              <Grid item key={q.id}>
                <IconButton
                  onClick={() => handleQuestionClick(index)}
                  sx={{
                    width: 48,
                    height: 48,
                    border: 2,
                    borderColor: index === currentQuestionIndex
                      ? 'primary.main'
                      : answers[q.id]
                        ? 'success.main'
                        : 'grey.300',
                    bgcolor: index === currentQuestionIndex
                      ? 'primary.main'
                      : answers[q.id]
                        ? 'success.main'
                        : 'white',
                    color: index === currentQuestionIndex || answers[q.id]
                      ? 'white'
                      : 'text.primary',
                    '&:hover': {
                      bgcolor: 'primary.light'
                    }
                  }}
                >
                  {answers[q.id] ? <CheckCircle /> : <RadioButtonUnchecked />}
                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                    {index + 1}
                  </Typography>
                </IconButton>
              </Grid>
            ))}
          </Grid>

          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              answer={answers[currentQuestion.id] || null}
              onAnswerChange={(answer) => {
                handleAnswerChange(currentQuestion.id, answer);
                saveAnswer(currentQuestion.id, answer);
              }}
            />
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>

            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={handleNext}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={isSubmitting}
                sx={{
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #218838 0%, #1aa179 100%)'
                  }
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default TestPage;
