import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  LinearProgress,
  Stack,
  Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { issuesAPI } from "../api/api";
import { useCategories } from "../categories";

const formatHours = (hours) => {
  if (hours === null || hours === undefined) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
};

const StatCard = ({ label, value, hint, color, onClick }) => (
  <Paper
    variant="outlined"
    onClick={onClick}
    role={onClick ? "button" : undefined}
    aria-label={`${label}: ${value}`}
    sx={{ p: 2, borderRadius: 2, cursor: onClick ? "pointer" : "default", "&:hover": onClick ? { borderColor: "primary.main" } : {} }}
  >
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h4" sx={{ fontWeight: 700, color: color || "text.primary" }} data-testid={`stat-${label}`}>
      {value}
    </Typography>
    {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
  </Paper>
);

const Overview = () => {
  const navigate = useNavigate();
  const categories = useCategories();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    issuesAPI
      .stats()
      .then(setStats)
      .catch((err) => setError(err.response?.data?.message || err.message || "Failed to load statistics"));
  }, []);

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!stats) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;

  const goToIssues = (params = {}) => navigate(`/issues?${new URLSearchParams(params)}`);
  const maxCategory = Math.max(1, ...Object.values(stats.byCategory));
  const sortedCategories = [...categories].sort(
    (a, b) => (stats.byCategory[b.id] || 0) - (stats.byCategory[a.id] || 0)
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">Overview</Typography>
        <Button variant="contained" onClick={() => goToIssues()}>View all issues</Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 2, mb: 3 }}>
        <StatCard label="Total issues" value={stats.total} onClick={() => goToIssues()} />
        <StatCard label="Open" value={stats.byStatus.Open} color="warning.main" onClick={() => goToIssues({ status: "Open" })} />
        <StatCard label="In Progress" value={stats.byStatus["In Progress"]} color="info.main" onClick={() => goToIssues({ status: "In Progress" })} />
        <StatCard label="Resolved" value={stats.byStatus.Resolved} color="success.main" onClick={() => goToIssues({ status: "Resolved" })} />
        <StatCard label="Needs review" value={stats.needsReview} color="error.main" hint="Unresolved, evidence unverified" onClick={() => goToIssues({ review: "1" })} />
        <StatCard label="Overdue" value={stats.overdue} hint="Unresolved for over 7 days" />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Last 7 days</Typography>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="body2" color="text.secondary">Reported</Typography>
              <Typography variant="h5" data-testid="stat-reported-7d">{stats.last7Days.reported}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Resolved</Typography>
              <Typography variant="h5" data-testid="stat-resolved-7d">{stats.last7Days.resolved}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Average time to resolve (all time)</Typography>
              <Typography variant="h5" data-testid="stat-avg-resolution">{formatHours(stats.avgResolutionHours)}</Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Issues by category</Typography>
          <Stack spacing={1.25}>
            {sortedCategories.map((category) => {
              const count = stats.byCategory[category.id] || 0;
              return (
                <Box
                  key={category.id}
                  onClick={() => goToIssues({ category: category.id })}
                  sx={{ cursor: "pointer" }}
                  aria-label={`${category.label}: ${count}`}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{category.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{count}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={(count / maxCategory) * 100} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
              );
            })}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default Overview;
