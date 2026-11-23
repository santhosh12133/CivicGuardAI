import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  MenuItem,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ViewIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate, useSearchParams } from "react-router-dom";
import { issuesAPI } from "../api/api";
import { useCategories, categoryLabel, STATUS_COLORS, currentUser } from "../categories";

const STATUSES = ["Open", "In Progress", "Resolved"];

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const categories = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Filters live in the URL so the Overview page can link to them.
  const statusFilter = searchParams.get("status") || "";
  const categoryFilter = searchParams.get("category") || "";
  const reviewOnly = searchParams.get("review") === "1";
  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  // Only admins may delete issues (the API returns 403 for staff).
  const isAdmin = currentUser()?.role === "admin";

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const response = await issuesAPI.getAll();
      setIssues(Array.isArray(response) ? response : response.issues || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to fetch issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this issue? This action cannot be undone.")) return;
    try {
      setLoading(true);
      await issuesAPI.delete(id);
      await fetchIssues();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to delete issue");
      setLoading(false);
    }
  };

  const columns = [
    {
      field: "thumb",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.photo_url ? (
          <img
            src={params.row.photo_url}
            alt=""
            style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 6, marginTop: 6 }}
          />
        ) : null,
    },
    { field: "title", headerName: "Title", flex: 1, minWidth: 200 },
    {
      field: "category",
      headerName: "Category",
      width: 150,
      renderCell: (params) => categoryLabel(categories, params.row.category),
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (params) => <Chip label={params.value} color={STATUS_COLORS[params.value] || "default"} size="small" />,
    },
    {
      field: "needs_review",
      headerName: "Review",
      width: 130,
      renderCell: (params) =>
        params.value ? (
          <Chip label="Needs Review" color="error" size="small" variant="outlined" />
        ) : (
          <Chip label="Verified" color="success" size="small" variant="outlined" />
        ),
    },
    {
      field: "reporter",
      headerName: "Reported by",
      width: 170,
      sortable: false,
      renderCell: (params) => params.row.reporter?.name || "—",
    },
    {
      field: "created_at",
      headerName: "Reported",
      width: 170,
      renderCell: (params) => formatDate(params.row.created_at || params.row.createdAt),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: isAdmin ? 210 : 110,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", height: "100%" }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<ViewIcon />}
            onClick={() => navigate(`/issue/${params.row.id}`)}
          >
            View
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(params.row.id);
              }}
            >
              Delete
            </Button>
          )}
        </Box>
      ),
    },
  ];

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (reviewOnly && !issue.needs_review) return false;
      if (statusFilter && issue.status !== statusFilter) return false;
      if (categoryFilter && issue.category !== categoryFilter) return false;
      if (!q) return true;
      return [issue.title, issue.description, issue.status, issue.address, issue.reporter?.name, categoryLabel(categories, issue.category)]
        .some((value) => (value || "").toLowerCase().includes(q));
    });
  }, [issues, search, reviewOnly, statusFilter, categoryFilter, categories]);

  const reviewCount = issues.filter((issue) => issue.needs_review).length;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4" component="h1">
          Issues
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ "aria-label": "Search issues" }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setFilter("status", e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {STATUSES.map((status) => (
              <MenuItem key={status} value={status}>{status}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Category"
            value={categoryFilter}
            onChange={(e) => setFilter("category", e.target.value)}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All categories</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>{category.label}</MenuItem>
            ))}
          </TextField>
          <Button
            variant={reviewOnly ? "contained" : "outlined"}
            color={reviewOnly ? "error" : "inherit"}
            size="small"
            onClick={() => setFilter("review", reviewOnly ? "" : "1")}
          >
            {reviewOnly ? `Needs Review (${reviewCount})` : "Show Needs Review"}
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchIssues} aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ height: 640, width: "100%" }}>
            <DataGrid
              rows={filteredIssues}
              columns={columns}
              getRowId={(row) => row.id}
              rowHeight={56}
              pageSizeOptions={[10, 25, 50]}
              disableRowSelectionOnClick
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              localeText={{ noRowsLabel: "No issues match these filters" }}
              sx={{
                border: "none",
                "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f8f9fa" },
                "& .MuiDataGrid-row:hover": { backgroundColor: "#fbfdff" },
              }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Dashboard;
