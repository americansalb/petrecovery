/**
 * Report Layout - Full screen wizard that overlays the navigation
 * Uses fixed positioning to cover entire viewport including nav bar
 */

export default function ReportLayout({ children }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {children}
    </div>
  );
}
