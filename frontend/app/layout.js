import SessionProvider from './components/SessionProvider';

export const metadata = {
  title: 'PetRecovery.org - Lost Pet Recovery',
  description: 'Help find your lost pet',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
