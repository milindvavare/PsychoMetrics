import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  useScrollTrigger,
  Slide,
  Fab,
  Zoom
} from '@mui/material';
import {
  Assessment,
  Analytics,
  Security,
  Speed,
  People,
  BarChart,
  TrendingUp,
  Shield,
  Cloud,
  ArrowUpward,
  Login
} from '@mui/icons-material';

const features = [
  {
    icon: <Assessment sx={{ fontSize: 60 }} />,
    title: 'Comprehensive Test Management',
    description: 'Create, manage, and deploy psychometric tests with ease. Full control over test settings, questions, and scoring.'
  },
  {
    icon: <Analytics sx={{ fontSize: 60 }} />,
    title: 'Advanced Analytics',
    description: 'Get detailed insights with AI-powered interpretations, percentile rankings, and benchmark comparisons.'
  },
  {
    icon: <Security sx={{ fontSize: 60 }} />,
    title: 'Anti-Cheating System',
    description: 'Built-in tab detection, IP logging, and suspicious activity monitoring to ensure test integrity.'
  },
  {
    icon: <Speed sx={{ fontSize: 60 }} />,
    title: 'Fast & Reliable',
    description: 'Lightning-fast performance with real-time scoring and instant result generation.'
  },
  {
    icon: <People sx={{ fontSize: 60 }} />,
    title: 'Candidate Management',
    description: 'Efficiently manage candidates, track their progress, and generate comprehensive reports.'
  },
  {
    icon: <BarChart sx={{ fontSize: 60 }} />,
    title: 'Visual Reports',
    description: 'Beautiful radar charts, PDF reports, and comparative analytics for better decision making.'
  }
];

const benefits = [
  {
    title: 'Multi-Company Support',
    description: 'SaaS-ready architecture supporting multiple companies with complete data isolation.',
    icon: <Cloud sx={{ fontSize: 40 }} />
  },
  {
    title: 'Advanced Scoring',
    description: 'Category-based scoring, reverse scoring, negative marking, and percentile calculation.',
    icon: <TrendingUp sx={{ fontSize: 40 }} />
  },
  {
    title: 'Secure & Compliant',
    description: 'Enterprise-grade security with role-based access control and audit logging.',
    icon: <Shield sx={{ fontSize: 40 }} />
  }
];

function ScrollTop(props) {
  const { children, window } = props;
  const trigger = useScrollTrigger({
    target: window ? window() : undefined,
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = (event) => {
    const anchor = (event.target.ownerDocument || document).querySelector(
      '#back-to-top-anchor',
    );
    if (anchor) {
      anchor.scrollIntoView({
        block: 'center',
      });
    }
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
      >
        {children}
      </Box>
    </Zoom>
  );
}

function HideOnScroll(props) {
  const { children, window } = props;
  const trigger = useScrollTrigger({
    target: window ? window() : undefined,
  });

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

const Landing = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ flexGrow: 1 }}>
      <HideOnScroll>
        <AppBar
          position="fixed"
          sx={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: 1
          }}
        >
          <Toolbar>
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              PsychoMetrics
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                color="inherit"
                onClick={() => navigate('/register')}
                sx={{
                  color: 'text.primary',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.1)'
                  }
                }}
              >
                Sign Up
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/login')}
                startIcon={<Login />}
                sx={{
                  color: 'text.primary',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.1)'
                  }
                }}
              >
                Admin Login
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/candidate/login')}
                sx={{
                  color: 'text.primary',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.1)'
                  }
                }}
              >
                Candidate Login
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
      </HideOnScroll>

      <Toolbar id="back-to-top-anchor" />

      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3
          }}
        />
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h2"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.2
                }}
              >
                Advanced Psychometric Testing Platform
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  mb: 4,
                  opacity: 0.9,
                  fontSize: { xs: '1.1rem', md: '1.3rem' }
                }}
              >
                Professional assessment solution with AI-powered insights, 
                advanced scoring, and comprehensive analytics
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  transform: 'translateY(-2px)',
                  boxShadow: 4
                }
              }}
            >
              Get Started
            </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
                  }}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  Learn More
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={10}
                sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 3
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Key Statistics
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <Typography variant="h4" fontWeight="bold">
                      100%
                    </Typography>
                    <Typography variant="body2">Secure</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" fontWeight="bold">
                      24/7
                    </Typography>
                    <Typography variant="body2">Available</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" fontWeight="bold">
                      AI
                    </Typography>
                    <Typography variant="body2">Powered</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" fontWeight="bold">
                      SaaS
                    </Typography>
                    <Typography variant="body2">Ready</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" sx={{ py: { xs: 8, md: 12 }, bgcolor: '#f5f5f5' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            align="center"
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 2 }}
          >
            Powerful Features
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
          >
            Everything you need to create, manage, and analyze psychometric tests
          </Typography>
          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 3,
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <Box sx={{ color: 'primary.main', mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h5" gutterBottom fontWeight="bold">
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            align="center"
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 2 }}
          >
            Why Choose PsychoMetrics?
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
          >
            Built for modern organizations that need reliable, scalable assessment solutions
          </Typography>
          <Grid container spacing={4}>
            {benefits.map((benefit, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    p: 4,
                    background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Box sx={{ color: 'primary.main', mb: 2 }}>
                    {benefit.icon}
                  </Box>
                  <Typography variant="h5" gutterBottom fontWeight="bold">
                    {benefit.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {benefit.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            component="h2"
            align="center"
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 2 }}
          >
            Ready to Get Started?
          </Typography>
          <Typography
            variant="h6"
            align="center"
            sx={{ mb: 4, opacity: 0.9 }}
          >
            Join thousands of companies using PsychoMetrics for their assessment needs
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 6,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  transform: 'translateY(-2px)',
                  boxShadow: 4
                }
              }}
            >
              Start Free Trial
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                borderColor: 'white',
                color: 'white',
                px: 6,
                py: 1.5,
                fontSize: '1.1rem',
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Contact Sales
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 4,
          bgcolor: '#1a1a1a',
          color: 'white'
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: 'white' }}>
                PsychoMetrics
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Advanced psychometric testing platform for modern organizations.
                Built with cutting-edge technology and best practices.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: 'white' }}>
                Features
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                <Box>Test Management</Box>
                <Box>Question Bank</Box>
                <Box>Advanced Scoring</Box>
                <Box>AI Interpretation</Box>
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: 'white' }}>
                Contact
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                <Box>Email: support@psychometrics.com</Box>
                <Box>Phone: +1 (555) 123-4567</Box>
                <Box>Support: 24/7 Available</Box>
              </Typography>
            </Grid>
          </Grid>
          <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="body2" align="center" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              © {new Date().getFullYear()} PsychoMetrics. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>

      <ScrollTop>
        <Fab color="primary" size="small" aria-label="scroll back to top">
          <ArrowUpward />
        </Fab>
      </ScrollTop>
    </Box>
  );
};

export default Landing;

