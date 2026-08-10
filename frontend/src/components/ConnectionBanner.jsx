export default function ConnectionBanner({ connected }) {
  if (connected) return null;
  return (
    <div className="custom-banner text-center">
      <i className="bi bi-wifi-off me-1" />
      Reconnecting to server... messages will be sent once you're back online.
    </div>
  );
}
