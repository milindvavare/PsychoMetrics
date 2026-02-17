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
  CircularProgress,
  Typography
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Email,
  Assignment
} from '@mui/icons-material';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  ListItemText,
  OutlinedInput
} from '@mui/material';
import {
  Dialog as ConfirmDialog,
  DialogTitle as ConfirmDialogTitle,
  DialogContent as ConfirmDialogContent,
  DialogContentText,
  DialogActions as ConfirmDialogActions
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const Candidates = () => {
  const [candidates, setCandidates] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [assigningCandidate, setAssigningCandidate] = useState(null);
  const [selectedTests, setSelectedTests] = useState([]);
  const [assignmentData, setAssignmentData] = useState({
    due_date: '',
    notes: ''
  });
  const [deletingCandidate, setDeletingCandidate] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: ''
  });

  useEffect(() => {
    loadCandidates();
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const response = await api.get('/tests');
      if (response.success) {
        // Only show active tests
        setTests((response.data || []).filter(test => test.status === 'active'));
      }
    } catch (error) {
      console.error('Failed to load tests:', error);
    }
  };

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/candidates');
      if (response.success) {
        setCandidates(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (candidate = null) => {
    if (candidate) {
      setEditingCandidate(candidate);
      setFormData({
        email: candidate.email || '',
        first_name: candidate.first_name || '',
        last_name: candidate.last_name || '',
        phone: candidate.phone || ''
      });
    } else {
      setEditingCandidate(null);
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCandidate(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingCandidate) {
        await api.put(`/candidates/${editingCandidate.id}`, formData);
        toast.success('Candidate updated successfully');
      } else {
        const response = await api.post('/candidates', {
          ...formData,
          send_invitation: true // Explicitly send invitation
        });
        if (response.success) {
          if (response.data.invitation_sent) {
            toast.success('Candidate created and invitation email sent!');
          } else if (response.data.email_error) {
            toast.warning(`Candidate created, but email failed: ${response.data.email_error}`);
          } else {
            toast.success('Candidate created successfully');
          }
        }
      }
      handleCloseDialog();
      loadCandidates();
    } catch (error) {
      toast.error(error.message || 'Failed to save candidate');
    }
  };

  const handleDeleteClick = (candidate) => {
    setDeletingCandidate(candidate);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCandidate) return;

    try {
      await api.delete(`/candidates/${deletingCandidate.id}`);
      toast.success('Candidate deleted successfully');
      setOpenDeleteDialog(false);
      setDeletingCandidate(null);
      loadCandidates();
    } catch (error) {
      toast.error(error.message || 'Failed to delete candidate');
    }
  };

  const handleDeleteCancel = () => {
    setOpenDeleteDialog(false);
    setDeletingCandidate(null);
  };

  const handleAssignTestClick = (candidate) => {
    setAssigningCandidate(candidate);
    setSelectedTests([]);
    setAssignmentData({ due_date: '', notes: '' });
    setOpenAssignDialog(true);
  };

  const handleAssignTestClose = () => {
    setOpenAssignDialog(false);
    setAssigningCandidate(null);
    setSelectedTests([]);
    setAssignmentData({ due_date: '', notes: '' });
  };

  const handleAssignTestSubmit = async () => {
    if (!assigningCandidate || selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }

    try {
      const response = await api.post('/test-assignments/assign', {
        test_id: selectedTests[0], // For now, assign one at a time
        candidate_ids: [assigningCandidate.id],
        due_date: assignmentData.due_date || null,
        notes: assignmentData.notes || null
      });

      if (response.success) {
        toast.success(`Test assigned to ${assigningCandidate.first_name || assigningCandidate.email} successfully`);
        handleAssignTestClose();
      } else {
        toast.error(response.message || 'Failed to assign test');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to assign test');
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
          Candidate Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          Add Candidate
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow key={candidate.id}>
                <TableCell>
                  {candidate.first_name || candidate.last_name 
                    ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
                    : '-'}
                </TableCell>
                <TableCell>{candidate.email}</TableCell>
                <TableCell>{candidate.phone || '-'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {candidate.password_hash ? (
                      <Typography variant="body2" color="success.main" fontWeight="bold">
                        Active
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="warning.main" fontWeight="bold">
                        Pending
                      </Typography>
                    )}
                    {candidate.status && (
                      <Typography variant="caption" color="text.secondary">
                        ({candidate.status})
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <IconButton 
                    size="small" 
                    onClick={() => handleOpenDialog(candidate)}
                    color="primary"
                    title="Edit"
                  >
                    <Edit />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleAssignTestClick(candidate)}
                    color="secondary"
                    title="Assign Test"
                  >
                    <Assignment />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteClick(candidate)}
                    color="error"
                    title="Delete"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <TextField
              label="First Name"
              fullWidth
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            />
            <TextField
              label="Last Name"
              fullWidth
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
            <TextField
              label="Phone"
              fullWidth
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCandidate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={openDeleteDialog}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <ConfirmDialogTitle id="delete-dialog-title">
          Delete Candidate
        </ConfirmDialogTitle>
        <ConfirmDialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete <strong>{deletingCandidate?.first_name} {deletingCandidate?.last_name}</strong> ({deletingCandidate?.email})?
            <br />
            <br />
            This action cannot be undone. All test attempts and scores associated with this candidate will also be deleted.
          </DialogContentText>
        </ConfirmDialogContent>
        <ConfirmDialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </ConfirmDialogActions>
      </ConfirmDialog>

      {/* Assign Test Dialog */}
      <Dialog open={openAssignDialog} onClose={handleAssignTestClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Assign Test to {assigningCandidate?.first_name || assigningCandidate?.email}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Test</InputLabel>
              <Select
                value={selectedTests.length > 0 ? selectedTests[0] : ''}
                onChange={(e) => setSelectedTests([e.target.value])}
                input={<OutlinedInput label="Select Test" />}
              >
                {tests.map((test) => (
                  <MenuItem key={test.id} value={test.id}>
                    {test.title} ({test.duration_minutes} min, {test.question_count || 0} questions)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Due Date (Optional)"
              type="datetime-local"
              fullWidth
              value={assignmentData.due_date}
              onChange={(e) => setAssignmentData({ ...assignmentData, due_date: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />

            <TextField
              label="Notes (Optional)"
              fullWidth
              multiline
              rows={3}
              value={assignmentData.notes}
              onChange={(e) => setAssignmentData({ ...assignmentData, notes: e.target.value })}
              placeholder="Add any notes or instructions for this assignment..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAssignTestClose}>Cancel</Button>
          <Button onClick={handleAssignTestSubmit} variant="contained" disabled={selectedTests.length === 0}>
            Assign Test
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Candidates;

