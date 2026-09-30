import { useState } from "react";
import { Box, Button, Stack, useTheme, useMediaQuery } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ChainsList from "@/features/chains/components/ChainsList";
import ChainSearchBar from "@/features/chains/components/ChainSearchBar";

const ChainsPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
          gap: 2,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: { md: "400px" } }}>
          <ChainSearchBar
            handleSearchChange={(e) => setSearchTerm(e.target.value)}
          />
        </Box>
        <Stack
          direction="row"
          spacing={2}
          sx={{ width: { xs: "100%", md: "auto" } }}
        >
          <Button
            sx={{ flex: { xs: 1, md: "initial" } }}
            variant="contained"
            onClick={() => navigate("/dashboard/chain")}
            startIcon={<AddIcon />}
          >
            {isMobile ? "Chain" : "Register Chain"}
          </Button>
        </Stack>
      </Box>
      <ChainsList searchTerm={searchTerm} />
    </Box>
  );
};

export default ChainsPage;
