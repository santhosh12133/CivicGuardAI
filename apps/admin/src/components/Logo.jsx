import React from "react";
import { Box } from "@mui/material";

// The CivicFix mark: a map pin with a check, as in the app icon.
const Logo = ({ size = 34, sx }) => (
  <Box component="svg" viewBox="0 0 100 100" aria-hidden sx={{ width: size, height: size, flexShrink: 0, ...sx }}>
    <rect width="100" height="100" rx="22" fill="#2563eb" />
    <g transform="translate(14 12) scale(0.72)">
      <path d="M50 8C32.3 8 18 22.3 18 40c0 24 32 52 32 52s32-28 32-52C82 22.3 67.7 8 50 8z" fill="#fff" />
      <path d="M37 40.5l9 9 17-18" fill="none" stroke="#2563eb" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </Box>
);

export default Logo;
