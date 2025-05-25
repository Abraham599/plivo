import type { ServiceStatus } from '../stores/serviceStore';

export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'scheduled';

// Helper to format status display names for Services
export const formatServiceStatusDisplayName = (status: ServiceStatus): string => {
  switch (status) {
    case "operational":
      return "Operational";
    case "maintenance":
      return "Under Maintenance";
    case "degraded":
      return "Degraded Performance";
    case "partial_outage":
      return "Partial Outage";
    case "major_outage":
      return "Major Outage";
    default:
      return "Unknown";
  }
};

// Helper to format status display names for Incidents
export const formatIncidentStatusDisplayName = (status: IncidentStatus): string => {
  switch (status) {
    case "investigating":
      return "Investigating";
    case "identified":
      return "Identified";
    case "monitoring":
      return "Monitoring";
    case "resolved":
      return "Resolved";
    case "scheduled":
      return "Scheduled";
    default:
      return "Unknown";
  }
};
