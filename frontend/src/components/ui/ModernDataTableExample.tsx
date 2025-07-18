import React, { useState } from 'react';
import { Box, Typography, Chip, Avatar, Stack } from '@mui/material';
import { ModernDataTable } from './ModernDataTable';
import type { TableColumn, PaginationConfig, FilterState, SortState } from './ModernDataTable';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';

// Example data types
interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  role: 'admin' | 'user' | 'moderator';
  lastLogin: string;
  score: number;
  avatar?: string;
}

interface AuditLog {
  id: number;
  action: string;
  user: string;
  timestamp: string;
  details: string;
  category: 'authentication' | 'data_access' | 'system' | 'security';
  severity: 'low' | 'medium' | 'high';
}

// Sample data
const sampleUsers: User[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    status: 'active',
    role: 'admin',
    lastLogin: '2024-01-15T10:30:00Z',
    score: 95,
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    status: 'active',
    role: 'user',
    lastLogin: '2024-01-14T15:45:00Z',
    score: 87,
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    status: 'inactive',
    role: 'moderator',
    lastLogin: '2024-01-10T09:15:00Z',
    score: 92,
  },
  {
    id: 4,
    name: 'Alice Brown',
    email: 'alice.brown@example.com',
    status: 'pending',
    role: 'user',
    lastLogin: '2024-01-12T14:20:00Z',
    score: 78,
  },
  {
    id: 5,
    name: 'Charlie Wilson',
    email: 'charlie.wilson@example.com',
    status: 'active',
    role: 'user',
    lastLogin: '2024-01-16T11:00:00Z',
    score: 89,
  },
];

const sampleAuditLogs: AuditLog[] = [
  {
    id: 1,
    action: 'USER_LOGIN',
    user: 'john.doe@example.com',
    timestamp: '2024-01-15T10:30:00Z',
    details: 'Successful login from IP 192.168.1.100',
    category: 'authentication',
    severity: 'low',
  },
  {
    id: 2,
    action: 'DATA_EXPORT',
    user: 'jane.smith@example.com',
    timestamp: '2024-01-15T09:15:00Z',
    details: 'Exported user data to CSV',
    category: 'data_access',
    severity: 'medium',
  },
  {
    id: 3,
    action: 'PERMISSION_CHANGE',
    user: 'admin@example.com',
    timestamp: '2024-01-14T16:45:00Z',
    details: 'Changed user role from user to moderator',
    category: 'security',
    severity: 'high',
  },
];

// Helper functions
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'error';
    case 'pending': return 'warning';
    default: return 'default';
  }
};

const getSeverityColor = (severity: string): 'success' | 'warning' | 'error' => {
  switch (severity) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'error';
    default: return 'success';
  }
};

// User table columns
const userColumns: TableColumn<User>[] = [
  {
    id: 'name',
    label: 'User',
    minWidth: 200,
    sortable: true,
    filterable: true,
    render: (value, row) => (
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{ width: 32, height: 32 }}>
          {row.name.split(' ').map(n => n[0]).join('')}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      </Stack>
    ),
  },
  {
    id: 'status',
    label: 'Status',
    minWidth: 120,
    sortable: true,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
    render: (value) => (
      <Chip
        label={value}
        color={getStatusColor(value)}
        size="small"
        icon={value === 'active' ? <CheckCircleIcon /> : <CancelIcon />}
      />
    ),
  },
  {
    id: 'role',
    label: 'Role',
    minWidth: 120,
    sortable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: [
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
      { value: 'moderator', label: 'Moderator' },
    ],
    render: (value) => (
      <Chip
        label={value}
        variant="outlined"
        size="small"
        icon={value === 'admin' ? <AdminIcon /> : <PersonIcon />}
      />
    ),
  },
  {
    id: 'lastLogin',
    label: 'Last Login',
    minWidth: 180,
    sortable: true,
    format: formatDate,
  },
  {
    id: 'score',
    label: 'Score',
    minWidth: 100,
    align: 'right',
    sortable: true,
    format: (value) => `${value}%`,
  },
];

// Audit log columns
const auditColumns: TableColumn<AuditLog>[] = [
  {
    id: 'timestamp',
    label: 'Time',
    minWidth: 180,
    sortable: true,
    format: formatDate,
  },
  {
    id: 'action',
    label: 'Action',
    minWidth: 150,
    sortable: true,
    filterable: true,
    render: (value) => (
      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
        {value}
      </Typography>
    ),
  },
  {
    id: 'user',
    label: 'User',
    minWidth: 200,
    sortable: true,
    filterable: true,
  },
  {
    id: 'category',
    label: 'Category',
    minWidth: 120,
    sortable: true,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'authentication', label: 'Authentication' },
      { value: 'data_access', label: 'Data Access' },
      { value: 'system', label: 'System' },
      { value: 'security', label: 'Security' },
    ],
    render: (value) => (
      <Chip label={value.replace('_', ' ')} variant="outlined" size="small" />
    ),
  },
  {
    id: 'severity',
    label: 'Severity',
    minWidth: 100,
    sortable: true,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
    render: (value) => (
      <Chip
        label={value}
        color={getSeverityColor(value)}
        size="small"
        variant="filled"
      />
    ),
  },
  {
    id: 'details',
    label: 'Details',
    minWidth: 300,
    filterable: true,
  },
];

