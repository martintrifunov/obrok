import { useState } from "react";
import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ProductsList from "@/features/products/components/ProductsList";
import ProductSearchBar from "@/features/products/components/ProductSearchBar";

const ProductsPage = () => {
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
          <ProductSearchBar
            handleSearchChange={(e) => setSearchTerm(e.target.value)}
          />
        </Box>
        <Button
          sx={{ width: { xs: "100%", md: "auto" } }}
          variant="contained"
          onClick={() => navigate("/dashboard/product")}
          startIcon={<AddIcon />}
        >
          Add Product
        </Button>
      </Box>
      <ProductsList searchTerm={searchTerm} />
    </Box>
  );
};

export default ProductsPage;
