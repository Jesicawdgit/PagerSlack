export default function Badge({ variant = 'role', className = '', children }) {
  return <span className={`badge badge-${variant} ${className}`.trim()}>{children}</span>;
}
