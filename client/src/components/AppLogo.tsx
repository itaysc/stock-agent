/** The app icon (public/icon.svg, the same drawing as the favicon and the home-screen icon). */
export function AppLogo({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: Math.round(size * 0.22), flexShrink: 0 }}
    />
  );
}
