import { DashboardProvider } from '../context/DashboardContext';
import HarvestRewardsPage from '../pages/HarvestRewardsPage';

/** Standalone Harvest Rewards page (not in bottom nav — link from GLOW when ready). */
export function HarvestShell() {
  return (
    <DashboardProvider>
      <div className="gofam-app flex min-h-dvh flex-col">
        <main className="flex-1 px-4 py-4">
          <HarvestRewardsPage />
        </main>
      </div>
    </DashboardProvider>
  );
}
