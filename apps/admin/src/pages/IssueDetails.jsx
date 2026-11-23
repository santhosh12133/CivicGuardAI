import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  CardMedia,
  Stack,
  Divider,
} from "@mui/material";
import BackIcon from "@mui/icons-material/ArrowBack";
import UploadIcon from "@mui/icons-material/CloudUpload";
import { issuesAPI } from "../api/api";
import { useCategories, categoryLabel, STATUS_COLORS, STATUSES, PRIORITIES, priorityOf, formatDay, currentUser } from "../categories";
import IssueMap from "../components/IssueMap";

const Field = ({ label, children }) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
      {label}
    </Typography>
    {children}
  </Box>
);

const describeUpdate = (update) => {
  if (update.from_status === null && update.to_status === "Open") return "Reported";
  if (update.to_status) return `${update.from_status || "?"} → ${update.to_status}`;
  if (update.photo_url && !update.note) return "Photo added";
  return "Note";
};

const authorText = (author) => {
  if (!author) return "Removed account";
  const role = { citizen: "Citizen", staff: "Staff", admin: "Admin" }[author.role] || author.role;
  return author.name ? `${author.name} (${role})` : role;
};

const Timeline = ({ updates }) => (
  <Stack spacing={1.5} component="ol" sx={{ listStyle: "none", p: 0, m: 0 }} aria-label="Timeline">
    {updates.map((update) => (
      <Box component="li" key={update.id} sx={{ borderLeft: "3px solid", borderColor: STATUS_COLORS[update.to_status] ? `${STATUS_COLORS[update.to_status]}.main` : "divider", pl: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{describeUpdate(update)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(update.created_at).toLocaleString()} · {authorText(update.author)}
          </Typography>
        </Stack>
        {update.note && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{update.note}</Typography>}
        {update.photo_url && (
          <Box component="img" src={update.photo_url} alt="Update photo" sx={{ mt: 1, maxWidth: 220, borderRadius: 1 }} />
        )}
      </Box>
    ))}
  </Stack>
);

// Internal triage: who handles the issue, how urgent it is, and by when. Not shown to citizens.
const TriageCard = ({ issue, onSaved, onError }) => {
  const [assignees, setAssignees] = useState([]);
  const [assignedTo, setAssignedTo] = useState(issue.assignee?.id || "");
  const [priority, setPriority] = useState(issue.priority || "normal");
  const [dueDate, setDueDate] = useState(issue.due_date || "");
  const [saving, setSaving] = useState(false);
  const myId = currentUser()?.id;

  useEffect(() => {
    issuesAPI.assignees().then(setAssignees).catch(() => {});
  }, []);
  useEffect(() => {
    setAssignedTo(issue.assignee?.id || "");
    setPriority(issue.priority || "normal");
    setDueDate(issue.due_date || "");
  }, [issue]);

  const changes = {
    ...(assignedTo !== (issue.assignee?.id || "") && { assigned_to: assignedTo || null }),
    ...(priority !== (issue.priority || "normal") && { priority }),
    ...(dueDate !== (issue.due_date || "") && { due_date: dueDate || null }),
  };
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    try {
      setSaving(true);
      onSaved(await issuesAPI.update(issue.id, changes), "Assignment saved.");
    } catch (err) {
      onError(err.response?.data?.message || err.message || "Failed to save the assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Assignment and priority</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Internal: citizens don&apos;t see this.</Typography>
        <Stack spacing={2}>
          <TextField select label="Assigned to" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} fullWidth>
            <MenuItem value="">Unassigned</MenuItem>
            {assignees.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.id === myId ? `${a.name} (me)` : a.name}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {PRIORITIES.map((p) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
            </TextField>
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            {assignedTo !== myId && (
              <Button variant="outlined" onClick={() => setAssignedTo(myId)} disabled={!myId}>Assign to me</Button>
            )}
            <Button variant="contained" onClick={save} disabled={saving || !dirty} sx={{ flexGrow: 1 }}>
              {saving ? <CircularProgress size={20} /> : "Save assignment"}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

const IssueDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const categories = useCategories();
  const [issue, setIssue] = useState(null);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const applyIssue = (data) => {
    setIssue(data);
    setStatus(data.status);
    setCategory(data.category || "other");
  };

  const fetchIssue = async () => {
    try {
      setLoading(true);
      applyIssue(await issuesAPI.getById(id));
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch issue");
    } finally {
      setLoading(false);
    }
  };

  // Reload when the route's issue id changes; fetchIssue only uses state setters.
  useEffect(() => {
    fetchIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const errorMessage = (err, fallback) =>
    err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || err.message || fallback;

  const changes = {
    ...(status !== issue?.status && { status }),
    ...(category !== (issue?.category || "other") && { category }),
    ...(note.trim() && { note: note.trim() }),
  };
  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async () => {
    try {
      setUpdating(true);
      setSaved("");
      applyIssue(await issuesAPI.update(id, changes));
      setNote("");
      setError("");
      setSaved("Update saved. The citizen can see it in the app.");
    } catch (err) {
      setError(errorMessage(err, "Failed to save the update"));
    } finally {
      setUpdating(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile) return;
    try {
      setUpdating(true);
      setSaved("");
      // Sending the status stores this as the resolution photo when Resolved.
      await issuesAPI.uploadImage(id, selectedFile, { status, ...(note.trim() && { note: note.trim() }) });
      await fetchIssue();
      setSelectedFile(null);
      setPreviewUrl("");
      setNote("");
      setError("");
      setSaved("Photo uploaded.");
    } catch (err) {
      setError(errorMessage(err, "Failed to upload image"));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!issue) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || "Issue not found"}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate("/issues")} sx={{ mt: 2 }}>
          Back to issues
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate("/issues")} sx={{ mr: 2 }}>
          Back to issues
        </Button>
        <Typography variant="h4" component="h1">
          Issue Details
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>{saved}</Alert>}

      {issue.needs_review && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>This issue requires manual review.</strong> The photo could not be fully verified (missing
          metadata, no timezone, or very similar to an earlier report). Check the image and location before acting.
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2, alignItems: "start" }}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              {issue.title}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: "wrap", gap: 1 }}>
              <Chip label={issue.status} color={STATUS_COLORS[issue.status] || "default"} />
              <Chip label={categoryLabel(categories, issue.category)} variant="outlined" />
              <Chip
                label={issue.needs_review ? "Needs Manual Review" : "Verified"}
                color={issue.needs_review ? "error" : "success"}
                variant={issue.needs_review ? "filled" : "outlined"}
              />
              {issue.priority && issue.priority !== "normal" && (
                <Chip label={`${priorityOf(issue.priority).label} priority`} color={priorityOf(issue.priority).color} />
              )}
              {issue.is_overdue && (
                <Chip label={issue.due_date ? `Overdue (due ${formatDay(issue.due_date)})` : "Overdue"} color="error" variant="outlined" />
              )}
            </Stack>

            <Field label="Description">
              <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{issue.description}</Typography>
            </Field>

            <Field label="Reported by">
              {issue.reporter ? (
                <Typography variant="body1">
                  {issue.reporter.name} · <a href={`mailto:${issue.reporter.email}`}>{issue.reporter.email}</a>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">Unknown (older report or removed account)</Typography>
              )}
            </Field>

            {issue.address && (
              <Field label="Address">
                <Typography variant="body1">{issue.address}</Typography>
              </Field>
            )}

            <Field label="Location">
              <IssueMap issues={[issue]} categories={categories} height={260} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {issue.latitude}, {issue.longitude} ·{" "}
                <a href={`https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`} target="_blank" rel="noreferrer">
                  Open in Google Maps
                </a>
              </Typography>
            </Field>

            <Field label="Reported on">
              <Typography variant="body2" color="text.secondary">
                {new Date(issue.created_at || issue.createdAt).toLocaleString()}
              </Typography>
            </Field>

            {issue.photo_url && (
              <Field label="Issue photo">
                <CardMedia component="img" image={issue.photo_url} alt="Issue" sx={{ width: "100%", borderRadius: 1, objectFit: "contain" }} />
              </Field>
            )}
            {issue.resolved_photo_url && (
              <Field label="Resolution photo">
                <CardMedia component="img" image={issue.resolved_photo_url} alt="Resolved" sx={{ width: "100%", borderRadius: 1, objectFit: "contain" }} />
              </Field>
            )}
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <TriageCard
            issue={issue}
            onSaved={(data, message) => {
              applyIssue(data);
              setError("");
              setSaved(message);
            }}
            onError={(message) => {
              setSaved("");
              setError(message);
            }}
          />
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Update this issue</Typography>
              <Stack spacing={2}>
                <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} fullWidth>
                  {STATUSES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </TextField>
                <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
                  {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
                </TextField>
                <TextField
                  label="Note for the citizen (optional)"
                  placeholder="e.g. Crew scheduled for Monday"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  multiline
                  minRows={3}
                  inputProps={{ maxLength: 1000 }}
                  helperText={`${note.length}/1000`}
                  fullWidth
                />
                <Button variant="contained" onClick={handleSave} disabled={updating || !hasChanges}>
                  {updating ? <CircularProgress size={20} /> : "Save update"}
                </Button>
              </Stack>

              {status === "Resolved" && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Resolution photo
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                    <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
                      Select image
                      <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} aria-label="Resolution photo file" />
                    </Button>
                    {selectedFile && (
                      <>
                        <Typography variant="body2" color="text.secondary">{selectedFile.name}</Typography>
                        <Button variant="contained" onClick={handleImageUpload} disabled={updating}>
                          {updating ? <CircularProgress size={20} /> : "Upload"}
                        </Button>
                      </>
                    )}
                  </Box>
                  {previewUrl && (
                    <Box component="img" src={previewUrl} alt="Preview" sx={{ mt: 2, maxWidth: 300, borderRadius: 1 }} />
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Timeline</Typography>
              {issue.updates?.length ? (
                <Timeline updates={issue.updates} />
              ) : (
                <Typography variant="body2" color="text.secondary">No updates yet.</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};

export default IssueDetails;
