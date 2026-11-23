import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { STATUS_HEX } from "../theme/theme";
import { categoryLabel, priorityOf } from "../categories";

const INDIA = [22.5, 79];

// Fits the view to the markers whenever the set of issues changes.
const FitToIssues = ({ points }) => {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 16);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
};

/**
 * OpenStreetMap with one dot per issue, coloured by status (bigger for high and urgent priority).
 * `onOpen(id)` adds an "Open issue" button to each popup.
 */
const IssueMap = ({ issues, categories = [], height = 480, onOpen, interactive = true }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const located = useMemo(
    () => issues.filter((i) => Number.isFinite(Number(i.latitude)) && Number.isFinite(Number(i.longitude))),
    [issues]
  );
  const points = located.map((i) => [Number(i.latitude), Number(i.longitude)]);

  return (
    <Box
      data-testid="issue-map"
      sx={{
        height,
        minHeight: 320,
        borderRadius: 3,
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
        "& .leaflet-container": { height: "100%", width: "100%", fontFamily: theme.typography.fontFamily, bgcolor: "background.default" },
        // Darken the map in dark mode instead of loading a second tile set.
        ...(dark && { "& .leaflet-tile": { filter: "invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)" } }),
        "& .leaflet-popup-content-wrapper, & .leaflet-popup-tip": { bgcolor: "background.paper", color: "text.primary" },
      }}
    >
      <MapContainer
        center={points[0] || INDIA}
        zoom={points.length ? 13 : 5}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          // OpenStreetMap's tile policy requires a referrer; send just the site address.
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <FitToIssues points={points} />
        {located.map((issue) => {
          const priority = priorityOf(issue.priority);
          const big = issue.priority === "high" || issue.priority === "urgent";
          return (
            <CircleMarker
              key={issue.id}
              center={[Number(issue.latitude), Number(issue.longitude)]}
              radius={big ? 11 : 8}
              pathOptions={{
                color: issue.priority === "urgent" ? theme.palette.error.main : "#ffffff",
                weight: issue.priority === "urgent" ? 3 : 2,
                fillColor: STATUS_HEX[issue.status] || theme.palette.primary.main,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <Stack spacing={0.75} sx={{ minWidth: 200 }}>
                  <Typography variant="subtitle2">{issue.title}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    <Chip size="small" label={issue.status} sx={{ bgcolor: STATUS_HEX[issue.status], color: "#fff" }} />
                    <Chip size="small" variant="outlined" label={categoryLabel(categories, issue.category)} />
                    {issue.priority && issue.priority !== "normal" && (
                      <Chip size="small" color={priority.color} label={priority.label} />
                    )}
                  </Stack>
                  {issue.address && <Typography variant="caption" color="text.secondary">{issue.address}</Typography>}
                  {onOpen && (
                    <Button size="small" variant="contained" onClick={() => onOpen(issue.id)}>Open issue</Button>
                  )}
                </Stack>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </Box>
  );
};

export default IssueMap;
