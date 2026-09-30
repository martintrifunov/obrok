import { useState } from "react";
import { Box, Button, useTheme, useMediaQuery } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import MarketsList from "@/features/markets/components/MarketsList";
import MarketSearchBar from "@/features/markets/components/MarketSearchBar";

const MarketsPage = () => {
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
          <MarketSearchBar
            handleSearchChange={(e) => setSearchTerm(e.target.value)}
          />
        </Box>
        <Button
          sx={{ width: { xs: "100%", md: "auto" } }}
          variant="contained"
          onClick={() => navigate("/dashboard/market")}
          startIcon={<AddIcon />}
        >
          {isMobile ? "Market" : "Register Market"}
        </Button>
      </Box>
      <MarketsList searchTerm={searchTerm} />
    </Box>
  );
};

export default MarketsPage;
