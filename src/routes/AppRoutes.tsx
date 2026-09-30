import { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AdminModuleGuard from "@/components/AdminModuleGuard";
import { lazyPage } from "@/lib/lazyPage";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";

const AnalysisCharges = lazyPage(() => import("@/pages/AnalysisCharges"));
const Publications = lazyPage(() => import("@/pages/Publications"));
const Auth = lazyPage(() => import("@/pages/Auth"));
const LoginRedirect = lazyPage(() => import("@/pages/LoginRedirect"));
const AuthCallback = lazyPage(() => import("@/pages/AuthCallback"));
const EmailVerificationCallback = lazyPage(() => import("@/pages/EmailVerificationCallback"));
const SelfVerify = lazyPage(() => import("@/pages/SelfVerify"));
const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
const ProformaInvoice = lazyPage(() => import("@/pages/ProformaInvoice"));
const EquipmentList = lazyPage(() => import("@/pages/EquipmentList"));
const BookEquipment = lazyPage(() => import("@/pages/BookEquipment"));
const BookingPayment = lazyPage(() => import("@/pages/BookingPayment"));
const BookingNextSteps = lazyPage(() => import("@/pages/BookingNextSteps"));
const MyBookings = lazyPage(() => import("@/pages/MyBookings"));
const BookingManagement = lazyPage(() => import("@/pages/BookingManagement"));
const UrgentRequests = lazyPage(() => import("@/pages/UrgentRequests"));
const RepeatSampleRequests = lazyPage(() => import("@/pages/RepeatSampleRequests"));
const UrgentRequestsWallet = lazyPage(() => import("@/pages/UrgentRequestsWallet"));
const MyUrgentRequests = lazyPage(() => import("@/pages/MyUrgentRequests"));
const MyPublications = lazyPage(() => import("@/pages/MyPublications"));
const PublicationClaimsReview = lazyPage(() => import("@/pages/PublicationClaimsReview"));
const StudentManagement = lazyPage(() => import("@/pages/StudentManagement"));
const BookingAttemptLogs = lazyPage(() => import("@/pages/BookingAttemptLogs"));
const EquipmentWaitlist = lazyPage(() => import("@/pages/EquipmentWaitlist"));
const TemporaryOIC = lazyPage(() => import("@/pages/TemporaryOIC"));
const LeaveManagement = lazyPage(() => import("@/pages/LeaveManagement"));
const OICLeaveManagement = lazyPage(() => import("@/pages/OICLeaveManagement"));
const TeamCalendar = lazyPage(() => import("@/pages/TeamCalendar"));
const TANominationCall = lazyPage(() => import("@/pages/TANominationCall"));
const TANominationsLog = lazyPage(() => import("@/pages/TANominationsLog"));
const MyNominationRequests = lazyPage(() => import("@/pages/MyNominationRequests"));
const TAAssignments = lazyPage(() => import("@/pages/TAAssignments"));
const Wallet = lazyPage(() => import("@/pages/Wallet"));
const WalletPeerTransfer = lazyPage(() => import("@/pages/WalletPeerTransfer"));
const WalletCreditFacilityRequest = lazyPage(() => import("@/pages/WalletCreditFacilityRequest"));
const AdminWalletCreditManagement = lazyPage(() => import("@/pages/AdminWalletCreditManagement"));
const IdentityAdministration = lazyPage(() => import("@/pages/IdentityAdministration"));
const AdminPortalMigration = lazyPage(() => import("@/pages/AdminPortalMigration"));
const LegacyEquipmentMapping = lazyPage(() => import("@/pages/LegacyEquipmentMapping"));
const LegacyBookingMapping = lazyPage(() => import("@/pages/LegacyBookingMapping"));
const MigrationBookingDetail = lazyPage(() => import("@/pages/MigrationBookingDetail"));
const Reports = lazyPage(() => import("@/pages/Reports"));
const ReportBookingsList = lazyPage(() => import("@/pages/ReportBookingsList"));
const AdminSection = lazyPage(() => import("@/pages/AdminSection"));
const DepartmentRbacManagement = lazyPage(() => import("@/pages/DepartmentRbacManagement"));
const DepartmentAdministrationHub = lazyPage(() => import("@/pages/DepartmentAdministrationHub"));
const DepartmentStaffManagement = lazyPage(() => import("@/pages/DepartmentStaffManagement"));
const DepartmentFacultyCreditFacility = lazyPage(() => import("@/pages/DepartmentFacultyCreditFacility"));
const AdminHeroSlides = lazyPage(() => import("@/pages/AdminHeroSlides"));
const AdminAnalysisCharges = lazyPage(() => import("@/pages/AdminAnalysisCharges"));
const ContentManagement = lazyPage(() => import("@/pages/ContentManagement"));
const AdminSettings = lazyPage(() => import("@/pages/AdminSettings"));
const AdminPanelAccessConfig = lazyPage(() => import("@/pages/AdminPanelAccessConfig"));
const AdminSettingsAuth = lazyPage(() => import("@/pages/AdminSettingsAuth"));
const AdminCommunication = lazyPage(() => import("@/pages/AdminCommunication"));
const NoticeBoardRequests = lazyPage(() => import("@/pages/NoticeBoardRequests"));
const InboxEmail = lazyPage(() => import("@/pages/InboxEmail"));
const AdminSettingsEquipment = lazyPage(() => import("@/pages/AdminSettingsEquipment"));
const AdminSemesters = lazyPage(() => import("@/pages/AdminSemesters"));
const AdminIcpmsStandards = lazyPage(() => import("@/pages/AdminIcpmsStandards"));
const AdminEquipmentModeSchedules = lazyPage(() => import("@/pages/AdminEquipmentModeSchedules"));
const AdminBookingChargeSettings = lazyPage(() => import("@/pages/AdminBookingChargeSettings"));
const AdminBookingBufferConfig = lazyPage(() => import("@/pages/AdminBookingBufferConfig"));
const AdminStudentNominations = lazyPage(() => import("@/pages/AdminStudentNominations"));
const AdminWalletSricSettings = lazyPage(() => import("@/pages/AdminWalletSricSettings"));
const AdminWalletWithdrawalRequests = lazyPage(() => import("@/pages/AdminWalletWithdrawalRequests"));
const AdminWalletCreditFacilitySettings = lazyPage(() => import("@/pages/AdminWalletCreditFacilitySettings"));
const AdminWalletStudentRechargeSettings = lazyPage(() => import("@/pages/AdminWalletStudentRechargeSettings"));
const ProposeEquipment = lazyPage(() => import("@/pages/ProposeEquipment"));
const EquipmentAdditionRequests = lazyPage(() => import("@/pages/EquipmentAdditionRequests"));
const AdminSettingsSupport = lazyPage(() => import("@/pages/AdminSettingsSupport"));
const AdminSettingsFeedback = lazyPage(() => import("@/pages/AdminSettingsFeedback"));
const AdminSettingsQualityImprovement = lazyPage(() => import("@/pages/AdminSettingsQualityImprovement"));
const AdminRewardsConfig = lazyPage(() => import("@/pages/AdminRewardsConfig"));
const OICAccessories = lazyPage(() => import("@/pages/OICAccessories"));
const OICPrintMaterials = lazyPage(() => import("@/pages/OICPrintMaterials"));
const OICEquipmentSettings = lazyPage(() => import("@/pages/OICEquipmentSettings"));
const OICMultiMode = lazyPage(() => import("@/pages/OICMultiMode"));
const CalendarColorSettings = lazyPage(() => import("@/pages/CalendarColorSettings"));
const InventoryManagement = lazyPage(() => import("@/pages/InventoryManagement"));
const RemoteAnalysis = lazyPage(() => import("@/pages/RemoteAnalysis"));
const AgentInstaller = lazyPage(() => import("@/pages/AgentInstaller"));
const RdpPathDiagnostics = lazyPage(() => import("@/pages/RdpPathDiagnostics"));
const AnalysisSoftwareCatalog = lazyPage(() => import("@/pages/AnalysisSoftwareCatalog"));
const EquipmentSoftwareMapping = lazyPage(() => import("@/pages/EquipmentSoftwareMapping"));
const DsaAgentInstaller = lazyPage(() => import("@/pages/DsaAgentInstaller"));
const DeploymentCenter = lazyPage(() => import("@/pages/DeploymentCenter"));
const DeviceProvisioning = lazyPage(() => import("@/pages/DeviceProvisioning"));
const InstallerAuth = lazyPage(() => import("@/pages/InstallerAuth"));
const LaboratoryInfrastructure = lazyPage(() => import("@/pages/LaboratoryInfrastructure"));
const TestDashboard = lazyPage(() => import("@/pages/TestDashboard"));
const AnalysisWorkspace = lazyPage(() => import("@/pages/AnalysisWorkspace"));
const AnalysisLaunch = lazyPage(() => import("@/pages/AnalysisLaunch"));
const WorkflowDesigner = lazyPage(() => import("@/pages/WorkflowDesigner"));
const DepartmentSync = lazyPage(() => import("@/pages/DepartmentSync"));
const ProcurementWorkflow = lazyPage(() => import("@/pages/ProcurementWorkflow"));
const EquipmentLifecycleHub = lazyPage(() => import("@/pages/EquipmentLifecycleHub"));
const UserManagement = lazyPage(() => import("@/pages/UserManagement"));
const SetupTestUsers = lazyPage(() => import("@/pages/SetupTestUsers"));
const Profile = lazyPage(() => import("@/pages/Profile"));
const PeriodicTable = lazyPage(() => import("@/pages/PeriodicTable"));
const IcpmsStandardsTest = lazyPage(() => import("@/pages/IcpmsStandardsTest"));
const Print3DAnalyzerTest = lazyPage(() => import("@/pages/Print3DAnalyzerTest"));
const EquipmentProfile = lazyPage(() => import("@/pages/EquipmentProfile"));
const Tickets = lazyPage(() => import("@/pages/Tickets"));
const WalletRechargeRequestAction = lazyPage(() => import("@/pages/WalletRechargeRequestAction"));
const WalletRechargeEmailAction = lazyPage(() => import("@/pages/WalletRechargeEmailAction"));
const AdminWalletRechargeRequests = lazyPage(() => import("@/pages/AdminWalletRechargeRequests"));
const WalletRechargeParse = lazyPage(() => import("@/pages/WalletRechargeParse"));
const LegacyWalletImportTest = lazyPage(() => import("@/pages/LegacyWalletImportTest"));
const LegacyUserSync = lazyPage(() => import("@/pages/LegacyUserSync"));
const CmsPageView = lazyPage(() => import("@/pages/CmsPageView"));
const ExternalUserManagement = lazyPage(() => import("@/pages/ExternalUserManagement"));
const OrganizationUsersManagement = lazyPage(() => import("@/pages/OrganizationUsersManagement"));
const ExternalDepartmentAdditionVerification = lazyPage(() => import("@/pages/ExternalDepartmentAdditionVerification"));
const UserGuidePreview = lazyPage(() => import("@/pages/UserGuidePreview"));
const AdminSettingsKnowledge = lazyPage(() => import("@/pages/AdminSettingsKnowledge"));
const AdminSettingsCopilotAnswers = lazyPage(() => import("@/pages/AdminSettingsCopilotAnswers"));
const UserGuidePage = lazyPage(() => import("@/pages/UserGuidePage"));
const ViewResults = lazyPage(() => import("@/pages/ViewResults"));
const SharedWithMe = lazyPage(() => import("@/pages/SharedWithMe"));
const MyResearch = lazyPage(() => import("@/pages/MyResearch"));
const ResearchWorkspace = lazyPage(() => import("@/pages/ResearchWorkspace"));
const ResearchGroup = lazyPage(() => import("@/pages/ResearchGroup"));
const EquipmentAvailability = lazyPage(() => import("@/pages/EquipmentAvailability"));
const BookingCalendar = lazyPage(() => import("@/pages/BookingCalendar"));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

/**
 * Shared route table for the main BrowserRouter and the dashboard in-panel MemoryRouter.
 * When embedding, omit the Dashboard route tree by not mounting this under /dashboard
 * (WorkspaceExitGuard closes the panel if /dashboard is navigated to).
 */
export default function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary fallbackTitle="This page could not be loaded" backPath="/" resetKey={pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/analysis-charges" element={<AnalysisCharges />} />
          <Route path="/publications" element={<Publications />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/verify-email" element={<EmailVerificationCallback />} />
          <Route path="/auth/self-verify" element={<SelfVerify />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/equipments" element={<EquipmentList />} />
          <Route path="/book-equipment" element={<BookEquipment />} />
          <Route path="/bookings/:bookingId/payment" element={<BookingPayment />} />
          <Route path="/bookings/:bookingId/next-steps" element={<BookingNextSteps />} />
          <Route path="/equipment/:id" element={<EquipmentProfile />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/my-results" element={<ViewResults />} />
          <Route path="/shared-data" element={<SharedWithMe />} />
          <Route path="/my-research" element={<MyResearch />} />
          <Route path="/my-research/groups/:groupId" element={<ResearchGroup />} />
          <Route path="/my-research/:workspaceId" element={<ResearchWorkspace />} />
          <Route path="/availability" element={<EquipmentAvailability />} />
          <Route path="/booking-calendar" element={<BookingCalendar />} />
          <Route path="/booking-management" element={<BookingManagement />} />
          <Route path="/urgent-requests" element={<UrgentRequests />} />
          <Route path="/repeat-sample-requests" element={<RepeatSampleRequests />} />
          <Route path="/urgent-requests-wallet" element={<UrgentRequestsWallet />} />
          <Route path="/my-urgent-requests" element={<MyUrgentRequests />} />
          <Route path="/my-publications" element={<MyPublications />} />
          <Route path="/publication-claims" element={<PublicationClaimsReview />} />
          <Route path="/student-management" element={<StudentManagement />} />
          <Route path="/booking-attempt-logs" element={<ErrorBoundary fallbackTitle="Booking Attempt Log" backPath="/dashboard"><BookingAttemptLogs /></ErrorBoundary>} />
          <Route path="/booking-attempt-logs/" element={<ErrorBoundary fallbackTitle="Booking Attempt Log" backPath="/dashboard"><BookingAttemptLogs /></ErrorBoundary>} />
          <Route path="/equipment-waitlist" element={<ErrorBoundary fallbackTitle="Equipment Waitlist" backPath="/dashboard"><EquipmentWaitlist /></ErrorBoundary>} />
          <Route path="/temporary-oic" element={<ErrorBoundary fallbackTitle="Temporary OIC" backPath="/dashboard"><TemporaryOIC /></ErrorBoundary>} />
          <Route path="/leave-management" element={<ErrorBoundary fallbackTitle="Intimate Unavailability" backPath="/dashboard"><LeaveManagement /></ErrorBoundary>} />
          <Route path="/oic-leave-management" element={<ErrorBoundary fallbackTitle="Leave Management" backPath="/dashboard"><OICLeaveManagement /></ErrorBoundary>} />
          <Route path="/team-calendar" element={<ErrorBoundary fallbackTitle="Team Calendar" backPath="/dashboard"><TeamCalendar /></ErrorBoundary>} />
          <Route path="/ta-nomination-call" element={<TANominationCall />} />
          <Route path="/ta-assignments" element={<TAAssignments />} />
          <Route path="/ta-nominations-log" element={<TANominationsLog />} />
          <Route path="/my-nomination-requests" element={<MyNominationRequests />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/wallet/transfer" element={<WalletPeerTransfer />} />
          <Route path="/wallet/credit-facility" element={<WalletCreditFacilityRequest />} />
          <Route path="/admin/wallet-credit" element={<AdminWalletCreditManagement />} />
          <Route path="/admin/wallet-credit/:facilityId" element={<AdminWalletCreditManagement />} />
          <Route path="/admin/identity" element={<IdentityAdministration />} />
          <Route path="/admin/portal-migration" element={<AdminPortalMigration />} />
          <Route path="/admin/portal-migration/equipment-mapping" element={<LegacyEquipmentMapping />} />
          <Route path="/admin/portal-migration/legacy-bookings" element={<LegacyBookingMapping />} />
          <Route
            path="/admin/portal-migration/legacy-bookings/:legacyBookingId"
            element={<MigrationBookingDetail />}
          />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/bookings" element={<ReportBookingsList />} />
          <Route path="/proforma-invoice" element={<ProformaInvoice />} />
          {/* /admin is deprecated: everything is on /dashboard */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin/external-user-management" element={<ExternalUserManagement />} />
          <Route path="/admin/section/:section" element={<AdminSection />} />
          <Route path="/admin/department-rbac" element={<DepartmentRbacManagement />} />
          <Route path="/admin/department-administration" element={<DepartmentAdministrationHub />} />
          <Route
            path="/admin/department-administration/faculty-credit-facility"
            element={<DepartmentFacultyCreditFacility />}
          />
          <Route path="/admin/department-administration/:role" element={<DepartmentStaffManagement />} />
          <Route path="/manage/external-user-management" element={<ExternalUserManagement />} />
          <Route path="/manage/external-user-management/departments" element={<ExternalDepartmentAdditionVerification />} />
          <Route path="/manage/section/:section" element={<AdminSection />} />
          <Route path="/manage/department-rbac" element={<DepartmentAdministrationHub />} />
          <Route path="/manage/department-administration" element={<DepartmentAdministrationHub />} />
          <Route
            path="/manage/department-administration/faculty-credit-facility"
            element={<DepartmentFacultyCreditFacility />}
          />
          <Route path="/manage/department-administration/:role" element={<DepartmentStaffManagement />} />
          <Route path="/organization/users" element={<OrganizationUsersManagement />} />
          <Route path="/admin/hero-slides" element={<AdminHeroSlides />} />
          <Route path="/admin/analysis-charges" element={<AdminAnalysisCharges />} />
          <Route path="/content-management" element={<ContentManagement />} />
          <Route path="/admin-settings" element={<AdminSettings />} />
          <Route path="/admin-settings/knowledge" element={<AdminSettingsKnowledge />} />
          <Route path="/admin-settings/copilot-answers" element={<AdminSettingsCopilotAnswers />} />
          <Route
            path="/admin-settings/admin-panel-access"
            element={
              <AdminModuleGuard moduleKey="admin_settings.admin_panel_access">
                <AdminPanelAccessConfig />
              </AdminModuleGuard>
            }
          />
          <Route path="/admin-settings/auth" element={<AdminSettingsAuth />} />
          <Route path="/admin-settings/communication" element={<AdminCommunication />} />
          <Route path="/notice-board-requests" element={<NoticeBoardRequests />} />
          <Route path="/admin-settings/inbox-email" element={<InboxEmail />} />
          <Route path="/admin-settings/legacy-wallet-import" element={<LegacyWalletImportTest />} />
          <Route path="/admin/legacy-user-sync" element={<LegacyUserSync />} />
          <Route path="/calendar-colors" element={<CalendarColorSettings />} />
          <Route path="/inventory-management" element={<InventoryManagement />} />
          <Route path="/remote-analysis" element={<RemoteAnalysis />} />
          <Route path="/remote-analysis/agent-installer" element={<AgentInstaller />} />
          <Route path="/remote-analysis/rdp-diagnostics" element={<RdpPathDiagnostics />} />
          <Route path="/remote-analysis/software-catalog" element={<AnalysisSoftwareCatalog />} />
          <Route path="/remote-analysis/equipment-software" element={<EquipmentSoftwareMapping />} />
          <Route path="/analysis-workspace/:bookingId" element={<AnalysisWorkspace />} />
          <Route path="/analysis-launch/:bookingId" element={<AnalysisLaunch />} />
          <Route
            path="/admin/analysis-workflows"
            element={
              <AdminModuleGuard redirectTo="/dashboard">
                <WorkflowDesigner />
              </AdminModuleGuard>
            }
          />
          <Route path="/department-sync" element={<ErrorBoundary fallbackTitle="Department Sync" backPath="/dashboard"><DepartmentSync /></ErrorBoundary>} />
          <Route path="/department-sync/agent-installer" element={<DsaAgentInstaller />} />
          <Route path="/deployment-center" element={<ErrorBoundary fallbackTitle="Deployment Center" backPath="/dashboard"><DeploymentCenter /></ErrorBoundary>} />
          <Route path="/device-provisioning" element={<ErrorBoundary fallbackTitle="Device Provisioning" backPath="/dashboard"><DeviceProvisioning /></ErrorBoundary>} />
          <Route path="/device-provisioning/pending" element={<ErrorBoundary fallbackTitle="Device Provisioning" backPath="/dashboard"><DeviceProvisioning /></ErrorBoundary>} />
          <Route path="/device-provisioning/devices" element={<ErrorBoundary fallbackTitle="Device Provisioning" backPath="/dashboard"><DeviceProvisioning /></ErrorBoundary>} />
          <Route path="/device-provisioning/installer-auth" element={<InstallerAuth />} />
          <Route path="/laboratory-infrastructure" element={<ErrorBoundary fallbackTitle="Laboratory Infrastructure" backPath="/dashboard"><LaboratoryInfrastructure /></ErrorBoundary>} />
          <Route path="/test-dashboard" element={<ErrorBoundary fallbackTitle="Test Dashboard" backPath="/dashboard"><TestDashboard /></ErrorBoundary>} />
          <Route path="/procurement-workflow" element={<ProcurementWorkflow />} />
          <Route path="/equipment-lifecycle" element={<EquipmentLifecycleHub />} />
          <Route path="/propose-equipment" element={<ProposeEquipment />} />
          <Route path="/admin/equipment-addition-requests" element={<EquipmentAdditionRequests />} />
          <Route path="/admin-settings/equipment" element={<AdminSettingsEquipment />} />
          <Route path="/admin-settings/equipment/semesters" element={<AdminSemesters />} />
          <Route path="/admin-settings/equipment/icpms-standards" element={<AdminIcpmsStandards />} />
          <Route path="/admin-settings/equipment/mode-schedules" element={<AdminEquipmentModeSchedules />} />
          <Route path="/admin-settings/equipment/booking-charge-settings" element={<AdminBookingChargeSettings />} />
          <Route path="/admin-settings/equipment/booking-buffer-config" element={<AdminBookingBufferConfig />} />
          <Route path="/admin-settings/equipment/student-nominations" element={<AdminStudentNominations />} />
          <Route path="/admin-settings/wallet-sric-settings" element={<AdminWalletSricSettings />} />
          <Route path="/admin-settings/wallet-withdrawal-requests" element={<AdminWalletWithdrawalRequests />} />
          <Route path="/admin-settings/wallet-recharge-requests" element={<AdminWalletRechargeRequests />} />
          <Route path="/admin-settings/wallet-recharge-parse" element={<WalletRechargeParse />} />
          <Route path="/admin-settings/wallet-credit-facility-settings" element={<AdminWalletCreditFacilitySettings />} />
          <Route path="/admin-settings/wallet-student-recharge-settings" element={<AdminWalletStudentRechargeSettings />} />
          <Route path="/admin-settings/support" element={<AdminSettingsSupport />} />
          <Route path="/admin-settings/feedback" element={<AdminSettingsFeedback />} />
          <Route path="/admin-settings/quality-improvement" element={<AdminSettingsQualityImprovement />} />
          <Route path="/admin-settings/rewards" element={<AdminRewardsConfig />} />
          <Route path="/oic/accessories" element={<ErrorBoundary fallbackTitle="Accessories" backPath="/dashboard"><OICAccessories /></ErrorBoundary>} />
          <Route path="/oic/print-materials" element={<ErrorBoundary fallbackTitle="3D Print Materials" backPath="/dashboard"><OICPrintMaterials /></ErrorBoundary>} />
          <Route path="/oic/quota-configurations" element={<Navigate to="/oic/equipment-settings" replace />} />
          <Route path="/oic/equipment-settings" element={<ErrorBoundary fallbackTitle="Equipment Booking Configuration" backPath="/dashboard"><OICEquipmentSettings /></ErrorBoundary>} />
          <Route path="/oic/multi-mode" element={<ErrorBoundary fallbackTitle="Multi-Mode Equipment" backPath="/dashboard"><OICMultiMode /></ErrorBoundary>} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/setup-test-users" element={<SetupTestUsers />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/periodic-table" element={<PeriodicTable />} />
          <Route path="/test/icpms-standards" element={<IcpmsStandardsTest />} />
          <Route path="/test/print3d-analyzer" element={<Print3DAnalyzerTest />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/user-guide" element={<UserGuidePage />} />
          <Route path="/dev/user-guides" element={<UserGuidePreview />} />
          <Route path="/page/:slug" element={<CmsPageView />} />
          <Route path="/wallet/recharge-action/:token" element={<WalletRechargeEmailAction />} />
          <Route path="/wallet/recharge-action/:token/:action" element={<WalletRechargeEmailAction />} />
          <Route path="/wallet/recharge-requests/:requestId" element={<WalletRechargeRequestAction />} />
          <Route path="/wallet/recharge-requests/:requestId/approve" element={<WalletRechargeRequestAction />} />
          <Route path="/wallet/recharge-requests/:requestId/reject" element={<WalletRechargeRequestAction />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
