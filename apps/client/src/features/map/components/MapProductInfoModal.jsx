import { useState } from "react";
import { Button } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import SharedMarketProductsModal from "@/components/ui/SharedMarketProductsModal";

const MapProductInfoModal = ({
  marketId,
  marketName,
  initialSearch,
  initialAiMode,
  initialShoppingList,
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        fullWidth
        onClick={handleOpen}
        startIcon={<InfoIcon />}
        sx={{ textTransform: "none", borderRadius: 2, py: 1 }}
      >
        Продукти
      </Button>

      <SharedMarketProductsModal
        open={open}
        onClose={(e) => {
          if (e) e.stopPropagation();
          setOpen(false);
        }}
        marketId={marketId}
        title={`${marketName || "Маркет"} Продукти`}
        initialSearch={initialSearch}
        initialAiMode={initialAiMode}
        initialShoppingList={initialShoppingList}
      />
    </>
  );
};

export default MapProductInfoModal;
