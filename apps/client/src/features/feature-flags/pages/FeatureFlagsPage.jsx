import {
  Box,
  Typography,
  Paper,
  Switch,
  Skeleton,
  Alert,
} from "@mui/material";
import {
  useFeatureFlags,
  useToggleFeatureFlag,
} from "../hooks/useFeatureFlagQueries";

const FeatureFlagsPage = () => {
  const { data: flags, isLoading, isError } = useFeatureFlags();
  const toggleFlag = useToggleFeatureFlag();

  const handleToggle = (key, currentEnabled) => {
    toggleFlag.mutate({ key, enabled: !currentEnabled });
  };

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
          Feature Flags
        </Typography>
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={80}
            sx={{ mb: 2, borderRadius: 3 }}
          />
        ))}
      </Box>
    );
  }

  if (isError) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
          Feature Flags
        </Typography>
        <Alert severity="error">Failed to load feature flags.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
        Feature Flags
      </Typography>

      {flags?.length === 0 && (
        <Typography color="text.secondary">
          No feature flags configured.
        </Typography>
      )}

      {flags?.map((flag) => (
        <Paper
          key={flag.key}
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            mb: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {flag.key}
            </Typography>
            {flag.description && (
              <Typography variant="body2" color="text.secondary">
                {flag.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="body2"
              color={flag.enabled ? "success.main" : "text.secondary"}
              sx={{ fontWeight: 500 }}
            >
              {flag.enabled ? "Yes" : "No"}
            </Typography>
            <Switch
              checked={flag.enabled}
              onChange={() => handleToggle(flag.key, flag.enabled)}
              disabled={
                toggleFlag.isPending &&
                toggleFlag.variables?.key === flag.key
              }
              color="success"
            />
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default FeatureFlagsPage;
