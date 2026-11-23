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
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { useNavigate } from "react-router-dom";
import { issuesAPI } from "../api/api";
import { useCategories, localDate, formatDay, PRIORITIES, STATUSES } from "../categories";
import { STATUS_HEX, PRIORITY_HEX } from "../theme/theme";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

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
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    aria-label={`${label}: ${value}`}
    sx={{
      p: 2,
      borderRadius: 3,
      position: "relative",
      overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color .15s, transform .15s",
      "&:hover": onClick ? { borderColor: "primary.main", transform: "translateY(-1px)" } : {},
      "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: color || "primary.main" },
    }}
  >
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }} data-testid={`stat-${label}`}>
      {value}
    </Typography>
    {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
  </Paper>
);

const Panel = ({ title, subtitle, action, children, sx }) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, minWidth: 0, ...sx }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5, gap: 1 }}>
      <Box>
        <Typography variant="h6" component="h2">{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Paper>
);

const Overview = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const categories = useCategories();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    setLoading(true);
    issuesAPI
      .stats({ from: localDate(from), to: localDate(to) })
      .then((data) => {
        setStats(data);
        setError("");
      })
      .catch((err) => setError(err.response?.data?.message || err.message || "Failed to load statistics"))
      .finally(() => setLoading(false));
  }, [days]);

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!stats) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;

  const goToIssues = (params = {}) => navigate(`/issues?${new URLSearchParams(params)}`);
  const maxCategory = Math.max(1, ...Object.values(stats.byCategory));
  const sortedCategories = [...categories].sort(
    (a, b) => (stats.byCategory[b.id] || 0) - (stats.byCategory[a.id] || 0)
  );
  const { range, assignment } = stats;
  const daily = range.daily;
  const statusData = STATUSES.map((status) => ({
    id: status,
    value: stats.byStatus[status] || 0,
    label: status,
    color: STATUS_HEX[status],
  }));
  const priorityCounts = PRIORITIES.map((p) => stats.unresolvedByPriority?.[p.id] || 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1">Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDay(range.from)} – {formatDay(range.to)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={days}
            onChange={(_, value) => value && setDays(value)}
            aria-label="Period"
          >
            {PERIODS.map((period) => (
              <ToggleButton key={period.days} value={period.days} sx={{ px: 1.5 }}>{period.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button variant="contained" onClick={() => goToIssues()}>View all issues</Button>
        </Stack>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 2, mb: 3 }}>
        <StatCard label="Total issues" value={stats.total} onClick={() => goToIssues()} />
        <StatCard label="Open" value={stats.byStatus.Open} color={STATUS_HEX.Open} onClick={() => goToIssues({ status: "Open" })} />
        <StatCard label="In Progress" value={stats.byStatus["In Progress"]} color={STATUS_HEX["In Progress"]} onClick={() => goToIssues({ status: "In Progress" })} />
        <StatCard label="Resolved" value={stats.byStatus.Resolved} color={STATUS_HEX.Resolved} onClick={() => goToIssues({ status: "Resolved" })} />
        <StatCard label="Needs review" value={stats.needsReview} color="error.main" hint="Unresolved, evidence unverified" onClick={() => goToIssues({ review: "1" })} />
        <StatCard label="Overdue" value={stats.overdue} color="error.main" hint="Past due date, or open 7+ days" onClick={() => goToIssues({ overdue: "1" })} />
        <StatCard label="Assigned to me" value={assignment.mine} color="secondary.main" hint="Unresolved" onClick={() => goToIssues({ assigned: "me" })} />
        <StatCard label="Unassigned" value={assignment.unassigned} color="text.secondary" hint="Unresolved, no owner" onClick={() => goToIssues({ assigned: "none" })} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2, mb: 2 }}>
        <Panel
          title="Reported vs resolved"
          subtitle={`${range.reported} reported · ${range.resolved} resolved · average time to resolve ${formatHours(range.avgResolutionHours)}`}
        >
          <Box role="img" aria-label={`Reported and resolved per day: ${range.reported} reported, ${range.resolved} resolved`} data-testid="trend-chart">
            <LineChart
              height={280}
              xAxis={[{
                scaleType: "point",
                data: daily.map((d) => d.date),
                valueFormatter: (value) => formatDay(value).replace(/ \d{4}$/, ""),
                tickLabelStyle: { fontSize: 11 },
              }]}
              yAxis={[{ min: 0, tickMinStep: 1 }]}
              series={[
                { data: daily.map((d) => d.reported), label: "Reported", color: theme.palette.primary.main, showMark: false, area: true, curve: "monotoneX" },
                { data: daily.map((d) => d.resolved), label: "Resolved", color: STATUS_HEX.Resolved, showMark: false, curve: "monotoneX" },
              ]}
              margin={{ left: 8, right: 16, top: 16, bottom: 8 }}
              sx={{ "& .MuiAreaElement-root": { fillOpacity: 0.12 } }}
            />
          </Box>
        </Panel>

        <Panel title="Last 7 days">
          <Stack spacing={2}>
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
        </Panel>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1.3fr 1fr" }, gap: 2, mb: 2 }}>
        <Panel title="By status" subtitle="All issues">
          <Box role="img" aria-label={statusData.map((s) => `${s.label} ${s.value}`).join(", ")}>
            <PieChart
              height={220}
              series={[{ data: statusData, innerRadius: 58, outerRadius: 92, paddingAngle: 2, cornerRadius: 4 }]}
              margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
            />
          </Box>
        </Panel>

        <Panel title="Issues by category" subtitle="All issues · select a row to filter">
          <Stack spacing={1.25}>
            {sortedCategories.map((category) => {
              const count = stats.byCategory[category.id] || 0;
              return (
                <Box
                  key={category.id}
                  onClick={() => goToIssues({ category: category.id })}
                  sx={{ cursor: "pointer", "&:hover .MuiTypography-root": { color: "primary.main" } }}
                  aria-label={`${category.label}: ${count}`}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{category.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{count}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={(count / maxCategory) * 100} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              );
            })}
          </Stack>
        </Panel>

        <Panel title="Open work by priority" subtitle="Unresolved issues">
          <Box role="img" aria-label={PRIORITIES.map((p, i) => `${p.label} ${priorityCounts[i]}`).join(", ")}>
            <BarChart
              height={220}
              layout="horizontal"
              yAxis={[{
                scaleType: "band",
                data: PRIORITIES.map((p) => p.label),
                width: 64,
                colorMap: { type: "ordinal", values: PRIORITIES.map((p) => p.label), colors: PRIORITIES.map((p) => PRIORITY_HEX[p.id]) },
              }]}
              xAxis={[{ min: 0, tickMinStep: 1 }]}
              series={[{ data: priorityCounts, label: "Issues" }]}
              hideLegend
              barLabel="value"
              margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
            />
          </Box>
        </Panel>
      </Box>

      <Panel title="Workload" subtitle="Unresolved issues per person">
        {assignment.byAssignee.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No issues are assigned yet. Open an issue and choose who handles it.
          </Typography>
        ) : (
          <Table size="small" aria-label="Workload">
            <TableHead>
              <TableRow>
                <TableCell>Assignee</TableCell>
                <TableCell align="right">Open</TableCell>
                <TableCell align="right">In Progress</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignment.byAssignee.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: "pointer" }} onClick={() => goToIssues({ assigned: row.id })}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{row.open}</TableCell>
                  <TableCell align="right">{row.inProgress}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{row.open + row.inProgress}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Box>
  );
};

export default Overview;
