import { MissionsGrowExperience } from './MissionsGrowExperience';

/** Hill climb / pulse panels for the Journey page (tabs or bottom sheet). */
export function JourneyHillClimbSection({
  dashboardHills,
  growChallenge,
  onAfterMissionComplete,
  journeyView = null,
  sheetHillCode = null,
}) {
  return (
    <MissionsGrowExperience
      dashboardHills={dashboardHills}
      growChallenge={growChallenge}
      embeddedInJourney
      journeyView={journeyView}
      sheetHillCode={sheetHillCode}
      onAfterMissionComplete={onAfterMissionComplete}
    />
  );
}
