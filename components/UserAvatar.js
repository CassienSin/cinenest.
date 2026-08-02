export default function UserAvatar({ avatarUrl, username, size = 22 }) {
  const initial = (username || "?").charAt(0).toUpperCase();

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2A3341] text-text"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.45),
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}