import { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert,
  Container,
  useTheme,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { fetchPublic } from "@/api/fetch";
import { queryClient } from "@/api/queryClient";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "@/features/auth/hooks/useAuth";

const Login = () => {
  const { setAuth, persist, setPersist } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";
  const theme = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      const data = await fetchPublic("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const accessToken = data?.accessToken;

      // A previous session may have expired without logging out; don't show its cached data.
      queryClient.clear();
      setAuth({ username, accessToken });
      setUsername("");
      setPassword("");

      navigate(from, { replace: true });
    } catch (err) {
      if (!err?.response) {
        setError("No Server Response");
      } else if (err.response?.status === 400) {
        setError("Missing Username or Password");
      } else if (err.response?.status === 401) {
        setError("Unauthorized");
      } else {
        setError("Login Failed");
      }
    }
  };

  const togglePersist = () => {
    setPersist((prev) => !prev);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.palette.background.default,
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <VerifiedUserIcon
            sx={{
              fontSize: 80,
              mb: 3,
              color: theme.palette.text.primary,
            }}
          />

          <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              label="Username"
              placeholder="Enter username..."
              variant="outlined"
              fullWidth
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              sx={{ mb: 3 }}
            />

            <TextField
              label="Password"
              placeholder="Enter password..."
              type="password"
              variant="outlined"
              fullWidth
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              sx={{ mb: 4 }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              sx={{ py: 1.5, fontSize: "1.1rem", mb: 2 }}
            >
              Sign In
            </Button>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={persist}
                    onChange={togglePersist}
                    color="primary"
                  />
                }
                label="Trust this device"
                sx={{ color: theme.palette.text.secondary }}
              />
              <Box
                textAlign={{ xs: "left", sm: "right" }}
                mt={{ xs: 1, sm: 0 }}
              >
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                >
                  Secured with <strong>macoAuth</strong>
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                >
                  using love & kittens
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
