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
        if (testResponse.data.duration_minutes) {
          const durationSeconds = testResponse.data.duration_minutes * 60;
          let remainingSeconds = durationSeconds;
          
          // Calculate remaining time based on when attempt started
          if (attemptResponse.data.started_at) {
            const startedAt = new Date(attemptResponse.data.started_at);
            const now = new Date();
            const elapsedSeconds = Math.floor((now - startedAt) / 1000);
            remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
            
            console.log(`Timer calculation: Duration=${durationSeconds}s, Elapsed=${elapsedSeconds}s, Remaining=${remainingSeconds}s`);
          }
          
          // Only start timer if there's time remaining
          if (remainingSeconds > 0) {
            setTimeout(() => {
              setTimeRemaining(remainingSeconds);
              startTimer(remainingSeconds);
            }, 50);
          } else {
            // Time is up, auto-submit
            toast.warning('Time has expired. Submitting test...');
            setTimeout(() => {
              handleTimeUp();
            }, 1000);
          }
        }

        // Initialize enhanced anti-cheating detection
        tabDetectionRef.current = new TabDetection(handleTabSwitch);
        
        // Request fullscreen mode
        requestFullscreen();
        
        // Prevent page refresh
        preventPageRefresh();
        
        if (!warningShown) {
          toast.warning('⚠️ Anti-cheating is active. Tab switches, copy/paste, and dev tools are monitored.');
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

  // Request fullscreen mode
  const requestFullscreen = () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          console.log('Fullscreen request denied:', err);
        });
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen not supported:', error);
    }
  };

  // Prevent page refresh
  const preventPageRefresh = () => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave? Your progress may be lost.';
      return e.returnValue;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also prevent back button
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', () => {
      window.history.pushState(null, '', window.location.href);
      toast.warning('⚠️ Navigation blocked during test.');
    });
  };

  // Track fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && 
          !document.mozFullScreenElement && !document.msFullscreenElement) {
        if (attemptId) {
          // Track fullscreen exit
          api.post('/attempts/track-tab', {
            attempt_id: attemptId,
            fullscreen_exit: true,
            suspicious_activity: {
              type: 'fullscreen_exit',
              timestamp: new Date().toISOString()
            }
          }).catch(err => console.error('Fullscreen exit tracking error:', err));
          
          toast.error('⚠️ Fullscreen mode exited. Please return to fullscreen.');
          
          // Try to re-enter fullscreen after a delay
          setTimeout(() => {
            requestFullscreen();
          }, 2000);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [attemptId]);

  const handleTabSwitch = async (data) => {
    if (!attemptId) return;
    
    try {
      // Get all suspicious activities from TabDetection
      const allActivities = tabDetectionRef.current?.getSuspiciousActivities() || {};
      
      // API interceptor will automatically add candidate token
      await api.post('/attempts/track-tab', {
        attempt_id: attemptId,
        tab_switch: true,
        suspicious_activity: {
          ...data.suspicious_activity,
          ...allActivities,
          timestamp: new Date().toISOString()
        }
      });
      
      if (data.suspicious_activity?.type === 'tab_switch') {
        toast.warning(`⚠️ Tab switch detected (${allActivities.tab_switches || 0} total). This is being recorded.`);
      } else if (data.suspicious_activity?.type === 'dev_tools') {
        toast.error(`🚫 Developer tools detected. This is a serious violation.`);
      } else if (data.suspicious_activity?.type === 'copy' || data.suspicious_activity?.type === 'paste') {
        toast.warning(`⚠️ Copy/Paste attempt detected (${allActivities.copy_paste || 0} total).`);
      } else if (data.suspicious_activity?.type === 'right_click') {
        toast.warning(`⚠️ Right-click detected (${allActivities.right_clicks || 0} total).`);
      } else if (data.suspicious_activity?.type === 'screenshot_attempt') {
        toast.error(`🚫 Screenshot attempt detected. This is being recorded.`);
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
