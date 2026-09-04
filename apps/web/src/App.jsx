import { AppRoutes } from './routes';
import { AuthBootstrap } from './components/AuthBootstrap';

export default function App() {
  return (
    <AuthBootstrap>
      <AppRoutes />
    </AuthBootstrap>
  );
}
