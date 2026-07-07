import React, { useState } from 'react';
import {
  useTheme,
  useMediaQuery,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import {
  LayoutDashboard as DashboardIcon,
  Users as PeopleIcon,
  Database as StorageIcon,
  ShieldCheck as SecurityIcon,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import DashboardOverview from './DashboardOverview';
import ModernDataTable, { type TableColumn } from './ModernDataTable';

// Sample data for demonstration
interface SampleData {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  role: string;
  lastLogin: string;
}

const sampleData: SampleData[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    role: 'admin',
    lastLogin: '2024-01-15',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'inactive',
    role: 'user',
    lastLogin: '2024-01-10',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob@example.com',
    status: 'active',
    role: 'user',
    lastLogin: '2024-01-20',
  },
  {
    id: 4,
    name: 'Alice Brown',
    email: 'alice@example.com',
    status: 'active',
    role: 'moderator',
    lastLogin: '2024-01-18',
  },
  {
    id: 5,
    name: 'Charlie Wilson',
    email: 'charlie@example.com',
    status: 'inactive',
    role: 'user',
    lastLogin: '2024-01-05',
  },
];

const columns: TableColumn<SampleData>[] = [
  {
    id: 'name',
    label: 'Name',
    sortable: true,
    filterable: true,
    minWidth: 150,
  },
  {
    id: 'email',
    label: 'Email',
    sortable: true,
    filterable: true,
    minWidth: 200,
  },
  {
    id: 'status',
    label: 'Status',
    sortable: true,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
    render: (value) => (
      <span 
        style={{ 
          color: value === 'active' ? 'var(--admin-success)' : 'var(--admin-error)',
          fontWeight: 'var(--admin-font-weight-medium)',
        }}
      >
        {value}
      </span>
    ),
  },
  {
    id: 'role',
    label: 'Role',
    sortable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: [
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
      { value: 'moderator', label: 'Moderator' },
    ],
  },
  {
    id: 'lastLogin',
    label: 'Last Login',
    sortable: true,
    format: (value) => new Date(value).toLocaleDateString(),
  },
];

const ResponsiveDemo: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [currentSection, setCurrentSection] = useState('dashboard');

  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
  };

  const handleLogout = () => {
    console.log('Logout clicked');
  };

  const handleRowClick = (row: SampleData) => {
    console.log('Row clicked:', row);
  };

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return (
          <DashboardOverview
            metrics={[
              {
                title: 'Total Users',
                value: sampleData.length,
                status: 'info',
                trend: 'up',
                description: 'Registered users in system',
                icon: <PeopleIcon />,
              },
              {
                title: 'Active Sessions',
                value: sampleData.filter(u => u.status === 'active').length,
                status: 'healthy',
                trend: 'stable',
                description: 'Currently active users',
                icon: <DashboardIcon />,
              },
              {
                title: 'Storage Used',
                value: '67%',
                status: 'warning',
                trend: 'up',
                description: 'Database storage utilization',
                icon: <StorageIcon />,
              },
              {
                title: 'Security Score',
                value: '98%',
                status: 'healthy',
                trend: 'stable',
                description: 'Overall security rating',
                icon: <SecurityIcon />,
              },
            ]}
            alerts={[
              {
                id: '1',
                title: 'High Storage Usage',
                message: 'Database storage is approaching capacity limits',
                severity: 'warning',
                timestamp: new Date(),
              },
              {
                id: '2',
                title: 'Security Update Available',
                message: 'New security patches are available for installation',
                severity: 'info',
                timestamp: new Date(Date.now() - 3600000),
              },
            ]}
          />
        );
      
      case 'active-sessions':
        return (
          <Box>
            <Typography variant="h4" gutterBottom>
              Active Sessions
            </Typography>
            <ModernDataTable
              data={sampleData}
              columns={columns}
              onRowClick={handleRowClick}
              searchable={true}
              filterable={true}
              searchPlaceholder="Search users..."
              emptyMessage="No active sessions found"
            />
          </Box>
        );
      
      default:
        return (
          <Box>
            <Typography variant="h4" gutterBottom>
              {currentSection.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Typography>
            <Card>
              <CardContent>
                <Typography variant="body1">
                  This is a placeholder for the {currentSection} section.
                </Typography>
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    Current viewport: {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        );
    }
  };

  return (
    <AdminLayout
      currentSection={currentSection}
      onSectionChange={handleSectionChange}
      breadcrumbs={[
        { label: 'Admin', icon: <DashboardIcon /> },
        { label: currentSection.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) },
      ]}
      user={{
        username: 'admin',
        role: 'Administrator',
        lastLogin: new Date(),
      }}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default ResponsiveDemo;