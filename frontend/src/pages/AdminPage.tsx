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
  Snackbar,
  Tooltip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Edit as EditIcon, 
  Info as InfoIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { fetchWithAuth } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Secret {
  key: string;
  value: string;
}

const INTEGRATION_CONFIG = {
  'shopify.api.key': { label: 'Shopify API Key', help: 'Used for Shopify integration', icon: '🛍️' },
  'shopify.api.secret': { label: 'Shopify API Secret', help: 'Used for Shopify integration', icon: '🔐' },
  'serpapi.api.key': { label: 'SerpAPI Key', help: 'Used for competitor discovery', icon: '🔍' },
  'sendgrid.api.key': { label: 'SendGrid API Key', help: 'Used for sending email notifications', icon: '📧' },
  'twilio.account.sid': { label: 'Twilio Account SID', help: 'Used for sending SMS notifications', icon: '📱' },
  'twilio.auth.token': { label: 'Twilio Auth Token', help: 'Used for sending SMS notifications', icon: '🔑' },
};

const AdminPage: React.FC = () => {
  const { shop } = useAuth();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, setTestEmail] = useState('');
  const [, setTestSms] = useState('');
  const [, setTestResult] = useState<string | null>(null);
  const [] = useState(false);
  const [sendGridStatus, setSendGridStatus] = useState<'enabled' | 'disabled' | 'unknown'>('unknown');
  const [twilioStatus, setTwilioStatus] = useState<'enabled' | 'disabled' | 'unknown'>('unknown');
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchSecrets = async () => {
    try {
      const response = await fetchWithAuth('/api/admin/secrets');
      const data = await response.json();
      setSecrets(data);
    } catch (err) {
      setError('Failed to fetch secrets');
    }
  };

  const fetchIntegrationStatus = async () => {
    try {
      const resp = await fetchWithAuth('/api/admin/integrations/status');
      const data = await resp.json();
      setSendGridStatus(data.sendGridEnabled ? 'enabled' : 'disabled');
      setTwilioStatus(data.twilioEnabled ? 'enabled' : 'disabled');
    } catch {
      setSendGridStatus('unknown');
      setTwilioStatus('unknown');
    }
  };

  useEffect(() => {
    if (!shop) {
      setSecrets([]);
      setNewKey('');
      setNewValue('');
      setEditingKey(null);
      setError(null);
      setSuccess(null);
      setTestEmail('');
      setTestSms('');
      setTestResult(null);
      setSendGridStatus('unknown');
      setTwilioStatus('unknown');
      setShowAddForm(false);
      return;
    }
    fetchSecrets();
    fetchIntegrationStatus();
  }, [shop]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setSecrets([]);
      setNewKey('');
      setNewValue('');
      setEditingKey(null);
      setError(null);
      setSuccess(null);
      setTestEmail('');
      setTestSms('');
      setTestResult(null);
      setSendGridStatus('unknown');
      setTwilioStatus('unknown');
      setShowAddForm(false);
    };
  }, []);

  const handleAddSecret = async () => {
    try {
      await fetchWithAuth('/api/admin/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      setNewKey('');
      setNewValue('');
      setShowAddForm(false);
      setSuccess('Secret added successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to add secret');
    }
  };

  const handleDeleteSecret = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the secret "${key}"?`)) return;
    
    try {
      await fetchWithAuth(`/api/admin/secrets/${key}`, { method: 'DELETE' });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      setEditingKey(null);
      setSuccess('Secret updated successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to update secret');
    }
  };



  // Group secrets by integration
  const integrationSecrets = Object.keys(INTEGRATION_CONFIG).map(key => ({
    key,
    ...INTEGRATION_CONFIG[key as keyof typeof INTEGRATION_CONFIG],
    value: secrets.find(s => s.key === key)?.value || '',
    exists: secrets.some(s => s.key === key)
  }));
  
  const otherSecrets = secrets.filter(s => !Object.keys(INTEGRATION_CONFIG).includes(s.key));

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      {/* Integration Secrets */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">🔑 Integration Secrets</Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(!showAddForm)}
            size="small"
          >
            Add New Secret
          </Button>
        </Box>

        {showAddForm && (
          <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Add New Secret</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <TextField
                  label="Secret Key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., my.api.key"
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <TextField
                  label="Secret Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  size="small"
                  fullWidth
                  type="password"
                  placeholder="Enter secret value"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleAddSecret}
                  disabled={!newKey || !newValue}
                  size="small"
                >
                  Add
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setNewValue('');
                  }}
                  size="small"
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          </Card>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Integration</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {integrationSecrets.map((secret) => (
                <TableRow key={secret.key}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{secret.icon}</span>
                      <Typography variant="body2">{secret.label}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                      {secret.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {editingKey === secret.key ? (
                      <TextField
                        value={secret.value}
                        onChange={(e) => {
                          setSecrets(prev => prev.map(s => 
                            s.key === secret.key ? { ...s, value: e.target.value } : s
                          ));
                        }}
                        size="small"
                        type="password"
                        sx={{ minWidth: 200 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {secret.exists ? '••••••••' : 'Not set'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={secret.exists ? 'Configured' : 'Missing'} 
                      color={secret.exists ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={secret.help} placement="top">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {editingKey === secret.key ? (
                        <>
                          <IconButton
                            onClick={() => handleEditSecret(secret.key, secret.value)}
                            color="primary"
                            size="small"
                          >
                            <SaveIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            onClick={() => setEditingKey(null)}
                            color="error"
                            size="small"
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          onClick={() => setEditingKey(secret.key)}
                          color="primary"
                          size="small"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Integration Status Section (just chips, subtle) */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, color: 'text.secondary' }}>
          Integration Status
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={<EmailIcon fontSize="small" />}
            label={`SendGrid: ${sendGridStatus === 'enabled' ? 'Enabled' : 'Disabled'}`}
            color={sendGridStatus === 'enabled' ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<SmsIcon fontSize="small" />}
            label={`Twilio: ${twilioStatus === 'enabled' ? 'Enabled' : 'Disabled'}`}
            color={twilioStatus === 'enabled' ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Other Secrets */}
      {otherSecrets.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            🔧 Other Secrets
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {otherSecrets.map((secret) => (
                  <TableRow key={secret.key}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                        {secret.key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {editingKey === secret.key ? (
                        <TextField
                          value={secret.value}
                          onChange={(e) => {
                            setSecrets(prev => prev.map(s => 
                              s.key === secret.key ? { ...s, value: e.target.value } : s
                            ));
                          }}
                          size="small"
                          type="password"
                          sx={{ minWidth: 200 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          ••••••••
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {editingKey === secret.key ? (
                          <>
                            <IconButton
                              onClick={() => handleEditSecret(secret.key, secret.value)}
                              color="primary"
                              size="small"
                            >
                              <SaveIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              onClick={() => setEditingKey(null)}
                              color="error"
                              size="small"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton
                              onClick={() => setEditingKey(secret.key)}
                              color="primary"
                              size="small"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDeleteSecret(secret.key)}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Snackbar for success/error */}
      <Snackbar
        open={!!error || !!success}
        autoHideDuration={4000}
        onClose={() => {
          setError(null);
          setSuccess(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {error ? (
          <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
        ) : (
          <Alert severity="success" sx={{ width: '100%' }}>{success}</Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default AdminPage; 