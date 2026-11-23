const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toDate = (value) => (value ? new Date(value) : null);

/** "12 Nov" this year, "12 Nov 2025" otherwise. */
export const shortDate = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? "" : ` ${date.getFullYear()}`}`;
};

const pad = (n) => String(n).padStart(2, "0");

/** "12 Nov, 14:05". */
export const dateTime = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${shortDate(date)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", then the date. */
export const timeAgo = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return shortDate(date);
};
