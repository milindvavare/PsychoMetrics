import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Chip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const KPIs = () => {
  const [searchParams] = useSearchParams();
  const [kpis, setKPIs] = useState([]);
  const [kras, setKRAs] = useState([]);
  const [testCategories, setTestCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingKPI, setEditingKPI] = useState(null);
  const [formData, setFormData] = useState({
    kra_id: '',
    test_category_id: '',
    title: '',
    description: '',
    measurement_type: 'percentage',
    target_value: '',
    unit: '',
    frequency: 'monthly',
    weight: 1.0,
    formula: '',
    status: 'active'
  });

  useEffect(() => {
    loadKPIs();
    loadKRAs();
    loadTestCategories();
  }, []);

  useEffect(() => {
    // Check if kra_id is in URL query params (from KRA creation redirect)
    const kraId = searchParams.get('kra_id');
    if (kraId && kras.length > 0) {
      // Verify the KRA exists
      const kraExists = kras.find(k => k.id === parseInt(kraId));
      if (kraExists) {
        setFormData(prev => ({ ...prev, kra_id: kraId }));
        setOpenDialog(true);
        // Remove query param from URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [searchParams, kras]);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/kpis');
      if (response.success) {
        setKPIs(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  };

  const loadKRAs = async () => {
    try {
      const response = await api.get('/kras?status=active');
      if (response.success) {
        setKRAs(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load KRAs:', error);
    }
  };

  const loadTestCategories = async () => {
    try {
      const response = await api.get('/categories');
      if (response.success) {
        setTestCategories(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load test categories:', error);
    }
  };

  const handleOpenDialog = (kpi = null) => {
    if (kpi) {
      setEditingKPI(kpi);
      setFormData({
        kra_id: kpi.kra_id || '',
        test_category_id: kpi.test_category_id || '',
        title: kpi.title || '',
        description: kpi.description || '',
        measurement_type: kpi.measurement_type || 'percentage',
        target_value: kpi.target_value || '',
        unit: kpi.unit || '',
        frequency: kpi.frequency || 'monthly',
        weight: kpi.weight || 1.0,
        formula: kpi.formula || '',
        status: kpi.status || 'active'
      });
    } else {
      setEditingKPI(null);
      setFormData({
        kra_id: '',
        test_category_id: '',
        title: '',
        description: '',
        measurement_type: 'percentage',
        target_value: '',
        unit: '',
        frequency: 'monthly',
        weight: 1.0,
        formula: '',
        status: 'active'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingKPI(null);
  };

  const handleSubmit = async () => {
    try {
      // Prepare form data - convert empty string to null for test_category_id
      const submitData = {
        ...formData,
        test_category_id: formData.test_category_id === '' ? null : formData.test_category_id
      };
      
      if (editingKPI) {
        const response = await api.put(`/kpis/${editingKPI.id}`, submitData);
        if (response.success) {
          toast.success('KPI updated successfully');
          handleCloseDialog();
          loadKPIs();
        } else {
          toast.error(response.message || 'Failed to update KPI');
        }
      } else {
        const response = await api.post('/kpis', submitData);
        if (response.success) {
          toast.success('KPI created successfully');
          handleCloseDialog();
          loadKPIs();
        } else {
          toast.error(response.message || 'Failed to create KPI');
        }
      }
    } catch (error) {
      console.error('Save KPI error:', error);
      toast.error(error.response?.data?.message || 'Failed to save KPI');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this KPI?')) {
      try {
        await api.delete(`/kpis/${id}`);
        toast.success('KPI deleted successfully');
        loadKPIs();
      } catch (error) {
        toast.error('Failed to delete KPI');
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
          KPI Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          Create KPI
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>KRA</strong></TableCell>
              <TableCell><strong>Measurement Type</strong></TableCell>
              <TableCell><strong>Target</strong></TableCell>
              <TableCell><strong>Frequency</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {kpis.map((kpi) => (
              <TableRow key={kpi.id}>
                <TableCell>{kpi.title}</TableCell>
                <TableCell>{kpi.kra_title || 'N/A'}</TableCell>
                <TableCell>
                  {kpi.test_category_name ? (
                    <Chip label={kpi.test_category_name} color="primary" size="small" />
                  ) : (
                    <Chip label="Not Mapped" color="default" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={kpi.measurement_type} size="small" />
                </TableCell>
                <TableCell>
                  {kpi.target_value} {kpi.unit || ''}
                </TableCell>
                <TableCell>{kpi.frequency}</TableCell>
                <TableCell>
                  <Chip
                    label={kpi.status}
                    color={getStatusColor(kpi.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleOpenDialog(kpi)} title="Edit">
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(kpi.id)} color="error" title="Delete">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create New KPI'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              select
              label="KRA *"
              fullWidth
              value={formData.kra_id}
              onChange={(e) => setFormData({ ...formData, kra_id: e.target.value })}
              required
            >
              <MenuItem value="">Select KRA</MenuItem>
              {kras.map((kra) => (
                <MenuItem key={kra.id} value={kra.id}>
                  {kra.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Test Category (Required for Auto-Calculation)"
              fullWidth
              value={formData.test_category_id}
              onChange={(e) => setFormData({ ...formData, test_category_id: e.target.value })}
              helperText="Select the test category that this KPI should be calculated from. This is required for automatic KRA/KPI calculation from test results."
            >
              <MenuItem value="">-- Select Test Category --</MenuItem>
              {testCategories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title *"
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                select
                label="Measurement Type"
                fullWidth
                value={formData.measurement_type}
                onChange={(e) => setFormData({ ...formData, measurement_type: e.target.value })}
              >
                <MenuItem value="percentage">Percentage</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="currency">Currency</MenuItem>
                <MenuItem value="rating">Rating</MenuItem>
                <MenuItem value="boolean">Boolean</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </TextField>
              <TextField
                select
                label="Frequency"
                fullWidth
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Target Value"
                type="number"
                fullWidth
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
              />
              <TextField
                label="Unit"
                fullWidth
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., %, $, hours"
              />
              <TextField
                label="Weight"
                type="number"
                fullWidth
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                inputProps={{ min: 0, max: 10, step: 0.1 }}
              />
            </Box>
            <TextField
              label="Formula (Optional)"
              fullWidth
              value={formData.formula}
              onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
              placeholder="e.g., (actual/target)*100"
              helperText="Optional formula for automatic calculation"
            />
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
          <Button onClick={handleSubmit} variant="contained">
            {editingKPI ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KPIs;

