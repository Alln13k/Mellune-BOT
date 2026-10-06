import './globals.css';

export const metadata = {
  title: 'Mellune Console',
  description: 'A calm command center for your Discord communities.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
