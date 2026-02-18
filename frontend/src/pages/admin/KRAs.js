import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Assignment
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const KRAs = () => {
  const navigate = useNavigate();
  const [kras, setKRAs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [editingKRA, setEditingKRA] = useState(null);
  const [formData, setFormData] = useState({
    role_name: '',
    title: '',
    description: '',
    weight: '',
    evaluation_period: 'quarterly',
    status: 'active'
  });
  const [existingRoles, setExistingRoles] = useState([]);
  const [weightInfo, setWeightInfo] = useState({ currentTotal: 0, remaining: 100 });

  useEffect(() => {
    loadKRAs();
    loadExistingRoles();
  }, []);

  useEffect(() => {
    if (formData.role_name && openDialog) {
      loadWeightInfo();
    }
  }, [formData.role_name, formData.weight, openDialog, editingKRA]);

  const loadKRAs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/kras');
      if (response.success) {
        setKRAs(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load KRAs');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingRoles = async () => {
    try {
      const response = await api.get('/kras');
      if (response.success) {
        const roles = [...new Set((response.data || []).map(k => k.role_name).filter(Boolean))];
        setExistingRoles(roles.sort());
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadWeightInfo = async () => {
    if (!formData.role_name) return;
    try {
      const response = await api.get(`/kras?role_name=${encodeURIComponent(formData.role_name)}&status=active`);
      if (response.success) {
        const krasForRole = response.data || [];
        const currentTotal = krasForRole
          .filter(k => editingKRA ? k.id !== editingKRA.id : true)
          .reduce((sum, k) => sum + parseFloat(k.weight || 0), 0);
        const newWeight = parseFloat(formData.weight) || 0;
        const total = currentTotal + newWeight;
        setWeightInfo({
          currentTotal: currentTotal,
          newWeight: newWeight,
          total: total,
          remaining: 100 - total
        });
      }
    } catch (error) {
      console.error('Failed to load weight info:', error);
    }
  };

  const handleOpenDialog = (kra = null) => {
    if (kra) {
      setEditingKRA(kra);
      setFormData({
        role_name: kra.role_name || '',
        title: kra.title || '',
        description: kra.description || '',
        weight: kra.weight || '',
        evaluation_period: kra.evaluation_period || 'quarterly',
        status: kra.status || 'active'
      });
    } else {
      setEditingKRA(null);
      setFormData({
        role_name: '',
        title: '',
        description: '',
        weight: '',
        evaluation_period: 'quarterly',
        status: 'active'
      });
    }
    setWeightInfo({ currentTotal: 0, newWeight: 0, total: 0, remaining: 100 });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingKRA(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.role_name || !formData.role_name.trim()) {
      toast.error('Role is required');
      return;
    }
    if (!formData.title || !formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    const weightValue = parseFloat(formData.weight);
    if (!formData.weight || isNaN(weightValue) || weightValue <= 0) {
      toast.error('Weight must be greater than 0');
      return;
    }
    
    if (weightValue > 100) {
      toast.error('Weight cannot exceed 100%');
      return;
    }

    // Check weight total
    if (weightInfo.total > 100) {
      toast.error(`Total weight for role "${formData.role_name}" would exceed 100%`);
      return;
    }

    try {
      // Prepare data with proper weight value
      const submitData = {
        ...formData,
        weight: weightValue
      };

      if (editingKRA) {
        const response = await api.put(`/kras/${editingKRA.id}`, submitData);
        if (response.success) {
          toast.success('KRA updated successfully');
          handleCloseDialog();
          loadKRAs();
          loadExistingRoles();
        } else {
          toast.error(response.message || 'Failed to update KRA');
        }
      } else {
        const response = await api.post('/kras', submitData);
        if (response.success) {
          toast.success('KRA created successfully');
          handleCloseDialog();
          loadKRAs();
          loadExistingRoles();
          // Redirect to KPI page for this KRA
          if (response.data?.kra_id) {
            toast.info('Redirecting to add KPIs for this KRA...');
            setTimeout(() => {
              navigate(`/dashboard/kpis?kra_id=${response.data.kra_id}`);
            }, 1500);
          }
        } else {
          const errorMsg = response.message || response.error || 'Failed to create KRA';
          toast.error(errorMsg, { autoClose: 5000 });
          console.error('Create KRA response error:', response);
        }
      }
    } catch (error) {
      console.error('Save KRA error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to save KRA. Please check if the database migration has been run.';
      toast.error(errorMessage, { autoClose: 6000 });
      
      // If it's a database schema error, show additional help
      if (errorMessage.includes('schema') || errorMessage.includes('column') || errorMessage.includes('migration')) {
        toast.info('Please run: migration_update_kra_add_role_and_evaluation.sql', { autoClose: 8000 });
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this KRA?')) {
      try {
        await api.delete(`/kras/${id}`);
        toast.success('KRA deleted successfully');
        loadKRAs();
      } catch (error) {
        toast.error('Failed to delete KRA');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
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
          KRA Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          Create KRA
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Weight</strong></TableCell>
              <TableCell><strong>Evaluation Period</strong></TableCell>
              <TableCell><strong>KPIs</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {kras.map((kra) => (
              <TableRow key={kra.id}>
                <TableCell><strong>{kra.role_name || 'N/A'}</strong></TableCell>
                <TableCell>{kra.title}</TableCell>
                <TableCell>{kra.weight}%</TableCell>
                <TableCell>{kra.evaluation_period ? kra.evaluation_period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}</TableCell>
                <TableCell>{kra.kpi_count || 0}</TableCell>
                <TableCell>
                  <Chip
                    label={kra.status}
                    color={getStatusColor(kra.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpenDialog(kra)} title="Edit">
                    <Edit />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => setOpenAssignDialog(kra)} 
                    color="secondary"
                    title="Assign to Employee"
                  >
                    <Assignment />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(kra.id)} color="error" title="Delete">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingKRA ? 'Edit KRA' : 'Create New KRA'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Role *"
              fullWidth
              required
              value={formData.role_name}
              onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
              placeholder="e.g., Web Developer, Sales Manager"
              helperText="Select or enter a role name"
              InputProps={{
                list: 'roles-list'
              }}
            />
            <datalist id="roles-list">
              {existingRoles.map((role, idx) => (
                <option key={idx} value={role} />
              ))}
            </datalist>

            <TextField
              label="Title *"
              fullWidth
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Code Quality & Maintainability"
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this KRA measures"
            />

            <Box>
              <TextField
                label="Weight (%) *"
                type="number"
                fullWidth
                required
                value={formData.weight}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, weight: value === '' ? '' : value });
                }}
                onFocus={(e) => {
                  // Clear the field if it's 0 or empty when focused
                  if (formData.weight === 0 || formData.weight === '0' || formData.weight === '') {
                    setFormData({ ...formData, weight: '' });
                  }
                }}
                onBlur={(e) => {
                  // Ensure we have a valid number, default to empty if invalid
                  const value = parseFloat(e.target.value);
                  if (isNaN(value) || value <= 0) {
                    setFormData({ ...formData, weight: '' });
                  }
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                error={weightInfo.total > 100}
                helperText={
                  formData.role_name
                    ? weightInfo.total > 100
                      ? `Total weight exceeds 100%! Current: ${weightInfo.currentTotal?.toFixed(2)}%, Adding: ${weightInfo.newWeight?.toFixed(2)}%, Total: ${weightInfo.total?.toFixed(2)}%`
                      : `Current total: ${weightInfo.currentTotal?.toFixed(2)}%, Remaining: ${weightInfo.remaining?.toFixed(2)}%`
                    : 'Select a role first'
                }
              />
            </Box>

            <TextField
              select
              label="Evaluation Period *"
              fullWidth
              required
              value={formData.evaluation_period}
              onChange={(e) => setFormData({ ...formData, evaluation_period: e.target.value })}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
              <MenuItem value="half_yearly">Half-Yearly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </TextField>

            <TextField
              select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={weightInfo.total > 100}
          >
            {editingKRA ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign KRA Dialog */}
      <AssignKRADialog 
        open={openAssignDialog} 
        onClose={() => setOpenAssignDialog(false)} 
        kra={openAssignDialog}
        onSuccess={loadKRAs}
      />
    </Box>
  );
};

// Assign KRA Dialog Component
const AssignKRADialog = ({ open, onClose, kra, onSuccess }) => {
  const [employees, setEmployees] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [formData, setFormData] = useState({
    employee_type: 'user',
    employee_id: '',
    start_date: '',
    end_date: '',
    weight: 1.0,
    notes: ''
  });

  useEffect(() => {
    if (open && kra) {
      loadEmployees();
      loadCandidates();
    }
  }, [open, kra]);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/users');
      if (response.success) {
        setEmployees(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees([]);
    }
  };

  const loadCandidates = async () => {
    try {
      const response = await api.get('/candidates');
      if (response.success) {
        setCandidates(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load candidates:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post('/kras/assign', {
        ...formData,
        kra_id: kra.id
      });
      if (response.success) {
        toast.success('KRA assigned successfully');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(response.message || 'Failed to assign KRA');
      }
    } catch (error) {
      toast.error('Failed to assign KRA');
    }
  };

  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign KRA: {kra?.title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Employee Type"
            value={formData.employee_type}
            onChange={(e) => setFormData({ ...formData, employee_type: e.target.value, employee_id: '' })}
            fullWidth
          >
            <MenuItem value="user">Employee (User)</MenuItem>
            <MenuItem value="candidate">Candidate</MenuItem>
          </TextField>
          <TextField
            select
            label={formData.employee_type === 'user' ? 'Select Employee' : 'Select Candidate'}
            value={formData.employee_id}
            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            fullWidth
            required
          >
            {(formData.employee_type === 'user' ? employees : candidates).map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} ({emp.email})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Weight"
            type="number"
            fullWidth
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
            inputProps={{ min: 0, max: 10, step: 0.1 }}
          />
          <TextField
            label="Notes"
            fullWidth
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KRAs;

