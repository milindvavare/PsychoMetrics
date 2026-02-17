import React from 'react';
import { Box, Typography } from '@mui/material';

const Timer = ({ seconds, onTimeUp }) => {
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getColor = () => {
    if (seconds < 300) return 'error.main'; // Red for last 5 minutes
    if (seconds < 600) return 'warning.main'; // Yellow for last 10 minutes
    return 'success.main'; // Green
  };

  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        bgcolor: getColor(),
        color: 'white',
        borderRadius: 2,
        fontWeight: 'bold',
        minWidth: 120,
        textAlign: 'center'
      }}
    >
      <Typography variant="h6" fontWeight="bold">
        {formatTime(seconds)}
      </Typography>
    </Box>
  );
};

export default Timer;

