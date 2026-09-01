import { useAuth } from '../hooks/useAuth';
import DemoServiceCard from '../components/demo/DemoServiceCard';

export default function Workspace() {
  const { user } = useAuth();

  if (!user.team) {
    return (
      <div className="d-flex align-items-center justify-content-center p-4" style={{ minHeight: '100vh' }}>
        <p className="text-secondary">
          You're not on a team yet. Contact an admin, or re-register — new accounts join the
          Engineering team automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-4 gap-4" style={{ minHeight: '100vh' }}>
      <DemoServiceCard />
      <p className="text-secondary">Select a channel from the sidebar.</p>
    </div>
  );
}
