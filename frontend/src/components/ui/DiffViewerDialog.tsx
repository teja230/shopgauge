import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface DiffViewerDialogProps {
  open: boolean;
  onClose: () => void;
  before: string;
  after: string;
  title?: string;
}

const DiffViewerDialog: React.FC<DiffViewerDialogProps> = ({ open, onClose, before, after, title }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ m: 0, p: 2 }}>
        {title || 'Change Details'}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
          <Paper sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
            <Typography variant="subtitle2" color="error" sx={{ mb: 1, fontWeight: 600 }}>
              Before
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {before || '(empty)'}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <Typography variant="subtitle2" color="success.main" sx={{ mb: 1, fontWeight: 600 }}>
              After
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {after || '(empty)'}
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default DiffViewerDialog; 