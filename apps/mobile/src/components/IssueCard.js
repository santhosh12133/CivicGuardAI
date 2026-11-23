import React from "react";
import { StyleSheet, Text, View } from "react-native";
import RemotePhoto from "./RemotePhoto";
import { useCategories, categoryLabel, CATEGORY_ICONS } from "../utils/categories";
import { Icon, PressableScale, ProgressTrack, StatusBadge, Tag } from "../ui/components";
import { colors, radius, space, type } from "../ui/theme";
import { timeAgo } from "../ui/time";

export const placeLine = (issue) =>
  issue.address || `${Number(issue.latitude).toFixed(4)}, ${Number(issue.longitude).toFixed(4)}`;

const IssueCard = ({ issue, onPress }) => {
  const categories = useCategories();
  // A resolved issue shows the city team's photo of the fix.
  const showsFix = issue.status === "Resolved" && Boolean(issue.resolved_photo_url);
  const photo = showsFix ? issue.resolved_photo_url : issue.photo_url;
  const icon = CATEGORY_ICONS[issue.category] || CATEGORY_ICONS.other;

  return (
    <PressableScale onPress={onPress} testID={`issue-card-${issue.id}`} style={styles.card} accessibilityLabel={issue.title}>
      {photo ? (
        <View>
          <RemotePhoto
            url={photo}
            style={styles.photo}
            compact
            accessibilityLabel={showsFix ? "Photo of the fix from the city team" : "Photo of the reported problem"}
          />
          {showsFix ? (
            <View style={styles.fixLabel}>
              <Icon name="check-decagram" size={14} color="#ffffff" />
              <Text style={styles.fixText}>Photo after the fix</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.photo, styles.noPhoto]}>
          <Icon name={icon} size={30} color={colors.faint} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <StatusBadge status={issue.status} />
          <Text style={type.micro}>{timeAgo(issue.created_at || issue.createdAt)}</Text>
        </View>
        <Text style={[type.heading, styles.title]} numberOfLines={2}>{issue.title}</Text>
        {issue.description ? (
          <Text style={[type.body, styles.description]} numberOfLines={2}>{issue.description}</Text>
        ) : null}
        <ProgressTrack status={issue.status} compact />
        <View style={styles.footer}>
          <Tag icon={icon}>{categoryLabel(categories, issue.category)}</Tag>
          {issue.is_mine ? <Tag tone="brand" icon="account-outline">Your report</Tag> : null}
        </View>
        <View style={styles.place}>
          <Icon name="map-marker-outline" size={15} color={colors.faint} />
          <Text style={[type.caption, styles.placeText]} numberOfLines={1}>{placeLine(issue)}</Text>
        </View>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginBottom: space.md + 2,
  },
  photo: { width: "100%", aspectRatio: 16 / 9 },
  noPhoto: { backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", aspectRatio: 3 },
  fixLabel: {
    position: "absolute",
    left: space.md,
    bottom: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(21,128,61,0.92)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fixText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  body: { padding: space.lg, gap: space.sm + 2 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { marginTop: 2 },
  description: { color: colors.muted, marginTop: -4 },
  footer: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 2 },
  place: { flexDirection: "row", alignItems: "center", gap: 4 },
  placeText: { flex: 1 },
});

export default IssueCard;