// Example component
export const ModernDataTableExample: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPage, setUserPage] = useState(0);
  const [userRowsPerPage, setUserRowsPerPage] = useState(10);
  const [userSortState, setUserSortState] = useState<SortState>({ column: null, direction: 'asc' });
  const [userFilters, setUserFilters] = useState<FilterState>({});

  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditSortState, setAuditSortState] = useState<SortState>({ column: 'timestamp', direction: 'desc' });
  const [auditFilters, setAuditFilters] = useState<FilterState>({});

  const userPagination: PaginationConfig = {
    page: userPage,
    rowsPerPage: userRowsPerPage,
    totalCount: sampleUsers.length,
    onPageChange: setUserPage,
    onRowsPerPageChange: setUserRowsPerPage,
    rowsPerPageOptions: [5, 10, 25],
  };

  const auditPagination: PaginationConfig = {
    page: auditPage,
    rowsPerPage: auditRowsPerPage,
    totalCount: sampleAuditLogs.length,
    onPageChange: setAuditPage,
    onRowsPerPageChange: setAuditRowsPerPage,
    rowsPerPageOptions: [10, 25, 50],
  };

  const handleUserRowClick = (user: User) => {
    setSelectedUser(user);
    console.log('Selected user:', user);
  };

  const handleUserSort = (column: string, direction: 'asc' | 'desc') => {
    setUserSortState({ column, direction });
    console.log('User sort:', { column, direction });
  };

  const handleUserFilter = (filters: FilterState) => {
    setUserFilters(filters);
    console.log('User filters:', filters);
  };

  const handleAuditSort = (column: string, direction: 'asc' | 'desc') => {
    setAuditSortState({ column, direction });
    console.log('Audit sort:', { column, direction });
  };

  const handleAuditFilter = (filters: FilterState) => {
    setAuditFilters(filters);
    console.log('Audit filters:', filters);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        ModernDataTable Examples
      </Typography>

      {/* Users Table */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" gutterBottom>
          Users Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Interactive table with search, filtering, sorting, and pagination. Click on rows to select users.
        </Typography>
        
        <ModernDataTable
          data={sampleUsers}
          columns={userColumns}
          searchable={true}
          filterable={true}
          pagination={userPagination}
          onRowClick={handleUserRowClick}
          stickyHeader={true}
          searchPlaceholder="Search users by name or email..."
          emptyMessage="No users found matching your criteria"
          hoverable={true}
          striped={false}
          dense={false}
          onSort={handleUserSort}
          sortState={userSortState}
          onFilter={handleUserFilter}
          filterState={userFilters}
          maxHeight={500}
        />

        {selectedUser && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
            <Typography variant="subtitle2">
              Selected User: {selectedUser.name} ({selectedUser.email})
            </Typography>
          </Box>
        )}
      </Box>

      {/* Audit Logs Table */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" gutterBottom>
          Audit Logs
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Dense table with advanced filtering and sorting. Default sorted by timestamp (newest first).
        </Typography>
        
        <ModernDataTable
          data={sampleAuditLogs}
          columns={auditColumns}
          searchable={true}
          filterable={true}
          pagination={auditPagination}
          stickyHeader={true}
          searchPlaceholder="Search audit logs..."
          emptyMessage="No audit logs found"
          hoverable={true}
          striped={true}
          dense={true}
          onSort={handleAuditSort}
          sortState={auditSortState}
          onFilter={handleAuditFilter}
          filterState={auditFilters}
          maxHeight={400}
        />
      </Box>

      {/* Loading State Example */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" gutterBottom>
          Loading State
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Skeleton loading state with proper row and column structure.
        </Typography>
        
        <ModernDataTable
          data={[]}
          columns={userColumns}
          loading={true}
          searchable={true}
          filterable={true}
        />
      </Box>

      {/* Error State Example */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" gutterBottom>
          Error State
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Error state with retry functionality.
        </Typography>
        
        <ModernDataTable
          data={[]}
          columns={userColumns}
          error="Failed to load data from server. Please check your connection."
          onRetry={() => console.log('Retry clicked')}
          searchable={true}
          filterable={true}
        />
      </Box>

      {/* Empty State Example */}
      <Box>
        <Typography variant="h5" gutterBottom>
          Empty State
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Empty state when no data is available.
        </Typography>
        
        <ModernDataTable
          data={[]}
          columns={userColumns}
          searchable={true}
          filterable={true}
          emptyMessage="No data has been added yet. Start by creating your first entry."
        />
      </Box>
    </Box>
  );
};

export default ModernDataTableExample;