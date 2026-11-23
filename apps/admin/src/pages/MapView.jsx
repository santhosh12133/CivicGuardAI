import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { issuesAPI } from "../api/api";
import IssueMap from "../components/IssueMap";
import { useCategories, STATUSES } from "../categories";
import { STATUS_HEX } from "../theme/theme";

const Legend = () => (
  <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }} aria-label="Legend">
    {STATUSES.map((status) => (
      <Stack key={status} direction="row" spacing={0.75} alignItems="center">
        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: STATUS_HEX[status], border: "2px solid #fff", boxShadow: 1 }} />
        <Typography variant="caption">{status}</Typography>
      </Stack>
    ))}
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 14, height: 14, borderRadius: "50%", border: 3, borderColor: "error.main" }} />
      <Typography variant="caption">Urgent</Typography>
    </Stack>
  </Stack>
);

const MapView = () => {
  const navigate = useNavigate();
  const categories = useCategories();
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("unresolved");
  const [category, setCategory] = useState("");

  useEffect(() => {
    issuesAPI
      .getAll()
      .then((list) => setIssues(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.response?.data?.message || err.message || "Failed to load issues"));
  }, []);

  const shown = useMemo(
    () =>
      (issues || []).filter((issue) => {
        if (status === "unresolved" && issue.status === "Resolved") return false;
        if (STATUSES.includes(status) && issue.status !== status) return false;
        if (category && issue.category !== category) return false;
        return true;
      }),
    [issues, status, category]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} sx={{ mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1">Map</Typography>
          <Typography variant="body2" color="text.secondary" data-testid="map-count">
            {issues ? `Showing ${shown.length} of ${issues.length} issues` : "Loading issues…"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }} alignItems="center">
          <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => v && setStatus(v)} aria-label="Status">
            <ToggleButton value="unresolved">Unresolved</ToggleButton>
            {STATUSES.map((s) => <ToggleButton key={s} value={s}>{s}</ToggleButton>)}
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>
          <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="">All categories</MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
          </TextField>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!issues && !error ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <IssueMap
            issues={shown}
            categories={categories}
            height="calc(100vh - 250px)"
            onOpen={(id) => navigate(`/issue/${id}`)}
          />
          <Box sx={{ mt: 1.5 }}><Legend /></Box>
        </>
      )}
    </Box>
  );
};

export default MapView;
