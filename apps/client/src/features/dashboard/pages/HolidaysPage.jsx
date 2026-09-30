import { useState } from "react";
import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import HolidaysList from "@/features/public-holidays/components/HolidaysList";
import HolidaySearchBar from "@/features/public-holidays/components/HolidaySearchBar";

const HolidaysPage = () => {
  const navigate = useNavigate();
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
          <HolidaySearchBar
            handleSearchChange={(e) => setSearchTerm(e.target.value)}
          />
        </Box>
        <Button
          sx={{ width: { xs: "100%", md: "auto" } }}
          variant="contained"
          onClick={() => navigate("/dashboard/holiday")}
          startIcon={<AddIcon />}
        >
          Add Holiday
        </Button>
      </Box>
      <HolidaysList searchTerm={searchTerm} />
    </Box>
  );
};

export default HolidaysPage;
