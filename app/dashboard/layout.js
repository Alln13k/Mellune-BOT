import Shell from '../../components/dashboard/Shell';

export const metadata = {
  title: { template: '%s · Mellune', default: 'Dashboard · Mellune' },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }) {
  return <Shell>{children}</Shell>;
}
