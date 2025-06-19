import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Snackbar
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { fetchWithAuth } from '../api';

interface Secret {
  key: string;
  value: string;
}

const AdminPage: React.FC = () => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSecrets = async () => {
    try {
      const response = await fetchWithAuth('/api/admin/secrets');
      const data = await response.json();
      setSecrets(data);
    } catch (err) {
      setError('Failed to fetch secrets');
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, []);

  const handleAddSecret = async () => {
    try {
      await fetchWithAuth('/api/admin/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      setNewKey('');
      setNewValue('');
      setSuccess('Secret added successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to add secret');
    }
  };

  const handleDeleteSecret = async (key: string) => {
    try {
      await fetchWithAuth(`/api/admin/secrets/${key}`, {
        method: 'DELETE',
      });
      setSuccess('Secret deleted successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to delete secret');
    }
  };

  const handleEditSecret = async (key: string, value: string) => {
    try {
      await fetchWithAuth('/api/admin/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });
      setEditingKey(null);
      setSuccess('Secret updated successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to update secret');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add New Secret
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            fullWidth
          />
          <TextField
            label="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            fullWidth
            type="password"
          />
          <Button
            variant="contained"
            onClick={handleAddSecret}
            disabled={!newKey || !newValue}
          >
            Add Secret
          </Button>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {secrets.map((secret) => (
              <TableRow key={secret.key}>
                <TableCell>{secret.key}</TableCell>
                <TableCell>
                  {editingKey === secret.key ? (
                    <TextField
                      value={secret.value}
                      onChange={(e) => {
                        const updatedSecrets = secrets.map((s) =>
                          s.key === secret.key ? { ...s, value: e.target.value } : s
                        );
                        setSecrets(updatedSecrets);
                      }}
                      fullWidth
                      type="password"
                    />
                  ) : (
                    '••••••••'
                  )}
                </TableCell>
                <TableCell>
                  {editingKey === secret.key ? (
                    <>
                      <IconButton
                        onClick={() => handleEditSecret(secret.key, secret.value)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => setEditingKey(null)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton
                        onClick={() => setEditingKey(secret.key)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDeleteSecret(secret.key)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPage; 