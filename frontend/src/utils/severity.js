export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function severityVariant(severity) {
  return `severity-${severity.toLowerCase()}`;
}
