import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const Settings = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Settings
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Profile Information
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
          <TextField
            label="Email"
            value={user?.email || ''}
            disabled
            fullWidth
          />
          <TextField
            label="First Name"
            value={user?.first_name || ''}
            fullWidth
          />
          <TextField
            label="Last Name"
            value={user?.last_name || ''}
            fullWidth
          />
          <TextField
            label="Role"
            value={user?.role || ''}
            disabled
            fullWidth
          />
          <Button variant="contained" sx={{ maxWidth: 200 }}>
            Update Profile
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Company Information
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
          <TextField
            label="Company Name"
            value={user?.company?.name || ''}
            disabled
            fullWidth
          />
          <TextField
            label="Subscription Tier"
            value={user?.company?.subscription_tier || ''}
            disabled
            fullWidth
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default Settings;

